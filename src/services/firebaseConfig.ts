import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyA8QZv5ridNnpnV4Y9-xsMZi4d8RJVLyFY",
    authDomain: "rogersdb-ef29e.firebaseapp.com",
    databaseURL: "https://rogersdb-ef29e-default-rtdb.firebaseio.com",
    projectId: "rogersdb-ef29e",
    storageBucket: "rogersdb-ef29e.firebasestorage.app",
    messagingSenderId: "936110355831",
    appId: "1:936110355831:web:f82afc9cfbeeed19b65d72"
};

console.log('FirebaseConfig: Initializing Firebase App...');
const app = initializeApp(firebaseConfig);

console.log('FirebaseConfig: Initializing Auth...');
export const auth = getAuth(app);

// Initialize Firestore with settings appropriate for React Native
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
});

// Initialize Realtime Database for rental agreements
export const realtimeDb = getDatabase(app);

export const storage = getStorage(app);
