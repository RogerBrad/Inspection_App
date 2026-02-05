import { realtimeDb } from './firebaseConfig';
import { ref, get, update } from 'firebase/database';

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
 * Common prefixes: ]C1, ]E0, ]d2, etc.
 */
function cleanBarcodeValue(rawValue: string): string {
    // Remove AIM (Association for Automatic Identification and Mobility) symbology identifiers
    // These are typically in format ]XY where X is the code type and Y is a modifier
    const cleaned = rawValue.replace(/^\][A-Z][0-9]/, '').trim();
    console.log(`Barcode cleaned: "${rawValue}" -> "${cleaned}"`);
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
    ): Promise<{ success: boolean; error?: string }> {
        try {
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
    }
};
