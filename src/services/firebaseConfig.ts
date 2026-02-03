import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

// Initialize Firestore with settings appropriate for React Native
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
});

export const storage = getStorage(app);
