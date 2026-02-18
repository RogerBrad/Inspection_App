const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

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
const db = getDatabase(app);

async function inspectAgreements() {
    try {
        const agRef = ref(db, 'rentalAgreements');
        const snapshot = await get(agRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('--- ALL RENTAL AGREEMENTS (SUMMARY) ---');
            Object.entries(data).forEach(([id, ag]) => {
                const status = ag.inspectionWorkflow?.status;
                const techId = ag.inspectionWorkflow?.technicianId;
                const asset = ag.assetDetails?.assetName || ag.assetDetails?.serialNumber || 'Unknown';
                console.log(`ID: ${id} | Asset: ${asset} | Status: ${status} | TechUID: ${techId}`);
            });
        }
    } catch (err) {
        console.error(err);
    }
    process.exit();
}

inspectAgreements();
