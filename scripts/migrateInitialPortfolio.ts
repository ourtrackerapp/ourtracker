import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import defaultAppletConfig from '../firebase-applet-config.json' assert { type: 'json' };

const firebaseConfig = {
  apiKey: defaultAppletConfig.apiKey,
  authDomain: defaultAppletConfig.authDomain,
  projectId: defaultAppletConfig.projectId,
  storageBucket: defaultAppletConfig.storageBucket,
  messagingSenderId: defaultAppletConfig.messagingSenderId,
  appId: defaultAppletConfig.appId,
};

const databaseId = defaultAppletConfig.firestoreDatabaseId;
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

// Dados Reais Extratados do Relatório da Corretora
interface RawPurchase {
  dateStr: string;
  shares: number;
  priceNative: number;
  costEur: number;
  currency: string;
}

interface RawSale {
  dateStr: string;
  shares: number;
}

interface RawAsset {
  ticker: string; // Ex: SPCX.US
  normalizedTicker: string; // Ex: SPCX.US
  name: string;
  currency: 'USD' | 'EUR';
  purchases: RawPurchase[];
  sales?: RawSale[];
  expectedShares: number;
  expectedCostEur: number;
}

const REAL_DATA: RawAsset[] = [
  {
    ticker: 'SPCX.US',
    normalizedTicker: 'SPCX.US',
    name: 'SpaceX',
    currency: 'USD',
    purchases: [
      { dateStr: '2026-08-17', shares: 0.2183, priceNative: 142.80, costEur: 27.02, currency: 'USD' },
      { dateStr: '2026-09-01', shares: 0.2896, priceNative: 142.03, costEur: 35.66, currency: 'USD' },
    ],
    expectedShares: 0.5079,
    expectedCostEur: 62.68,
  },
  {
    ticker: 'SKHY.US',
    normalizedTicker: 'SKHY.US',
    name: 'SK Hynix',
    currency: 'USD',
    purchases: [
      { dateStr: '2026-08-10', shares: 0.0834, priceNative: 137.76, costEur: 10.00, currency: 'USD' },
      { dateStr: '2026-09-01', shares: 0.2451, priceNative: 161.60, costEur: 34.34, currency: 'USD' },
    ],
    expectedShares: 0.3285,
    expectedCostEur: 44.34,
  },
  {
    ticker: 'ORCL.US',
    normalizedTicker: 'ORCL.US',
    name: 'Oracle',
    currency: 'USD',
    purchases: [
      { dateStr: '2026-08-17', shares: 0.1049, priceNative: 148.93, costEur: 13.54, currency: 'USD' },
      { dateStr: '2026-09-01', shares: 0.2007, priceNative: 146.94, costEur: 25.57, currency: 'USD' },
    ],
    expectedShares: 0.3056,
    expectedCostEur: 39.11,
  },
  {
    ticker: 'GOOGL.US',
    normalizedTicker: 'GOOGL.US',
    name: 'Alphabet',
    currency: 'USD',
    purchases: [
      { dateStr: '2026-08-17', shares: 0.0567, priceNative: 345.51, costEur: 16.98, currency: 'USD' },
      { dateStr: '2026-09-01', shares: 0.0749, priceNative: 336.02, costEur: 21.82, currency: 'USD' },
    ],
    expectedShares: 0.1316,
    expectedCostEur: 38.80,
  },
  {
    ticker: 'SKM.US',
    normalizedTicker: 'SKM.US',
    name: 'SK Telecom',
    currency: 'USD',
    purchases: [
      { dateStr: '2026-08-10', shares: 0.3866, priceNative: 33.56, costEur: 11.30, currency: 'USD' },
      { dateStr: '2026-09-01', shares: 0.7820, priceNative: 37.98, costEur: 25.75, currency: 'USD' },
    ],
    expectedShares: 1.1686,
    expectedCostEur: 37.05,
  },
  {
    ticker: 'LEU.US',
    normalizedTicker: 'LEU.US',
    name: 'Centrus Energy',
    currency: 'USD',
    purchases: [
      { dateStr: '2026-08-05', shares: 0.0922, priceNative: 186.99, costEur: 14.99, currency: 'USD' },
      { dateStr: '2026-08-07', shares: 0.0740, priceNative: 188.00, costEur: 12.08, currency: 'USD' },
      { dateStr: '2026-09-01', shares: 0.1675, priceNative: 168.09, costEur: 24.41, currency: 'USD' },
    ],
    sales: [
      { dateStr: '2026-08-10', shares: 0.0700 },
    ],
    expectedShares: 0.2637,
    expectedCostEur: 40.08, // calculado via FIFO: lote 1 sobram 0.0222 un (€3.61) + lote 2 (€12.08) + lote 3 (€24.41) = €40.10
  },
  {
    ticker: 'AMZN.US',
    normalizedTicker: 'AMZN.US',
    name: 'Amazon',
    currency: 'USD',
    purchases: [
      { dateStr: '2026-08-17', shares: 0.0613, priceNative: 262.93, costEur: 13.97, currency: 'USD' },
      { dateStr: '2026-09-01', shares: 0.0858, priceNative: 255.00, costEur: 18.97, currency: 'USD' },
    ],
    expectedShares: 0.1471,
    expectedCostEur: 32.94,
  },
  {
    ticker: 'VVSM.DE',
    normalizedTicker: 'VVSM.DE',
    name: 'Semiconductor ETF',
    currency: 'EUR',
    purchases: [
      { dateStr: '2026-07-31', shares: 0.3361, priceNative: 89.240, costEur: 29.99, currency: 'EUR' },
      { dateStr: '2026-08-03', shares: 0.2737, priceNative: 89.510, costEur: 24.50, currency: 'EUR' },
      { dateStr: '2026-09-01', shares: 0.4453, priceNative: 89.830, costEur: 40.00, currency: 'EUR' },
    ],
    expectedShares: 1.0551,
    expectedCostEur: 94.49,
  },
  {
    ticker: 'SXR8.DE',
    normalizedTicker: 'SXR8.DE',
    name: 'Core S&P 500',
    currency: 'EUR',
    purchases: [
      { dateStr: '2026-07-31', shares: 0.2800, priceNative: 696.34, costEur: 194.98, currency: 'EUR' },
      { dateStr: '2026-09-01', shares: 0.2705, priceNative: 713.82, costEur: 193.09, currency: 'EUR' },
    ],
    expectedShares: 0.5505,
    expectedCostEur: 388.07,
  },
];

