import { supabase } from './supabaseClient';

export interface VehiclePhoto {
    id?: string;
    vin: string;
    registrationNumber: string;
    photoUrl: string;
    angle: string;
    timestamp: any;
    metadata?: any;
}

const COLLECTION_NAME = 'vehicle_photos';

export const photoService = {
    /**
     * Uploads a photo to Supabase Storage and saves the record to database
     */
    async saveVehiclePhoto(uri: string, vehicleData: any, angle: string, category: string = 'vehicles') {
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

            console.log("Starting upload to path:", filename);

            // 2. Upload to Storage with Timeout (60 seconds)
            const uploadTask = supabase.storage
                .from('vehicle-photos')
                .upload(filename, blob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            const uploadResult = await withTimeout(uploadTask, 60000, "Timeout uploading to Supabase Storage");
            if (uploadResult.error) throw uploadResult.error;

            console.log("Upload successful:", uploadResult.data.path);

            console.log("Getting download URL...");
            const { data: publicUrlData } = supabase.storage
                .from('vehicle-photos')
                .getPublicUrl(filename);
            const photoUrl = publicUrlData.publicUrl;
            console.log("Got download URL:", photoUrl);

            // 3. Save reference to database
            const photoRecord = {
                vin: vehicleData.vin || 'N/A',
                registration_number: vehicleData.registrationNumber || '',
                photo_url: photoUrl,
                angle,
                timestamp: new Date().toISOString(),
                metadata: {
                    make: vehicleData.make || '',
                    series: vehicleData.series || '',
                    originalTimestamp: timestamp
                }
            };

            const { data: insertData, error: insertErr } = await supabase
                .from(COLLECTION_NAME)
                .insert(photoRecord)
                .select()
                .single();

            if (insertErr) throw insertErr;
            console.log("Saved to database with ID:", insertData.id);

            return {
                id: insertData.id,
                vin: insertData.vin,
                registrationNumber: insertData.registration_number,
                photoUrl: insertData.photo_url,
                angle: insertData.angle,
                timestamp: insertData.timestamp,
                metadata: insertData.metadata
            };
        } catch (error: any) {
            console.error("SDK UPLOAD ERROR:", error);
            throw new Error(`Upload Failed: ${error.message}`);
        }
    },

    /**
     * Fetches all photos for a specific vehicle by VIN, ordered by latest first
     */
    async getPhotosByVehicle(vin: string): Promise<VehiclePhoto[]> {
        try {
            const { data, error } = await supabase
                .from(COLLECTION_NAME)
                .select('*')
                .eq('vin', vin);

            if (error) throw error;

            const photos = (data || []).map(row => ({
                id: row.id,
                vin: row.vin,
                registrationNumber: row.registration_number,
                photoUrl: row.photo_url,
                angle: row.angle,
                timestamp: row.timestamp,
                metadata: row.metadata
            }));

            // Sort client-side
            return photos.sort((a, b) => {
                const getTime = (ts: any) => {
                    if (!ts) return 0;
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
            const { data, error } = await supabase
                .from(COLLECTION_NAME)
                .select('*')
                .eq('vin', vin)
                .eq('angle', angle)
                .order('timestamp', { ascending: false })
                .limit(1);

            if (error) throw error;
            if (!data || data.length === 0) return null;

            const row = data[0];
            return {
                id: row.id,
                vin: row.vin,
                registrationNumber: row.registration_number,
                photoUrl: row.photo_url,
                angle: row.angle,
                timestamp: row.timestamp,
                metadata: row.metadata
            };
        } catch (error) {
            console.error("Error fetching latest photo:", error);
            throw error;
        }
    }
};
