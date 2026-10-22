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

const TABLE = 'rental_agreements';
const COLUMNS = 'id, status, inspection_date, agreement_data';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Flattens a rental_agreements row into the RentalAgreement shape used by the app.
 * The agreement details (parties, assetDetails, inspectionWorkflow...) live in the
 * agreement_data JSONB column, exactly as the SRAM web app stores them.
 */
function mapRow(row: any): RentalAgreement {
    const agreementData = row.agreement_data || {};
    return {
        ...agreementData,
        id: row.id,
        status: row.status,
        endOfRental: {
            ...(agreementData.endOfRental || {}),
            inspectionDate: row.inspection_date || agreementData.endOfRental?.inspectionDate,
        },
    };
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

/**
 * Finds a rental agreement by its ID, or by the serial number / VIN of its asset
 */
async function findAgreement(identifier: string): Promise<RentalAgreement | null> {
    // 1. Direct ID match (IDs are UUIDs in Supabase)
    if (UUID_REGEX.test(identifier)) {
        const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq('id', identifier).maybeSingle();
        if (error) throw error;
        if (data) return mapRow(data);
    }

    // 2. Serial number, then VIN
    for (const path of ['agreement_data->assetDetails->>serialNumber', 'agreement_data->assetDetails->>vin']) {
        const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq(path, identifier).limit(1);
        if (error) throw error;
        if (data && data.length > 0) return mapRow(data[0]);
    }

    return null;
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

            const foundAgreement = await findAgreement(cleanedId);

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
        } catch (error: any) {
            console.error('Error validating agreement:', error);
            return {
                valid: false,
                error: `Database error: ${error?.message || 'Unknown error'}`
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

            // Online Mode: merge into agreement_data.inspectionWorkflow (same as the SRAM web app)
            const { data: raRow, error: readError } = await supabase
                .from(TABLE)
                .select('agreement_data')
                .eq('id', agreementId)
                .single();
            if (readError) throw readError;

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
                    },
                },
            };

            const { data: updated, error: updateError } = await supabase
                .from(TABLE)
                .update({ agreement_data: updatedData })
                .eq('id', agreementId)
                .select('id');
            if (updateError) throw updateError;

            // Row Level Security can silently block an update, so confirm a row changed
            if (!updated || updated.length === 0) {
                throw new Error('Rental agreement was not updated (not found or permission denied)');
            }

            return { success: true };
        } catch (error: any) {
            console.error('Error updating inspection result:', error);
            return {
                success: false,
                error: `Failed to update database: ${error?.message || 'Unknown error'}`
            };
        }
    },

    /**
     * Download all ALLOCATED inspections for this technician and store locally
     */
    async syncDownAllocatedInspections(userEmail: string): Promise<{ success: boolean; count: number; totalInDb: number }> {
        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                console.log('Offline: Skipping download');
                return { success: false, count: 0, totalInDb: 0 };
            }

            const { data, error } = await supabase
                .from(TABLE)
                .select(COLUMNS)
                .eq('agreement_data->inspectionWorkflow->>status', 'Allocated');
            if (error) throw error;

            const rows = data || [];
            const totalInDb = rows.length;
            const searchEmail = (userEmail || "").toLowerCase().trim();
            const userId = (await offlineStorage.getUserId()).toLowerCase().trim();

            const allocatedAgreements: RentalAgreement[] = rows
                .map(mapRow)
                .filter(agreement => {
                    const workflow = agreement.inspectionWorkflow;
                    const techEmail = (workflow?.technicianEmail || "").toLowerCase().trim();
                    const techId = (workflow?.technicianId || "").toLowerCase().trim();

                    // Match on technician email, or on the technician's user ID (robustness)
                    return (searchEmail !== "" && techEmail === searchEmail) || (userId !== "" && techId === userId);
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
                // Re-use existing update logic
                const result = await this.updateInspectionResult(
                    item.agreementId,
                    item.passed,
                    item.notes,
                    item.inspectionItems
                );

                // Only treat as synced if it reached the server (not re-queued offline)
                if (result.success && !result.offline) {
                    successIds.push(item.agreementId);
                } else {
                    console.error(`Failed to sync up inspection ${item.agreementId}:`, result.error);
                    errors.push({ id: item.agreementId, error: result.error });
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
