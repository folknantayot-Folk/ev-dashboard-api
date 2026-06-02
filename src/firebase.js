import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB9Zt3rLI2qSsWPOVFkiQBc-QMovYlHYPQ",
  authDomain: "ev-dashboard-dc3dc.firebaseapp.com",
  projectId: "ev-dashboard-dc3dc",
  storageBucket: "ev-dashboard-dc3dc.firebasestorage.app",
  messagingSenderId: "69844253584",
  appId: "1:69844253584:web:652d653a3aac7fffe01115",
  measurementId: "G-GLQSJDX8E9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