async function runMigration() {
  console.log('🚀 Iniciando script de migração inicial idempotente...');

  let totalInserted = 0;
  let totalIgnored = 0;

  const summaryResults: Array<{
    ticker: string;
    shares: number;
    costEur: number;
    purchasesCount: number;
    salesCount: number;
  }> = [];

  for (const asset of REAL_DATA) {
    const docRef = doc(db, 'portfolios', 'main', 'holdings', asset.normalizedTicker);
    const existingSnap = await getDoc(docRef);

    let existingPurchases: any[] = [];
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      if (Array.isArray(data.purchases)) {
        existingPurchases = data.purchases;
      }
    }

    // 1. Reconstruir a lista completa de compras originais a partir da especificação determinística
    const basePurchasesMap = new Map<string, any>();

    let insertedCount = 0;
    let ignoredCount = 0;

    // Se já existiam registos no Firestore com IDs determinísticos, identificamos quais já foram migrados
    const existingIds = new Set(existingPurchases.map((p) => p.id).filter(Boolean));

    // Processar cada compra original declarada
    for (const p of asset.purchases) {
      const detId = `tx-${asset.normalizedTicker}-buy-${p.dateStr}-${p.shares}-${p.priceNative}`;
      const timestamp = new Date(p.dateStr).getTime();
      const priceEur = Number((p.costEur / p.shares).toFixed(4));
      const rawPurchaseRecord = {
        id: detId,
        date: timestamp,
        shares: p.shares,
        price: p.priceNative,
        priceEur: priceEur,
        totalCostEur: p.costEur,
        currency: p.currency,
      };

      basePurchasesMap.set(detId, rawPurchaseRecord);

      if (existingIds.has(detId)) {
        ignoredCount++;
      } else {
        insertedCount++;
      }
    }

    const allOriginalPurchases = Array.from(basePurchasesMap.values());
    allOriginalPurchases.sort((a, b) => Number(a.date) - Number(b.date));

    // 2. Montar lotes FIFO do zero com base em TODAS as compras originais
    const activeLots: Array<{
      id: string;
      shares: number;
      priceNative: number;
      priceEur: number;
      totalCostEur: number;
      date: number;
      currency: string;
    }> = allOriginalPurchases.map((p) => ({
      id: p.id,
      shares: Number(p.shares),
      priceNative: Number(p.price || 0),
      priceEur: Number(p.priceEur || 0),
      totalCostEur: Number(p.totalCostEur || p.priceEur * p.shares),
      date: Number(p.date),
      currency: p.currency || asset.currency,
    }));

    // 3. Processar Vendas (dedução exata FIFO uma única vez sobre os lotes brutas)
    let salesCount = 0;
    if (asset.sales && asset.sales.length > 0) {
      for (const sale of asset.sales) {
        salesCount++;
        let sharesToSell = sale.shares;

        for (let i = 0; i < activeLots.length && sharesToSell > 0; i++) {
          const lot = activeLots[i];
          if (lot.shares <= 0) continue;

          if (lot.shares <= sharesToSell) {
            sharesToSell = Number((sharesToSell - lot.shares).toFixed(6));
            lot.shares = 0;
            lot.totalCostEur = 0;
          } else {
            const costPerShare = lot.totalCostEur / lot.shares;
            lot.shares = Number((lot.shares - sharesToSell).toFixed(6));
            lot.totalCostEur = Number((lot.shares * costPerShare).toFixed(2));
            sharesToSell = 0;
          }
        }
      }
    }

    // 4. Calcular Quantidade Final de Ações e Custo Restante em EUR
    const finalShares = Number(activeLots.reduce((sum, l) => sum + l.shares, 0).toFixed(4));
    const finalCostEur = Number(activeLots.reduce((sum, l) => sum + l.totalCostEur, 0).toFixed(2));

    const updatedPurchasesRecords = activeLots
      .filter((l) => l.shares > 0)
      .map((l) => ({
        id: l.id,
        date: l.date,
        shares: Number(l.shares.toFixed(6)),
        price: l.priceNative,
        priceEur: Number(l.priceEur.toFixed(4)),
        totalCostEur: Number(l.totalCostEur.toFixed(2)),
        currency: l.currency,
      }));

    // Gravar no Firestore
    const dataToSave: any = {
      ticker: asset.normalizedTicker,
      shares: finalShares,
      createdAt: Date.now(),
      purchases: updatedPurchasesRecords,
    };
    if (existingSnap.exists() && existingSnap.data()?.color) {
      dataToSave.color = existingSnap.data()?.color;
    }

    await setDoc(docRef, dataToSave, { merge: true });

    totalInserted += insertedCount;
    totalIgnored += ignoredCount;

    summaryResults.push({
      ticker: asset.normalizedTicker,
      shares: finalShares,
      costEur: finalCostEur,
      purchasesCount: asset.purchases.length,
      salesCount: salesCount,
    });

    console.log(
      `✓ [${asset.normalizedTicker}] Migrado | Inseridas: ${insertedCount}, Ignoradas: ${ignoredCount} | Qtd Final: ${finalShares} | Custo EUR: €${finalCostEur}`
    );
  }

  console.log('\n==================================================');
  console.log('RESUMO DA MIGRAÇÃO');
  console.log('==================================================');
  console.log(`Total de novas transações inseridas: ${totalInserted}`);
  console.log(`Total de transações ignoradas (idempotência): ${totalIgnored}`);
  console.log('\nTABELA DE VALIDAÇÃO:');
  console.log('Ticker | Quantidade | Custo EUR | Nº compras | Nº vendas');
  console.log('---------------------------------------------------------');
  summaryResults.forEach((r) => {
    console.log(
      `${r.ticker.padEnd(8)} | ${r.shares.toFixed(4).padStart(10)} | €${r.costEur.toFixed(2).padStart(8)} | ${String(r.purchasesCount).padStart(10)} | ${String(r.salesCount).padStart(9)}`
    );
  });
  console.log('==================================================\n');
}

runMigration().catch((err) => {
  console.error('❌ Erro na migração:', err);
  process.exit(1);
});
