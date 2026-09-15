import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { HoldingDoc, PortfolioPosition, PurchaseRecord } from '../types';
import { convertTickerToYahoo } from '../utils/yahooClient';

// High-contrast, maximally distinct color palette ensuring adjacent and overall colors are never identical or confusing
export const DISTINCT_PALETTE = [
  '#2563EB', // Royal Blue
  '#EA580C', // Vibrant Orange
  '#16A34A', // Emerald Green
  '#9333EA', // Purple
  '#E11D48', // Ruby Red
  '#0D9488', // Teal
  '#D97706', // Amber / Warm Gold
  '#4F46E5', // Indigo
  '#65A30D', // Lime Green
  '#DB2777', // Hot Pink
  '#0284C7', // Sky Blue
  '#B45309', // Cinnamon Bronze
  '#7C3AED', // Electric Violet
  '#059669', // Dark Forest Mint
  '#DC2626', // Crimson Red
  '#0891B2', // Cyan
  '#C026D3', // Fuchsia
  '#84CC16', // Chartreuse
  '#1D4ED8', // Deep Cobalt
  '#F59E0B', // Bright Yellow
  '#8B5CF6', // Soft Lavender
  '#10B981', // Aqua Green
  '#F43F5E', // Rose
  '#334155', // Slate Navy
];

export function getDistinctColor(index: number): string {
  if (index < DISTINCT_PALETTE.length) {
    return DISTINCT_PALETTE[index];
  }
  const hue = Math.round((index * 137.5077) % 360);
  return `hsl(${hue}, 82%, 46%)`;
}

// Cache no cliente para cotações com carimbo de data/hora (exatamente 5 minutos = 300.000 ms)
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
const clientQuotesCache = new Map<string, { data: any; timestamp: number }>();

// Guarda a última cotação válida com sucesso para nunca perder dados em caso de erro temporário
const lastKnownGoodQuotes = new Map<string, any>();

// Registo do timestamp da última recolha com sucesso (em ms)
let lastSuccessfulQuoteUpdate = 0;

export function getLastSuccessfulQuoteUpdate(): number {
  return lastSuccessfulQuoteUpdate;
}

export function invalidateClientQuotesCache(): void {
  clientQuotesCache.clear();
}

/**
 * Procura uma cotação no mapa de cotações testando o ticker original,
 * sem sufixo, com sufixo .US ou através de correspondência insensível a maiúsculas/minúsculas.
 */
export function findQuoteForTicker(quotes: Record<string, any>, rawTicker: string): any | null {
  if (!quotes || !rawTicker) return null;
  const t = rawTicker.trim().toUpperCase();
  if (quotes[t]) return quotes[t];

  const noSuffix = t.endsWith('.US')
    ? t.replace(/\.US$/i, '')
    : t.includes('.')
    ? t.split('.')[0]
    : t;
  if (quotes[noSuffix]) return quotes[noSuffix];

  const withUs = `${noSuffix}.US`;
  if (quotes[withUs]) return quotes[withUs];

  // Match por varredura de chaves
  const keys = Object.keys(quotes);
  const foundKey = keys.find((k) => {
    const kClean = k.trim().toUpperCase();
    return kClean === t || kClean === noSuffix || kClean === withUs;
  });

  return foundKey ? quotes[foundKey] : null;
}

