import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDn6wg3UZlmMgJmLefaih7qkZdijdq8DNg",
  authDomain: "landscape-manager-8dad0.firebaseapp.com",
  projectId: "landscape-manager-8dad0",
  storageBucket: "landscape-manager-8dad0.firebasestorage.app",
  messagingSenderId: "76646331997",
  appId: "1:76646331997:web:6c27273da0dd8a4769bfb4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);