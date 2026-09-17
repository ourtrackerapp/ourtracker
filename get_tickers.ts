
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listTickers() {
  const holdingsCol = collection(db, 'portfolios', 'main', 'holdings');
  const snapshot = await getDocs(holdingsCol);
  const tickers = snapshot.docs.map(doc => doc.id);
  console.log(JSON.stringify(tickers));
}

listTickers().catch(console.error);
