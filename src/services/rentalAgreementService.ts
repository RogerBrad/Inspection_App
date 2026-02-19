import { realtimeDb } from './firebaseConfig';
import { ref, get, update, query, orderByChild, equalTo } from 'firebase/database';
import { offlineStorage } from './offlineStorage';
import NetInfo from "@react-native-community/netinfo";


export interface RentalAgreement {
    id: string;
    parties?: {
        lesseeName: string;
    };
    assetDetails?: {
        assetName: string;
        vin?: string;
        serialNumber?: string;
    };
    assetCategory?: string;
    endOfRental?: {
        inspectionDate: string;
    };
    status: string;
    inspectionWorkflow?: InspectionWorkflow;
}

export interface InspectionWorkflow {
    status: 'Due' | 'Allocated' | 'In Progress' | 'Passed' | 'Failed' | 'Log Created' | 'Completed';
    technicianId?: string;
    technicianName?: string;
    technicianEmail?: string;
    allocatedAt?: number;
    completedAt?: number;
    inspectionResults?: {
        passed: boolean;
        notes?: string;
        items?: any[];
    };
    nextInspectionDate?: string;
    supportLogId?: string;
}

/**
 * Cleans barcode value by removing symbology identifiers
 * Common prefixes: ]C1, ]E0, ]d2, ]IC1, etc.
 */
function cleanBarcodeValue(rawValue: string): string {
    if (!rawValue) return '';

    // 1. Remove AIM symbology identifiers: ] + 1-3 chars
    // Example: ]C1, ]E0, ]I, ]IC1
    let cleaned = rawValue.replace(/^\][A-Z0-9]{1,3}/, '').trim();

    // 2. Secondary cleanup: if it still starts with a bracket or special char, 
    // remove everything until the first letter/number
    if (cleaned.startsWith(']') || !/^[A-Z0-9]/i.test(cleaned)) {
        cleaned = cleaned.replace(/^[^A-Z0-9]+/, '');
    }

    console.log(`Barcode cleaning detail: Raw="${rawValue}" -> Cleaned="${cleaned}"`);
    return cleaned;
}

