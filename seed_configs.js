const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jncxkiuabozqfehxfhxa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuY3hraXVhYm96cWZlaHhmaHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTE2OTYsImV4cCI6MjA5NzQyNzY5Nn0.SvTHZ6irp6Q6tmJ4cg2LU5y9bfnzRyK_LDQeh0SmY6c';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const COLLECTION_NAME = 'inspection_configs';

const configs = [
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
                    { label: 'Steering', subItems: ['Rack condition', 'Power Steering Fluid', 'Tie rod ends', 'Ball joints'] },
                ]
            },
            {
                id: 'full_inspection',
                label: 'Full Inspection',
                items: [
                    { label: 'Fluid Levels', subItems: ['Engine Oil', 'Coolant', 'Windshield Wash', 'Brake Fluid', 'Transmission Fluid'] },
                    { label: 'Battery', subItems: ['Voltage Check', 'Terminal Corrosion', 'Mounting', 'Age check'] },
                    { label: 'Exhaust', subItems: ['Muffler', 'Catalytic Converter', 'Sensors', 'Leak check'] },
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

async function seedData() {
    console.log('Seeding Hierarchical Inspection Configurations...');

    for (const config of configs) {
        const { data, error } = await supabase
            .from(COLLECTION_NAME)
            .upsert(
                [{
                    id: config.category,
                    category: config.category,
                    inspection_types: config.inspectionTypes,
                    areas: config.areas
                }],
                { onConflict: 'id' }
            );

        if (error) {
            console.error(`Error seeding config for: ${config.category}`, error);
        } else {
            console.log(`Seeded config for: ${config.category}`, data);
        }
    }

    console.log('Seeding Complete!');
}

seedData();
