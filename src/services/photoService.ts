import { db, storage } from './firebaseConfig';
import {
    collection,
    addDoc,
    setDoc,
    doc,
    query,
    where,
    orderBy,
    getDocs,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface VehiclePhoto {
    id?: string;
    vin: string;
    registrationNumber: string;
    photoUrl: string;
    angle: string;
    timestamp: Timestamp;
    metadata?: any;
}

const COLLECTION_NAME = 'VehiclePhotos';

export const photoService = {
    /**
     * Uploads a photo to Firebase Storage and saves the record to Firestore
     */
    async saveVehiclePhoto(uri: string, vehicleData: any, angle: string, category: string = 'vehicles') {
        let photoUrl = ''; // Hoisted for access in fallback

        try {
            // Helper for timeouts
            const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
                    promise.then(
                        (res) => { clearTimeout(timer); resolve(res); },
                        (err) => { clearTimeout(timer); reject(err); }
                    );
                });
            };

            console.log("Preparing upload for URI:", uri);

            // 1. Convert File URI to Blob with Timeout
            const blobCreator = async () => {
                const response = await fetch(uri);
                if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
                return await response.blob();
            };

            // 10 second timeout for local file read
            const blob = await withTimeout(blobCreator(), 10000, "Timeout creating image blob from file");

            console.log(`Blob created successfully. Size: ${blob.size} bytes`);

            const timestamp = Date.now();
            // Sanitize ID for path
            const assetId = (vehicleData.vin || 'unknown').replace(/[\s\/\#\?\[\]]/g, '_');
            const rootFolder = category === 'refrigeration' ? 'refrigeration' : 'vehicles';
            const filename = `${rootFolder}/${assetId}/${timestamp}_${angle}.jpg`;
            const storageRef = ref(storage, filename);

            console.log("Starting upload to path:", filename);

            // 2. Upload to Storage with Timeout (60 seconds)
            const uploadTask = uploadBytes(storageRef, blob);
            const uploadResult = await withTimeout(uploadTask, 60000, "Timeout uploading to Firebase Storage");

            console.log("Upload successful:", uploadResult.metadata.fullPath);

            console.log("Getting download URL...");
            photoUrl = await withTimeout(
                getDownloadURL(storageRef),
                15000,
                "Timeout getting download URL"
            );
            console.log("Got download URL:", photoUrl);

            // 3. Save reference to Firestore
            const photoRecord = {
                vin: vehicleData.vin || 'N/A',
                registrationNumber: vehicleData.registrationNumber || '',
                photoUrl,
                angle,
                timestamp: serverTimestamp(),
                metadata: {
                    make: vehicleData.make || '',
                    series: vehicleData.series || '',
                    originalTimestamp: timestamp
                }
            };

            // Create a unique ID manually and sanitize it to avoid path segment issues (slashes)
            const unsafeDocId = `${vehicleData.vin || 'temp'}_${timestamp}_${angle}`;
            const customDocId = unsafeDocId.replace(/\//g, '_');
            const docRef = doc(db, COLLECTION_NAME, customDocId);

            await withTimeout(
                setDoc(docRef, photoRecord),
                15000,
                "Timeout saving to Firestore"
            );
            console.log("Saved to Firestore with ID:", customDocId);

            return { id: customDocId, ...photoRecord };
        } catch (error: any) {
            console.error("SDK UPLOAD ERROR:", error);

            // FALLBACK: If SDK connection fails (Timeout) AND we have a photoUrl, use REST API
            if (error.message && error.message.includes("Timeout") && photoUrl) {
                console.log("Attempting REST API Fallback...");
                try {
                    const projectId = "rogersdb-ef29e";
                    const fallbackTimestamp = Date.now();
                    const unsafeDocId = `${vehicleData.vin || 'temp'}_${fallbackTimestamp}_${angle}`;
                    const customDocId = unsafeDocId.replace(/\//g, '_');
                    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${COLLECTION_NAME}?documentId=${customDocId}`;

                    const restBody = {
                        fields: {
                            vin: { stringValue: vehicleData.vin || 'N/A' },
                            registrationNumber: { stringValue: vehicleData.registrationNumber || '' },
                            photoUrl: { stringValue: photoUrl },
                            angle: { stringValue: angle },
                            // Use current time ISO string since serverTimestamp() is not available in REST JSON
                            timestamp: { timestampValue: new Date().toISOString() },
                            metadata: {
                                mapValue: {
                                    fields: {
                                        make: { stringValue: vehicleData.make || '' },
                                        series: { stringValue: vehicleData.series || '' },
                                        originalTimestamp: { integerValue: String(fallbackTimestamp) }
                                    }
                                }
                            }
                        }
                    };

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(restBody)
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`REST Error: ${response.status} - ${errorText}`);
                    }

                    console.log("REST Fallback Successful!");
                    return {
                        id: customDocId,
                        vin: vehicleData.vin || 'N/A',
                        registrationNumber: vehicleData.registrationNumber || '',
                        photoUrl,
                        angle,
                        timestamp: Timestamp.now(), // Approximate for local return
                        metadata: restBody.fields.metadata.mapValue.fields
                    };

                } catch (restErr: any) {
                    console.error("REST Fallback Failed:", restErr);
                    // Throw the ORIGINAL error to the user if fallback also failed
                    throw new Error(`Upload Failed (SDK & REST): ${error.message} \nREST: ${restErr.message}`);
                }
            }
            throw new Error(`Upload Failed: ${error.message}`);
        }
    },

    /**
     * Fetches all photos for a specific vehicle by VIN, ordered by latest first
     */
    async getPhotosByVehicle(vin: string): Promise<VehiclePhoto[]> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('vin', '==', vin)
            );

            const querySnapshot = await getDocs(q);
            const photos = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as VehiclePhoto));

            // Sort client-side to avoid needing a composite index in Firestore
            return photos.sort((a, b) => {
                const getTime = (ts: any) => {
                    if (!ts) return 0;
                    if (ts.toMillis) return ts.toMillis();
                    if (ts.seconds) return ts.seconds * 1000;
                    return new Date(ts).getTime();
                };
                return getTime(b.timestamp) - getTime(a.timestamp);
            });
        } catch (error) {
            console.error("Error fetching photos:", error);
            throw error;
        }
    },

    /**
     * Gets the most recent photo for a vehicle at a specific angle for comparison
     */
    async getLatestPhotoByAngle(vin: string, angle: string): Promise<VehiclePhoto | null> {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('vin', '==', vin),
                where('angle', '==', angle)
            );

            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return null;

            const photos = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as VehiclePhoto));

            // Sort client-side
            photos.sort((a, b) => {
                const getTime = (ts: any) => {
                    if (!ts) return 0;
                    if (ts.toMillis) return ts.toMillis();
                    if (ts.seconds) return ts.seconds * 1000;
                    return new Date(ts).getTime();
                };
                return getTime(b.timestamp) - getTime(a.timestamp);
            });

            return photos[0];
        } catch (error) {
            console.error("Error fetching latest photo:", error);
            throw error;
        }
    }
};
