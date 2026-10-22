import { supabase, PHOTO_BUCKET } from './supabaseClient';

export interface VehiclePhoto {
    id?: string;
    vin: string;
    registrationNumber: string;
    photoUrl: string;
    angle: string;
    timestamp: string; // ISO date string
    metadata?: any;
}

const TABLE = 'vehicle_photos';

function mapPhotoRow(row: any): VehiclePhoto {
    return {
        id: row.id,
        vin: row.vin,
        registrationNumber: row.registration_number || '',
        photoUrl: row.photo_url,
        angle: row.angle,
        timestamp: row.timestamp,
        metadata: row.metadata,
    };
}

// Helper for timeouts
const withTimeout = <T>(promise: PromiseLike<T>, ms: number, errorMsg: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
        promise.then(
            (res) => { clearTimeout(timer); resolve(res); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
};

export const photoService = {
    /**
     * Uploads a photo to Supabase Storage and saves the record to the vehicle_photos table
     */
    async saveVehiclePhoto(uri: string, vehicleData: any, angle: string, category: string = 'vehicles') {
        try {
            console.log("Preparing upload for URI:", uri);

            const timestamp = Date.now();
            // Sanitize ID for path
            const assetId = (vehicleData.vin || 'unknown').replace(/[\s\/\#\?\[\]]/g, '_');
            const rootFolder = category === 'refrigeration' ? 'refrigeration' : 'vehicles';
            const filename = `${rootFolder}/${assetId}/${timestamp}_${angle}.jpg`;

            // 1. Read the file into an ArrayBuffer (10 second timeout for local file read).
            // supabase-js cannot upload React Native Blobs or FormData, so raw bytes are required.
            const fileReader = async () => {
                const response = await fetch(uri);
                if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
                return await response.arrayBuffer();
            };
            const fileBytes = await withTimeout(fileReader(), 10000, "Timeout reading image file");

            console.log(`File read successfully. Size: ${fileBytes.byteLength} bytes`);
            console.log("Starting upload to path:", filename);

            // 2. Upload to Storage with Timeout (60 seconds)
            const { data: uploadResult, error: uploadError } = await withTimeout(
                supabase.storage.from(PHOTO_BUCKET).upload(filename, fileBytes, { contentType: 'image/jpeg' }),
                60000,
                "Timeout uploading to Supabase Storage"
            );
            if (uploadError) throw uploadError;

            console.log("Upload successful:", uploadResult.path);

            const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(uploadResult.path);
            const photoUrl = urlData.publicUrl;
            console.log("Got public URL:", photoUrl);

            // 3. Save reference to the vehicle_photos table
            const { data: row, error: insertError } = await withTimeout(
                supabase
                    .from(TABLE)
                    .insert({
                        vin: vehicleData.vin || 'N/A',
                        registration_number: vehicleData.registrationNumber || '',
                        photo_url: photoUrl,
                        angle,
                        timestamp: new Date(timestamp).toISOString(),
                        metadata: {
                            make: vehicleData.make || '',
                            series: vehicleData.series || '',
                            originalTimestamp: timestamp,
                            storagePath: uploadResult.path
                        }
                    })
                    .select('*')
                    .single(),
                15000,
                "Timeout saving photo record"
            );
            if (insertError) throw insertError;

            console.log("Saved photo record with ID:", row.id);

            return mapPhotoRow(row);
        } catch (error: any) {
            console.error("UPLOAD ERROR:", error);
            throw new Error(`Upload Failed: ${error.message}`);
        }
    },

    /**
     * Fetches all photos for a specific vehicle by VIN, ordered by latest first
     */
    async getPhotosByVehicle(vin: string): Promise<VehiclePhoto[]> {
        try {
            const { data, error } = await supabase
                .from(TABLE)
                .select('*')
                .eq('vin', vin)
                .order('timestamp', { ascending: false });
            if (error) throw error;

            return (data || []).map(mapPhotoRow);
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
                .from(TABLE)
                .select('*')
                .eq('vin', vin)
                .eq('angle', angle)
                .order('timestamp', { ascending: false })
                .limit(1);
            if (error) throw error;

            return data && data.length > 0 ? mapPhotoRow(data[0]) : null;
        } catch (error) {
            console.error("Error fetching latest photo:", error);
            throw error;
        }
    }
};
