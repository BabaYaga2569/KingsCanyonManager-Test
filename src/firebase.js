import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBhnPiATK09xa0k4MrL_Fm8v6I0duDIDKo",
  authDomain: "landscape-manager-8dad0.firebaseapp.com",
  projectId: "landscape-manager-8dad0",
  storageBucket: "landscape-manager-8dad0.firebasestorage.app", // ✅ CORRECTED
  messagingSenderId: "76646331997",
  appId: "1:76646331997:web:6c27273da0dd8a4769bfb4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore
const db = getFirestore(app);

// Storage
const storage = getStorage(app);

// Collections
const bidsCollection = collection(db, "bids");

export { db, storage, bidsCollection, addDoc, getDocs, doc, deleteDoc, updateDoc };