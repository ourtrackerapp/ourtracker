import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAortZSvMOJwHAuXAGYBssOnK3qhiOKlXY",
  authDomain: "ourtracker-15a80.firebaseapp.com",
  projectId: "ourtracker-15a80",
  storageBucket: "ourtracker-15a80.firebasestorage.app",
  messagingSenderId: "751020239176",
  appId: "1:751020239176:web:428ba1a60a127f34256b7d",
  measurementId: "G-ZKY8RVV7JW"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

export { app };


