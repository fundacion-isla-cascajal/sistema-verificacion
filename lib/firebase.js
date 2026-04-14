import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC8aP9cC6S9PvG6IjeBMMx7VucrOwPOIV0",
  authDomain: "fundacion-isla-cascajal-19ee7.firebaseapp.com",
  projectId: "fundacion-isla-cascajal-19ee7",
};

// Initialize Firebase only if it hasn't been initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
