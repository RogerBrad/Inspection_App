import { supabase } from './supabaseClient';

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

const CONFIG_COLLECTION = 'inspection_configs';
const INSPECTIONS_COLLECTION = 'inspections';

export const inspectionService = {
    /**
     * Fetches the inspection configuration for a specific category
     */
    async getConfigByCategory(category: string): Promise<InspectionConfig | null> {
        try {
            const { data, error } = await supabase
                .from(CONFIG_COLLECTION)
                .select('*')
                .eq('category', category);

            if (error) throw error;
            if (!data || data.length === 0) return null;

            const row = data[0];
            return {
                category: row.category,
                inspectionTypes: row.inspection_types,
                areas: row.areas
            } as InspectionConfig;
        } catch (error) {
            console.error("Error fetching inspection config:", error);
            throw error;
        }
    },

    /**
     * Seeds initial data into database to get the system started
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
            const { error } = await supabase
                .from(CONFIG_COLLECTION)
                .upsert({
                    id: config.category,
                    category: config.category,
                    inspection_types: config.inspectionTypes,
                    areas: config.areas
                });
            if (error) {
                console.error(`Error seeding config for: ${config.category}`, error);
            } else {
                console.log(`Seeded config for: ${config.category}`);
            }
        }
    },

    /**
     * Provides a hardcoded fallback if the database cannot be reached
     */
    getStaticFallbackConfig(category: string): InspectionConfig {
        if (category === 'refrigeration') {
            return {
                category: 'refrigeration',
                areas: ['Compressor', 'Condenser', 'Evaporator', 'Control Panel', 'Door Seals'],
                inspectionTypes: [
                    {
                        id: 'grv_inspection',
                        label: 'GRV Inspection (LOCAL)',
                        items: [
                            { label: 'Verification', subItems: ['Model Match', 'Serial Number Scan', 'Voltage Rating'] },
                            { label: 'Physical', subItems: ['Dents/Scratches', 'Paint Finish', 'Gasket Condition'] },
                        ]
                    }
                ]
            };
        }
        return {
            category: 'motor_vehicle' as any,
            areas: ['Front', 'Rear', 'Left', 'Right', 'Interior', 'Engine'],
            inspectionTypes: [
                {
                    id: 'road_worthy',
                    label: 'Road Worthy (LOCAL)',
                    items: [
                        { label: 'Tires', subItems: ['Front Left', 'Front Right', 'Rear Left', 'Rear Right'] },
                        { label: 'Lights', subItems: ['Headlights', 'Indicators', 'Brake Lights'] },
                        { label: 'Brakes', subItems: ['Fluid Level', 'Handbrake'] },
                    ]
                }
            ]
        };
    },

    /**
     * Saves a completed inspection to Supabase
     */
    async saveInspection(record: Omit<InspectionRecord, 'timestamp'>) {
        try {
            const data = {
                asset_id: record.assetId,
                asset_category: record.assetCategory,
                inspection_type_id: record.inspectionTypeId,
                inspection_type_label: record.inspectionTypeLabel,
                results: record.results,
                odometer: record.odometer || null,
                summary: record.summary,
                timestamp: new Date().toISOString()
            };
            const { data: insertData, error } = await supabase
                .from(INSPECTIONS_COLLECTION)
                .insert(data)
                .select()
                .single();

            if (error) throw error;
            return insertData.id;
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
            const { data, error } = await supabase
                .from(INSPECTIONS_COLLECTION)
                .select('*')
                .eq('asset_id', assetId);

            if (error) throw error;

            const records = (data || []).map(row => ({
                id: row.id,
                assetId: row.asset_id,
                assetCategory: row.asset_category,
                inspectionTypeId: row.inspection_type_id,
                inspectionTypeLabel: row.inspection_type_label,
                timestamp: row.timestamp,
                results: row.results,
                odometer: row.odometer,
                summary: row.summary
            })) as InspectionRecord[];

            // Sort client-side by timestamp descending
            return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } catch (error) {
            console.error("Error fetching history:", error);
            throw error;
        }
    }
};
