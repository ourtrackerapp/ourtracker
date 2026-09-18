import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const env: Record<string, string | undefined> = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env as any) : {};

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || 'ai-studio-df43d03e-610d-472a-82b9-07b668c9d5ea',
};

const databaseId = env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;

const app = !getApps().length ? initializeApp(config) : getApp();

export const db = (databaseId && databaseId !== '(default)' && databaseId !== 'default')
  ? getFirestore(app, databaseId)
  : getFirestore(app);

export { app };


