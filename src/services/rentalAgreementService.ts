import { supabase } from './supabaseClient';
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

            // Search for agreement by ID or by VIN/Serial Number
            const { data: raData, error: raError } = await supabase
                .from('rental_agreements')
                .select('id, status, agreement_data')
                .or(`id.eq.${cleanedId},agreement_data->assetDetails->>vin.eq.${cleanedId},agreement_data->assetDetails->>serialNumber.eq.${cleanedId}`);

            if (raError) {
                return { valid: false, error: `Database error: ${raError.message}` };
            }

            if (!raData || raData.length === 0) {
                return {
                    valid: false,
                    error: `No rental agreement found for serial number: ${cleanedId}`
                };
            }

            const row = raData[0];
            const agreementData = row.agreement_data || {};
            const foundAgreement: RentalAgreement = {
                ...agreementData,
                id: row.id,
                status: row.status
            };

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
            // First fetch existing agreement_data
            const { data: raRow, error: fetchErr } = await supabase
                .from('rental_agreements')
                .select('agreement_data')
                .eq('id', agreementId)
                .single();

            if (fetchErr) throw fetchErr;

            const agreementData = raRow?.agreement_data || {};
            const updatedData = {
                ...agreementData,
                inspectionWorkflow: {
                    ...(agreementData.inspectionWorkflow || {}),
                    status: passed ? 'Passed' : 'Failed',
                    completedAt: Date.now(),
                    inspectionResults: {
                        passed,
                        notes,
                        items: inspectionItems
                    }
                }
            };

            const { error: updateErr } = await supabase
                .from('rental_agreements')
                .update({ agreement_data: updatedData })
                .eq('id', agreementId);

            if (updateErr) throw updateErr;

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
     * Download all ALLOCATED inspections from Supabase and store locally
     */
    async syncDownAllocatedInspections(userEmail: string): Promise<{ success: boolean; count: number; totalInDb: number }> {
        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                console.log('Offline: Skipping download');
                return { success: false, count: 0, totalInDb: 0 };
            }

            const searchEmail = (userEmail || "").toLowerCase().trim();
            let searchId = "";
            try {
                searchId = (await offlineStorage.getUserId() || "").toLowerCase().trim();
            } catch (e) {
                console.warn('Failed to retrieve userId from storage:', e);
            }

            if (searchEmail === "" && searchId === "") {
                return { success: true, count: 0, totalInDb: 0 };
            }

            // We select agreements that have inspectionWorkflow.status as 'Allocated'
            const { data, error } = await supabase
                .from('rental_agreements')
                .select('id, status, agreement_data')
                .eq('agreement_data->inspectionWorkflow->>status', 'Allocated');

            if (error) throw error;

            const totalInDb = data?.length || 0;
            const allocatedAgreements: RentalAgreement[] = [];

            (data || []).forEach((row: any) => {
                const agreementData = row.agreement_data || {};
                const workflow = agreementData.inspectionWorkflow || {};
                const techEmail = (workflow.technicianEmail || "").toLowerCase().trim();
                const techId = (workflow.technicianId || "").toLowerCase().trim();

                // Match technician email or ID (or user ID)
                const matchesEmail = searchEmail !== "" && (techEmail === searchEmail || techId === searchEmail);
                const matchesId = searchId !== "" && techId === searchId;

                if (matchesEmail || matchesId) {
                    allocatedAgreements.push({
                        ...agreementData,
                        id: row.id,
                        status: row.status
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
     * Upload locally completed inspections to Supabase
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