// Cotações em tempo real com política: 5 min cache, forceRefresh para atualizar imediatamente
export async function fetchLiveQuotes(
  tickers: string[],
  forceRefresh: boolean = false
): Promise<Record<string, any>> {
  if (!tickers || !tickers.length) return {};

  const now = Date.now();
  const normalizedTickers = tickers.map((t) => t.trim().toUpperCase());
  
  const result: Record<string, any> = {};
  const tickersToFetch: string[] = [];

  normalizedTickers.forEach((ticker) => {
    const cached = clientQuotesCache.get(ticker) || clientQuotesCache.get(ticker.replace(/\.US$/i, ''));
    if (!forceRefresh && cached && now - cached.timestamp < CLIENT_CACHE_TTL_MS && !cached.data?.error) {
      result[ticker] = cached.data;
    } else {
      tickersToFetch.push(ticker);
    }
  });

  // Se todos os tickers solicitados já estiverem válidos na cache de 5 minutos, devolve imediatamente sem chamada de rede
  if (tickersToFetch.length === 0) {
    return result;
  }

  try {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers: tickersToFetch }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const fetchedQuotes: Record<string, any> = data.quotes || {};

    let hasSuccess = false;
    tickersToFetch.forEach((ticker) => {
      const q = findQuoteForTicker(fetchedQuotes, ticker);
      const noSuffix = ticker.replace(/\.US$/i, '');
      const withUs = `${noSuffix}.US`;

      if (q && !q.error && q.priceInEur > 0) {
        // Sucesso: atualiza cache de 5 minutos e última cotação conhecida
        const formattedQuote = { ...q, ticker };
        clientQuotesCache.set(ticker, { data: formattedQuote, timestamp: now });
        clientQuotesCache.set(noSuffix, { data: formattedQuote, timestamp: now });
        clientQuotesCache.set(withUs, { data: formattedQuote, timestamp: now });

        lastKnownGoodQuotes.set(ticker, formattedQuote);
        lastKnownGoodQuotes.set(noSuffix, formattedQuote);
        lastKnownGoodQuotes.set(withUs, formattedQuote);

        result[ticker] = formattedQuote;
        result[noSuffix] = formattedQuote;
        result[withUs] = formattedQuote;
        hasSuccess = true;
      } else {
        // Se a chamada falhou ou deu erro mas temos um lastKnownGoodQuote, usamos o último preço válido
        const fallback =
          lastKnownGoodQuotes.get(ticker) ||
          lastKnownGoodQuotes.get(noSuffix) ||
          lastKnownGoodQuotes.get(withUs) ||
          clientQuotesCache.get(ticker)?.data;

        if (fallback && !fallback.error && fallback.priceInEur > 0) {
          result[ticker] = fallback;
          result[noSuffix] = fallback;
          result[withUs] = fallback;
          clientQuotesCache.set(ticker, { data: fallback, timestamp: now });
        } else {
          const errQuote = q || {
            error: true,
            errorMessage: 'Cotação indisponível',
          };
          result[ticker] = errQuote;
          result[noSuffix] = errQuote;
          result[withUs] = errQuote;
        }
      }
    });

    if (hasSuccess) {
      lastSuccessfulQuoteUpdate = now;
    }

    return result;
  } catch (err) {
    console.warn('Erro ao obter cotações em tempo real:', err);
    // Em caso de falha de rede temporária, recupera de imediato os lastKnownGoodQuotes
    tickersToFetch.forEach((ticker) => {
      const fallback =
        lastKnownGoodQuotes.get(ticker) ||
        lastKnownGoodQuotes.get(ticker.replace(/\.US$/i, '')) ||
        clientQuotesCache.get(ticker)?.data;

      if (fallback && !fallback.error && fallback.priceInEur > 0) {
        result[ticker] = fallback;
      } else {
        result[ticker] = {
          error: true,
          errorMessage: 'Cotação indisponível',
        };
      }
    });
    return result;
  }
}

// Subscrição em direto no Firestore (sem localStorage)
export function subscribeUserHoldings(
  portfolioId: string = 'main',
  onUpdate: (holdings: HoldingDoc[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const holdingsRef = collection(db, 'portfolios', portfolioId, 'holdings');
  const q = query(holdingsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const holdings: HoldingDoc[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        holdings.push({
          id: docSnap.id,
          ticker: data.ticker || docSnap.id,
          shares: Number(data.shares || 0),
          createdAt: Number(data.createdAt || Date.now()),
          color: data.color,
          purchases: Array.isArray(data.purchases)
            ? data.purchases.map((p: any) => ({
                id: p.id,
                date: typeof p.date === 'string' ? new Date(p.date).getTime() : Number(p.date || data.createdAt || Date.now()),
                shares: Number(p.shares || 0),
                price: p.price !== undefined ? Number(p.price) : undefined,
                priceEur: p.priceEur !== undefined ? Number(p.priceEur) : (p.totalCostEur && p.shares ? Number(p.totalCostEur) / Number(p.shares) : undefined),
                currency: p.currency,
                totalCostEur: p.totalCostEur !== undefined ? Number(p.totalCostEur) : undefined,
                feeEur: p.feeEur !== undefined ? Number(p.feeEur) : undefined,
              }))
            : undefined,
        });
      });
      onUpdate(holdings);
    },
    (err) => {
      console.warn('Firestore subscription status:', err.message || err);
      if (onError) onError(err);
    }
  );
}