export const rentalAgreementService = {
    /**
     * Validates if a scanned ID exists in rental agreements
     * and checks if it has an allocated inspection
     */
    async validateAndGetAgreement(
        scannedId: string,
        currentUserId: string
    ): Promise<{ valid: boolean; agreement?: RentalAgreement; error?: string }> {
        try {
            // Clean the scanned value to remove symbology identifiers
            const cleanedId = cleanBarcodeValue(scannedId);

            const agreementsRef = ref(realtimeDb, 'rentalAgreements');
            const snapshot = await get(agreementsRef);

            if (!snapshot.exists()) {
                return { valid: false, error: 'No rental agreements found in database' };
            }

            const data = snapshot.val();

            // Search for agreement by ID or by VIN/Serial Number
            let foundAgreement: RentalAgreement | null = null;
            let agreementId: string | null = null;

            // First, try direct ID match
            if (data[cleanedId]) {
                foundAgreement = { ...data[cleanedId], id: cleanedId };
                agreementId = cleanedId;
            } else {
                // Search by VIN or Serial Number
                for (const [id, val] of Object.entries(data)) {
                    const agreement = val as any;
                    const vin = agreement.assetDetails?.vin;
                    const serial = agreement.assetDetails?.serialNumber;

                    if (vin === cleanedId || serial === cleanedId) {
                        foundAgreement = { ...agreement, id };
                        agreementId = id;
                        break;
                    }
                }
            }

            if (!foundAgreement) {
                return {
                    valid: false,
                    error: `No rental agreement found for serial number: ${cleanedId}`
                };
            }

            // Check if inspection workflow exists and is allocated
            const workflow = foundAgreement.inspectionWorkflow;

            if (!workflow) {
                return {
                    valid: false,
                    error: 'No inspection has been allocated for this asset'
                };
            }

            if (workflow.status !== 'Allocated') {
                return {
                    valid: false,
                    error: `Inspection status is "${workflow.status}". Only "Allocated" inspections can be performed.`
                };
            }

            // Validation passed - inspection exists and is allocated
            console.log(`✅ Inspection found and allocated to: ${workflow.technicianName || workflow.technicianId}`);
            return { valid: true, agreement: foundAgreement };
        } catch (error) {
            console.error('Error validating agreement:', error);
            return {
                valid: false,
                error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    },

    /**
     * Updates the inspection workflow status to Passed or Failed
     */
    async updateInspectionResult(
        agreementId: string,
        passed: boolean,
        notes: string,
        inspectionItems: any[]
    ): Promise<{ success: boolean; error?: string; offline?: boolean }> {
        try {
            const netInfo = await NetInfo.fetch();

            // Offline Mode
            if (!netInfo.isConnected) {
                await offlineStorage.savePendingInspection({
                    agreementId,
                    passed,
                    notes,
                    inspectionItems,
                    timestamp: Date.now()
                });
                return { success: true, offline: true };
            }

            // Online Mode
            const updates: any = {};
            const workflowPath = `rentalAgreements/${agreementId}/inspectionWorkflow`;

            updates[`${workflowPath}/status`] = passed ? 'Passed' : 'Failed';
            updates[`${workflowPath}/completedAt`] = Date.now();
            updates[`${workflowPath}/inspectionResults`] = {
                passed,
                notes,
                items: inspectionItems
            };

            await update(ref(realtimeDb), updates);

            return { success: true };
        } catch (error) {
            console.error('Error updating inspection result:', error);
            return {
                success: false,
                error: `Failed to update database: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    },

    /**
     * Download all ALLOCATED inspections from Firebase and store locally
     */
    async syncDownAllocatedInspections(userEmail: string): Promise<{ success: boolean; count: number; totalInDb: number }> {
        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                console.log('Offline: Skipping download');
                return { success: false, count: 0, totalInDb: 0 };
            }

            const agreementsRef = ref(realtimeDb, 'rentalAgreements');
            const snapshot = await get(agreementsRef);

            if (!snapshot.exists()) {
                await offlineStorage.saveAgreements([]);
                return { success: true, count: 0, totalInDb: 0 };
            }

            const data = snapshot.val();
            const allItems = Object.entries(data);
            const totalInDb = allItems.length;
            const allocatedAgreements: RentalAgreement[] = [];

            allItems.forEach(([key, value]: [string, any]) => {
                const workflow = value.inspectionWorkflow;
                if (!workflow) return;

                const status = (workflow.status || "").toLowerCase();
                const techEmail = (workflow.technicianEmail || "").toLowerCase().trim();
                const techId = (workflow.technicianId || "").toLowerCase().trim();
                const searchEmail = (userEmail || "").toLowerCase().trim();

                // Match if status is 'allocated' AND email matches EITHER field (robustness)
                if (status === 'allocated' && (techEmail === searchEmail || techId === searchEmail) && searchEmail !== "") {
                    allocatedAgreements.push({
                        ...value,
                        id: key
                    });
                }
            });

            await offlineStorage.saveAgreements(allocatedAgreements);
            return { success: true, count: allocatedAgreements.length, totalInDb };

        } catch (error) {
            console.error('Download sync failed:', error);
            return { success: false, count: 0, totalInDb: 0 };
        }
    },

    /**
     * Upload locally completed inspections to Firebase
     */
    async syncUpCompletedInspections(): Promise<{ success: boolean; count: number; errors: any[] }> {
        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) return { success: false, count: 0, errors: [] };

            const pending = await offlineStorage.getPendingInspections();
            if (pending.length === 0) return { success: true, count: 0, errors: [] };

            const successIds: string[] = [];
            const errors: any[] = [];

            for (const item of pending) {
                try {
                    // Re-use existing update logic
                    await this.updateInspectionResult(
                        item.agreementId,
                        item.passed,
                        item.notes,
                        item.inspectionItems
                    );
                    successIds.push(item.agreementId);
                } catch (e) {
                    console.error(`Failed to sync up inspection ${item.agreementId}:`, e);
                    errors.push({ id: item.agreementId, error: e });
                }
            }

            // Remove successfully synced items from local storage
            if (successIds.length > 0) {
                await offlineStorage.removePendingInspections(successIds);
            }

            return { success: true, count: successIds.length, errors };

        } catch (error) {
            console.error('Upload sync failed:', error);
            return { success: false, count: 0, errors: [error] };
        }
    },

    /**
     * Get inspection list (prefer local storage)
     */
    async getLocalInspections(): Promise<RentalAgreement[]> {
        return await offlineStorage.getAgreements();
    }
};

