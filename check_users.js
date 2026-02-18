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

async function checkUsers() {
    try {
        const usersRef = ref(db, 'User');
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
            const users = snapshot.val();
            console.log('--- USER LIST ---');
            Object.entries(users).forEach(([uid, data]) => {
                console.log(`UID: ${uid} | Email: ${data.email} | Name: ${data.firstName} ${data.surname}`);
            });
        } else {
            console.log('No users found in /User node');
        }
    } catch (err) {
        console.error('Error fetching users:', err);
    }
    process.exit();
}

checkUsers();
