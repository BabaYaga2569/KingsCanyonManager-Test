import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBhnPiATK09xa0k4MrL_Fm8v6I0duDIDKo",
  authDomain: "landscape-manager-8dad0.firebaseapp.com",
  projectId: "landscape-manager-8dad0",
  storageBucket: "landscape-manager-8dad0.firebasestorage.app",
  messagingSenderId: "76646331997",
  appId: "1:76646331997:web:6c27273da0dd8a4769bfb4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);