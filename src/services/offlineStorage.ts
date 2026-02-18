import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    AGREEMENTS: 'offline_agreements',
    PENDING_INSPECTIONS: 'pending_inspections',
    LAST_SYNC: 'last_sync_timestamp',
    USER_ID: 'app_user_id'
};

export const offlineStorage = {
    /**
     * Get the current user ID
     */
    async getUserId(): Promise<string> {
        try {
            const id = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
            return id || 'USER_001'; // Default placeholder
        } catch (error) {
            return 'USER_001';
        }
    },

    /**
     * Set the current user ID
     */
    async setUserId(userId: string) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userId);
        } catch (error) {
            console.error('Failed to set user ID:', error);
        }
    },
    /**
     * Save agreements to local storage for offline access
     */
    async saveAgreements(agreements: any[]) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.AGREEMENTS, JSON.stringify(agreements));
            await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
            console.log(`Saved ${agreements.length} agreements locally.`);
        } catch (error) {
            console.error('Failed to save agreements locally:', error);
        }
    },

    /**
     * Get locally stored agreements
     */
    async getAgreements(): Promise<any[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.AGREEMENTS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get local agreements:', error);
            return [];
        }
    },

    /**
     * Save a completed inspection that needs to be synced later
     */
    async savePendingInspection(inspectionData: any) {
        try {
            const currentPending = await this.getPendingInspections();
            // If an update for this ID already exists, overwrite it
            const newPending = [
                ...currentPending.filter(p => p.agreementId !== inspectionData.agreementId),
                inspectionData
            ];
            await AsyncStorage.setItem(STORAGE_KEYS.PENDING_INSPECTIONS, JSON.stringify(newPending));
            console.log('Saved pending inspection:', inspectionData.agreementId);
        } catch (error) {
            console.error('Failed to save pending inspection:', error);
            throw error;
        }
    },

    /**
     * Get all pending inspections
     */
    async getPendingInspections(): Promise<any[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_INSPECTIONS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get pending inspections:', error);
            return [];
        }
    },

    /**
     * Clear specific pending inspections after successful sync
     */
    async removePendingInspections(agreementIds: string[]) {
        try {
            const current = await this.getPendingInspections();
            const remaining = current.filter(p => !agreementIds.includes(p.agreementId));
            await AsyncStorage.setItem(STORAGE_KEYS.PENDING_INSPECTIONS, JSON.stringify(remaining));
        } catch (error) {
            console.error('Failed to remove pending inspections:', error);
        }
    },

    async getLastSyncTime(): Promise<number | null> {
        try {
            const time = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
            return time ? parseInt(time, 10) : null;
        } catch (error) {
            return null;
        }
    }
};