export async function saveHolding(
  portfolioId: string = 'main',
  ticker: string,
  shares: number,
  color?: string,
  purchases?: any[]
): Promise<void> {
  const normalizedTicker = convertTickerToYahoo(ticker.trim()).toUpperCase();
  const rawTicker = ticker.trim().toUpperCase();

  if (rawTicker !== normalizedTicker && rawTicker.endsWith('.US')) {
    try {
      await deleteDoc(doc(db, 'portfolios', portfolioId, 'holdings', rawTicker));
    } catch (_) {}
  }

  const docRef = doc(db, 'portfolios', portfolioId, 'holdings', normalizedTicker);
  const dataToSave: any = {
    ticker: normalizedTicker,
    shares: Number(shares),
    createdAt: Date.now(),
    color: color || DISTINCT_PALETTE[Math.floor(Math.random() * DISTINCT_PALETTE.length)],
  };
  if (purchases && purchases.length > 0) {
    dataToSave.purchases = purchases;
  }
  await setDoc(docRef, dataToSave, { merge: true });
}

export async function uploadClientPortfolioToCloud(
  portfolioId: string = 'main',
  portfolioData: {
    totalDeposited: number;
    oldestDepositDate: Date | null;
    positions: Array<{
      ticker: string;
      yahooTicker: string;
      name: string;
      category: string;
      volume: number;
      value: number;
      openPrice: number;
      purchases?: PurchaseRecord[];
    }>;
  }
): Promise<void> {
  try {
    const holdingsRef = collection(db, 'portfolios', portfolioId, 'holdings');
    const existingSnap = await getDocs(holdingsRef);
    const deletePromises = existingSnap.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
  } catch (cleanErr) {
    console.warn('Aviso ao limpar posições antigas antes do upload:', cleanErr);
  }

  const depositsList = portfolioData.oldestDepositDate
    ? [
        {
          date: portfolioData.oldestDepositDate.toLocaleDateString('pt-PT'),
          amount: portfolioData.totalDeposited,
        },
      ]
    : [];

  await savePortfolioMeta(portfolioId, {
    totalDeposited: portfolioData.totalDeposited,
    currency: 'EUR',
    deposits: depositsList,
  });

  for (let i = 0; i < portfolioData.positions.length; i++) {
    const pos = portfolioData.positions[i];
    const tickerToUse = (pos.yahooTicker || pos.ticker).trim().toUpperCase();

    let purchaseRecords: PurchaseRecord[] = [];
    if (pos.purchases && pos.purchases.length > 0) {
      purchaseRecords = pos.purchases.map((p, pIdx) => ({
        id: p.id || `p-${Date.now()}-${i}-${pIdx}`,
        date: typeof p.date === 'string' ? new Date(p.date).getTime() : Number(p.date),
        shares: Number(p.shares),
        price: Number(p.price ?? pos.openPrice ?? 0),
        priceEur: Number(p.priceEur ?? p.price ?? pos.openPrice ?? 0),
      }));
    } else {
      purchaseRecords = [
        {
          id: `p-${Date.now()}-${i}`,
          date: portfolioData.oldestDepositDate ? portfolioData.oldestDepositDate.getTime() : Date.now(),
          shares: Number(pos.volume),
          price: Number(pos.openPrice || 0),
          priceEur: Number(pos.openPrice || 0),
        },
      ];
    }

    await saveHolding(
      portfolioId,
      tickerToUse,
      Number(pos.volume),
      DISTINCT_PALETTE[i % DISTINCT_PALETTE.length],
      purchaseRecords
    );
  }
}

export async function removeHolding(portfolioId: string = 'main', ticker: string): Promise<void> {
  const docRef = doc(db, 'portfolios', portfolioId, 'holdings', ticker.trim().toUpperCase());
  await deleteDoc(docRef);
}

