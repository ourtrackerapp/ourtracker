import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import defaultAppletConfig from '../firebase-applet-config.json';

const metaEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || defaultAppletConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || defaultAppletConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || defaultAppletConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || defaultAppletConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultAppletConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || defaultAppletConfig.appId,
};

const databaseId =
  metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  defaultAppletConfig.firestoreDatabaseId;

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = databaseId
  ? getFirestore(app, databaseId)
  : getFirestore(app);

export { app };
