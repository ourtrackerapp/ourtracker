import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import defaultAppletConfig from '../firebase-applet-config.json';

const metaEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || defaultAppletConfig.apiKey || 'AIzaSyBwWkHo-psher-xQUkFZCiRi2xUZIoE2vA',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || defaultAppletConfig.authDomain || 'gen-lang-client-0136413843.firebaseapp.com',
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || defaultAppletConfig.projectId || 'gen-lang-client-0136413843',
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || defaultAppletConfig.storageBucket || 'gen-lang-client-0136413843.firebasestorage.app',
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultAppletConfig.messagingSenderId || '72228334805',
  appId: metaEnv.VITE_FIREBASE_APP_ID || defaultAppletConfig.appId || '1:72228334805:web:48ef515b7cbf488293465c',
};

const databaseId =
  metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  defaultAppletConfig.firestoreDatabaseId ||
  'ai-studio-df43d03e-610d-472a-82b9-07b668c9d5ea';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = databaseId
  ? getFirestore(app, databaseId)
  : getFirestore(app);

export { app };