// Cálculo do portfólio em tempo real exclusivamente em Euros (€)
export function computePortfolio(
  holdings: HoldingDoc[],
  quotes: Record<string, any>
): {
  totalValue: number;
  totalInvested: number;
  totalProfitEur: number;
  totalReturnPercent?: number;
  currencySymbol: string;
  positionsCount: number;
  positions: PortfolioPosition[];
} {
  if (!holdings || !holdings.length) {
    return {
      totalValue: 0,
      totalInvested: 0,
      totalProfitEur: 0,
      totalReturnPercent: undefined,
      currencySymbol: '€',
      positionsCount: 0,
      positions: [],
    };
  }

  // 1. Consolidação de posições pelo ticker normalizado
  const consolidatedMap = new Map<string, {
    id: string;
    ticker: string;
    shares: number;
    color?: string;
    createdAt?: number;
    purchases?: PurchaseRecord[];
  }>();

  holdings.forEach((holding) => {
    const normTicker = convertTickerToYahoo(holding.ticker.trim()).toUpperCase();
    const holdingPurchases = Array.isArray(holding.purchases) ? holding.purchases : [];
    if (consolidatedMap.has(normTicker)) {
      const existing = consolidatedMap.get(normTicker)!;
      const oldestCreated = existing.createdAt && holding.createdAt
        ? Math.min(existing.createdAt, holding.createdAt)
        : existing.createdAt || holding.createdAt;
      consolidatedMap.set(normTicker, {
        ...existing,
        shares: existing.shares + Number(holding.shares || 0),
        createdAt: oldestCreated,
        purchases: [...(existing.purchases || []), ...holdingPurchases],
      });
    } else {
      consolidatedMap.set(normTicker, {
        id: holding.id,
        ticker: normTicker,
        shares: Number(holding.shares || 0),
        color: holding.color,
        createdAt: holding.createdAt,
        purchases: [...holdingPurchases],
      });
    }
  });

  const consolidatedHoldings = Array.from(consolidatedMap.values());

  let totalPortfolioValue = 0;
  let totalPortfolioInvested = 0;
  const rawPositions: PortfolioPosition[] = [];

  consolidatedHoldings.forEach((holding, idx) => {
    const key = holding.ticker.trim().toUpperCase();
    const quote = findQuoteForTicker(quotes, key);
    const isError = !quote || Boolean(quote.error) || !quote.priceInEur || Number(quote.priceInEur) <= 0;

    const currentPriceInEur = isError ? 0 : Number(quote.priceInEur);
    const nativePrice = isError ? 0 : Number(quote.price || 0);
    const nativeCurrency = isError ? 'EUR' : (quote.currency || 'EUR');
    const fxRateToEur = isError ? 1.0 : Number(quote.fxRateToEur || 1.0);
    const name = quote?.name || holding.ticker;
    const changePercent = isError ? undefined : quote?.changePercent;
    const monthReturnPercent = isError ? undefined : quote?.monthReturnPercent;
    const fallbackColor = holding.color || getDistinctColor(idx);

    const totalShares = Number(holding.shares || 0);

    // Determinar data da primeira compra real (data mais antiga de todas as compras válidas)
    const purchases = holding.purchases || [];
    let firstPurchaseTimestamp: number | undefined = undefined;
    let firstPurchaseDate: string | undefined = undefined;

    const validPurchaseDates = purchases
      .map((p) => (typeof p.date === 'string' ? new Date(p.date).getTime() : Number(p.date)))
      .filter((d) => !isNaN(d) && d > 0);

    if (validPurchaseDates.length > 0) {
      firstPurchaseTimestamp = Math.min(...validPurchaseDates);
      const d = new Date(firstPurchaseTimestamp);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      firstPurchaseDate = `${day}/${month}/${year}`;
    } else if (holding.createdAt && holding.createdAt > 0) {
      firstPurchaseTimestamp = holding.createdAt;
      const d = new Date(firstPurchaseTimestamp);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      firstPurchaseDate = `${day}/${month}/${year}`;
    }

    // 1. Capital Investido: Σ(custo_real_de_cada_compra_em_EUR)
    // Se o ativo for em moeda estrangeira (USD, GBP, etc.):
    // - Se totalCostEur estiver gravado, usa totalCostEur.
    // - Se priceEur for fornecido e diferente do preço nativo, usa priceEur.
    // - Se o preço estiver na moeda nativa ou priceEur for idêntico ao preço nativo para ativo não-EUR,
    //   aplica a taxa cambial (fxRateToEur) para não tratar USD/GBP como EUR.
    // - Ativos em GBP cotados em pence (GBp) são devidamente normalizados (/ 100).
    const isForeignCurrency = nativeCurrency !== 'EUR';
    const isPence = nativeCurrency === 'GBP' && (quote?.currency === 'GBp' || (quote?.price && quote?.price > 500 && holding.ticker.endsWith('.L')));

    let totalInvested = 0;
    purchases.forEach((p) => {
      const sh = Number(p.shares || 0);
      if (sh <= 0) return;

      const fee = Number(p.feeEur || 0);

      // Prioridade 1: Custo total em EUR explicitamente registado
      if (p.totalCostEur !== undefined && Number(p.totalCostEur) > 0) {
        totalInvested += Number(p.totalCostEur) + fee;
        return;
      }

      const rawPrice = Number(p.price || 0);
      const rawPriceEur = Number(p.priceEur || 0);

      if (isForeignCurrency) {
        // Se a moeda do ativo for estrangeira (ex: USD):
        // Se priceEur existir e for diferente de price, o utilizador/sistema já converteu historicamente para EUR
        if (rawPriceEur > 0 && rawPrice > 0 && Math.abs(rawPriceEur - rawPrice) > 0.001) {
          totalInvested += sh * rawPriceEur + fee;
        } else {
          // Se priceEur == price ou apenas price existe, o valor armazenado é em moeda nativa (ex: 142.34 USD).
          // NUNCA tratar esse valor como EUR! Converte para EUR usando a taxa cambial do ativo.
          let effectiveNativePrice = rawPrice > 0 ? rawPrice : rawPriceEur;
          if (isPence) {
            effectiveNativePrice = effectiveNativePrice / 100;
          }
          const priceConvertedToEur = effectiveNativePrice * fxRateToEur;
          totalInvested += sh * priceConvertedToEur + fee;
        }
      } else {
        // Ativo nativo em EUR: não há conversão cambial
        const pPrice = rawPriceEur > 0 ? rawPriceEur : rawPrice;
        if (pPrice > 0) {
          totalInvested += sh * pPrice + fee;
        }
      }
    });

    // 2. Preço Médio Ponderado em EUR
    const averagePrice = totalShares > 0 && totalInvested > 0 ? totalInvested / totalShares : 0;

    // 3. Valor Atual em EUR: quantidadeTotal × preçoAtualEmEUR
    const currentValue = isError || totalShares <= 0 ? 0 : totalShares * currentPriceInEur;

    // 4. Lucro/Prejuízo: currentValue - totalInvested
    const profitEur = !isError && totalInvested > 0 ? currentValue - totalInvested : 0;

    // 5. Rentabilidade (%): (profitEur / totalInvested) * 100
    let totalReturnPercent: number | undefined = undefined;
    if (!isError && totalShares > 0 && totalInvested > 0 && currentPriceInEur > 0) {
      totalReturnPercent = Number(((profitEur / totalInvested) * 100).toFixed(2));
    }

    if (!isError && totalShares > 0) {
      totalPortfolioValue += currentValue;
      if (totalInvested > 0) {
        totalPortfolioInvested += totalInvested;
      }
    }

    rawPositions.push({
      id: holding.id,
      ticker: holding.ticker,
      name,
      shares: totalShares,
      currentPrice: currentPriceInEur,
      nativePrice,
      nativeCurrency,
      fxRateToEur,
      value: Number(currentValue.toFixed(2)),
      totalInvested: Number(totalInvested.toFixed(2)),
      averagePrice: Number(averagePrice.toFixed(4)),
      profitEur: Number(profitEur.toFixed(2)),
      allocationPercent: 0,
      changePercent,
      monthReturnPercent,
      totalReturnPercent,
      firstPurchaseDate,
      firstPurchaseTimestamp,
      color: fallbackColor,
      isError,
      errorMessage: isError ? (quote?.errorMessage || 'Cotação indisponível') : undefined,
    });
  });

  const positions: PortfolioPosition[] = rawPositions
    .map((p) => ({
      ...p,
      allocationPercent: totalPortfolioValue > 0 && !p.isError ? Number(((p.value / totalPortfolioValue) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => {
      if (a.isError && !b.isError) return 1;
      if (!a.isError && b.isError) return -1;
      return b.value - a.value;
    })
    .map((p, index) => ({
      ...p,
      color: p.isError ? '#EF4444' : getDistinctColor(index),
    }));

  const totalProfitEur = totalPortfolioValue - totalPortfolioInvested;
  const portfolioReturnPercent =
    totalPortfolioInvested > 0 ? Number(((totalProfitEur / totalPortfolioInvested) * 100).toFixed(2)) : undefined;

  return {
    totalValue: Number(totalPortfolioValue.toFixed(2)),
    totalInvested: Number(totalPortfolioInvested.toFixed(2)),
    totalProfitEur: Number(totalProfitEur.toFixed(2)),
    totalReturnPercent: portfolioReturnPercent,
    currencySymbol: '€',
    positionsCount: positions.length,
    positions,
  };
}

export async function savePortfolioMeta(
  portfolioId: string = 'main',
  meta: {
    currency?: string;
    totalDeposited?: number;
    account?: string;
    deposits?: Array<{ id?: string; date: string; amount: number }>;
  }
): Promise<void> {
  const metaWithTimestamp = { ...meta, updatedAt: Date.now() };
  const docRef = doc(db, 'portfolios', portfolioId);
  await setDoc(docRef, metaWithTimestamp, { merge: true });
}

export async function fetchPortfolioMeta(portfolioId: string = 'main') {
  try {
    const metaRef = doc(db, 'portfolios', portfolioId);
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists()) {
      return metaSnap.data();
    }
  } catch (err) {
    console.warn('fetchPortfolioMeta Firestore warning:', err);
  }
  return null;
}

export interface BackupDoc {
  id: string;
  timestamp: number;
  formattedDate: string;
  holdingsCount: number;
  holdings: HoldingDoc[];
  meta?: any;
}

export function formatDateTimeNoSeconds(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export async function createCloudBackup(portfolioId: string = 'main'): Promise<BackupDoc> {
  const holdingsRef = collection(db, 'portfolios', portfolioId, 'holdings');
  const holdingsSnap = await getDocs(holdingsRef);
  const holdings: HoldingDoc[] = [];
  holdingsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    holdings.push({
      id: docSnap.id,
      ticker: data.ticker || docSnap.id,
      shares: Number(data.shares || 0),
      createdAt: Number(data.createdAt || Date.now()),
      color: data.color,
      purchases: data.purchases || [],
    });
  });

  const metaRef = doc(db, 'portfolios', portfolioId);
  const metaSnap = await getDoc(metaRef);
  const meta = metaSnap.exists() ? metaSnap.data() : null;

  const ts = Date.now();
  const formattedDate = formatDateTimeNoSeconds(ts);
  const backupId = `backup_${ts}`;

  const backupRef = doc(db, 'portfolios', portfolioId, 'backups', backupId);
  const rawBackupData: BackupDoc = {
    id: backupId,
    timestamp: ts,
    formattedDate,
    holdingsCount: holdings.length,
    holdings,
    meta,
  };

  // Strip any undefined values to avoid Firestore "Unsupported field value: undefined" errors
  const backupData = JSON.parse(JSON.stringify(rawBackupData));

  await setDoc(backupRef, backupData);
  await pruneCloudBackups(portfolioId, 5);
  return backupData;
}

export async function pruneCloudBackups(portfolioId: string = 'main', maxKeep = 5): Promise<void> {
  const backupsRef = collection(db, 'portfolios', portfolioId, 'backups');
  const q = query(backupsRef, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);

  if (snap.docs.length > maxKeep) {
    const docsToDelete = snap.docs.slice(maxKeep);
    for (const d of docsToDelete) {
      await deleteDoc(d.ref);
    }
  }
}

export async function fetchCloudBackups(portfolioId: string = 'main'): Promise<BackupDoc[]> {
  const backupsRef = collection(db, 'portfolios', portfolioId, 'backups');
  const q = query(backupsRef, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  const list: BackupDoc[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as BackupDoc;
    list.push({
      id: docSnap.id,
      timestamp: data.timestamp || Date.now(),
      formattedDate: data.formattedDate || formatDateTimeNoSeconds(data.timestamp || Date.now()),
      holdingsCount: data.holdingsCount !== undefined ? data.holdingsCount : (data.holdings ? data.holdings.length : 0),
      holdings: data.holdings || [],
      meta: data.meta,
    });
  });
  return list.slice(0, 5);
}

export async function restoreCloudBackup(backup: BackupDoc, portfolioId: string = 'main'): Promise<void> {
  const holdingsRef = collection(db, 'portfolios', portfolioId, 'holdings');
  const snap = await getDocs(holdingsRef);
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }

  for (const h of backup.holdings) {
    const docRef = doc(db, 'portfolios', portfolioId, 'holdings', h.ticker.trim().toUpperCase());
    const rawData = {
      ticker: h.ticker.trim().toUpperCase(),
      shares: Number(h.shares || 0),
      createdAt: h.createdAt || Date.now(),
      color: h.color,
      purchases: h.purchases || [],
    };
    await setDoc(docRef, JSON.parse(JSON.stringify(rawData)));
  }

  if (backup.meta) {
    const metaRef = doc(db, 'portfolios', portfolioId);
    await setDoc(metaRef, backup.meta);
  }
}

export async function deleteCloudBackup(backupId: string, portfolioId: string = 'main'): Promise<void> {
  const backupRef = doc(db, 'portfolios', portfolioId, 'backups', backupId);
  await deleteDoc(backupRef);
}
