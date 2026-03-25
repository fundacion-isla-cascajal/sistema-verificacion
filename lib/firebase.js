import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAxcjIRGV1eg59e8fJXZZaZzLcdXfa3lQI",
  authDomain: "fundacion-isla-cascajal.firebaseapp.com",
  projectId: "fundacion-isla-cascajal",
};

// Initialize Firebase only if it hasn't been initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
