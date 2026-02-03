const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyA8QZv5ridNnpnV4Y9-xsMZi4d8RJVLyFY",
    authDomain: "rogersdb-ef29e.firebaseapp.com",
    databaseURL: "https://rogersdb-ef29e-default-rtdb.firebaseio.com",
    projectId: "rogersdb-ef29e",
    storageBucket: "rogersdb-ef29e.firebasestorage.app",
    messagingSenderId: "936110355831",
    appId: "1:936110355831:web:f82afc9cfbeeed19b65d72"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTION_NAME = 'InspectionConfigs';

async function seedData() {
    console.log("Seeding Hierarchical Inspection Configurations...");

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

    try {
        for (const config of configs) {
            await setDoc(doc(db, COLLECTION_NAME, config.category), config);
            console.log(`- Seeded category: ${config.category}`);
        }
        console.log("Seeding Complete!");
    } catch (error) {
        console.error("Seeding Failed:", error);
    }
}

seedData();
