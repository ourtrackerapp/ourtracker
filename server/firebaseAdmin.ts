import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let db: Firestore;

try {
  // Em ambientes Cloud (como este), initializeApp() sem argumentos usa ADC (Application Default Credentials)
  // que é o método mais robusto e seguro.
  if (!getApps().length) {
    initializeApp();
  }
  
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const databaseId = config.firestoreDatabaseId;

    if (databaseId && databaseId !== 'default' && databaseId !== '(default)') {
      db = getFirestore(databaseId);
    } else {
      db = getFirestore();
    }
  } else {
    db = getFirestore();
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  // Segundo fallback: inicialização básica
  if (!getApps().length) {
    initializeApp();
  }
  db = getFirestore();
}

export { db };
