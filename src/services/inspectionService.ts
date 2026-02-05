import { db } from './firebaseConfig';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    addDoc,
    orderBy,
    Timestamp
} from 'firebase/firestore';

export interface InspectionType {
    id: string;
    label: string;
    items: InspectionItem[];
}

export interface InspectionItem {
    label: string;
    subItems: string[];
}

export interface InspectionConfig {
    category: 'motor_vehicle' | 'refrigeration';
    inspectionTypes: InspectionType[];
    areas: string[];
}

export interface SubItemResult {
    label: string;
    parentItem: string;
    status: 'pass' | 'fail' | null;
    comment?: string;
}

export interface InspectionRecord {
    id?: string;
    assetId: string; // VIN or Serial
    assetCategory: string;
    inspectionTypeId: string;
    inspectionTypeLabel: string;
    timestamp: any;
    results: SubItemResult[];
    odometer?: string;
    summary: {
        passCount: number;
        failCount: number;
    };
}

const CONFIG_COLLECTION = 'InspectionConfigs';
const INSPECTIONS_COLLECTION = 'Inspections';

export const inspectionService = {
    /**
     * Fetches the inspection configuration for a specific category
     */
    async getConfigByCategory(category: string): Promise<InspectionConfig | null> {
        try {
            const q = query(
                collection(db, CONFIG_COLLECTION),
                where('category', '==', category)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) return null;

            return snapshot.docs[0].data() as InspectionConfig;
        } catch (error) {
            console.error("Error fetching inspection config:", error);
            throw error;
        }
    },

    /**
     * Seeds initial data into Firestore to get the system started
     * Call this once during setup or via a hidden admin menu
     */
    async seedInitialConfigs() {
        const configs: InspectionConfig[] = [
            {
                category: 'motor_vehicle',
                areas: ['Front', 'Rear', 'Left', 'Right', 'Interior', 'Engine'],
                inspectionTypes: [
                    {
                        id: 'road_worthy',
                        label: 'Road Worthy Inspection',
                        items: [
                            { label: 'Tires', subItems: ['Front Left Tread', 'Front Right Tread', 'Rear Left Tread', 'Rear Right Tread', 'Spare Wheel Condition'] },
                            { label: 'Brakes', subItems: ['Pad Thickness', 'Disc Surface', 'Brake Lines', 'Fluid Level', 'Handbrake tension'] },
                            { label: 'Lights', subItems: ['Headlights', 'Indicators', 'Brake Lights', 'Reverse Lights', 'Fog Lights'] },
                        ]
                    },
                    {
                        id: 'full_inspection',
                        label: 'Full Inspection',
                        items: [
                            { label: 'Fluid Levels', subItems: ['Engine Oil', 'Coolant', 'Windshield Wash', 'Brake Fluid', 'Transmission Fluid'] },
                            { label: 'Battery', subItems: ['Voltage Check', 'Terminal Corrosion', 'Mounting', 'Age check'] },
                        ]
                    }
                ]
            },
            {
                category: 'refrigeration',
                areas: ['Compressor', 'Condenser', 'Evaporator', 'Control Panel', 'Door Seals'],
                inspectionTypes: [
                    {
                        id: 'grv_inspection',
                        label: 'GRV Inspection',
                        items: [
                            { label: 'Verification', subItems: ['Model Match', 'Serial Number Scan', 'Voltage Rating', 'Phase check'] },
                            { label: 'Physical', subItems: ['Dents/Scratches', 'Paint Finish', 'Gasket Condition', 'Packaging integrity'] },
                        ]
                    },
                    {
                        id: 'pre_delivery',
                        label: 'Pre Delivery Inspection',
                        items: [
                            { label: 'Performance', subItems: ['Temperature Drop', 'Thermostat Cycle', 'Fan Speed', 'Defrost system'] },
                            { label: 'Electronics', subItems: ['Display Panel', 'Interior Light', 'Alarm system', 'Remote Control'] },
                        ]
                    }
                ]
            }
        ];

        for (const config of configs) {
            const docId = config.category;
            await setDoc(doc(db, CONFIG_COLLECTION, docId), config);
            console.log(`Seeded config for: ${docId}`);
        }
    },

    /**
     * Saves a completed inspection to Firestore
     */
    async saveInspection(record: Omit<InspectionRecord, 'timestamp'>) {
        try {
            const data = {
                ...record,
                timestamp: Timestamp.now()
            };
            const docRef = await addDoc(collection(db, INSPECTIONS_COLLECTION), data);
            return docRef.id;
        } catch (error) {
            console.error("Error saving inspection:", error);
            throw error;
        }
    },

    /**
     * Fetches historical inspections for a specific asset
     */
    async getInspectionsByAsset(assetId: string): Promise<InspectionRecord[]> {
        try {
            // Simplified query to avoid the need for composite indexes (which often cause silent failures)
            const q = query(
                collection(db, INSPECTIONS_COLLECTION),
                where('assetId', '==', assetId)
            );
            const snapshot = await getDocs(q);

            // Map the data
            const records = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as InspectionRecord[];

            // Sort client-side by timestamp descending
            return records.sort((a, b) => {
                const getMillis = (ts: any) => {
                    if (!ts) return 0;
                    if (ts.toMillis) return ts.toMillis();
                    if (ts.seconds) return ts.seconds * 1000;
                    return new Date(ts).getTime();
                };
                return getMillis(b.timestamp) - getMillis(a.timestamp);
            });
        } catch (error) {
            console.error("Error fetching history:", error);
            throw error;
        }
    }
};
