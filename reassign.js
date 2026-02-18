const { initializeApp } = require('firebase/app');
const { getDatabase, ref, update } = require('firebase/database');

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

async function reassign() {
    try {
        const agreementId = '-OljxDx5B4djhDMW3QSg';
        const newTechId = 'A1RbyOPeiZMJQ7AQHlmCzY4AWIh1'; // rbradfield
        const agRef = ref(db, `rentalAgreements/${agreementId}/inspectionWorkflow`);
        await update(agRef, {
            technicianId: newTechId,
            technicianName: 'Roger Bradfield'
        });
        console.log(`Successfully reassigned ${agreementId} to ${newTechId}`);
    } catch (err) {
        console.error(err);
    }
    process.exit();
}

reassign();
