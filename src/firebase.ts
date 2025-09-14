// firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCUfBVwPGo47OkF5r8-b0X4zpxs4quK6C4",
  authDomain: "financeiro-65dd6.firebaseapp.com",
  projectId: "financeiro-65dd6",
  storageBucket: "financeiro-65dd6.firebasestorage.app",
  messagingSenderId: "668303951622",
  appId: "1:668303951622:web:8d31216963440f3de80087",
  measurementId: "G-0Y184P69KE"
};

// Inicializa Firebase App
const app = initializeApp(firebaseConfig);

// Inicializa Analytics (opcional)
const analytics = getAnalytics(app);

// Inicializa Auth e Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
