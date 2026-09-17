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

// Cache for historical FX rates
const fxCache = new Map<string, number>();

/**
 * Gets historical FX rate from Frankfurter API
 */
export async function getHistoricalFxRate(date: number | string, from: string = 'USD', to: string = 'EUR'): Promise<number> {
  if (from === to) return 1.0;
  
  const dateObj = new Date(date);
  const dateStr = dateObj.toISOString().split('T')[0];
  const cacheKey = `${dateStr}_${from}_${to}`;

  if (fxCache.has(cacheKey)) return fxCache.get(cacheKey)!;

  try {
    const res = await fetch(`https://api.frankfurter.app/${dateStr}?from=${from}&to=${to}`);
    if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);
    const data = await res.json();
    if (data && data.rates && data.rates[to]) {
      const rate = data.rates[to];
      fxCache.set(cacheKey, rate);
      return rate;
    }
  } catch (err) {
    console.warn(`Erro ao obter taxa FX para ${dateStr}:`, err);
  }

  // Fallback to a standard rate if API fails
  return from === 'USD' && to === 'EUR' ? 0.92 : 1.0;
}

// Guarda a última cotação válida com sucesso para nunca perder dados em caso de erro temporário
const lastKnownGoodQuotes = new Map<string, any>();

// Registo do timestamp da última recolha com sucesso (em ms)
let lastSuccessfulQuoteUpdate = Date.now();

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

  // 1. Direct match
  if (quotes[t]) return quotes[t];

  // 2. Suffix matching for .US
  if (t.endsWith('.US')) {
    const noUs = t.replace(/\.US$/i, '');
    if (quotes[noUs]) return quotes[noUs];
  } else if (!t.includes('.')) {
    const withUs = `${t}.US`;
    if (quotes[withUs]) return quotes[withUs];
  }

  // 3. Scan keys for exact match or prefix/extension match (e.g. SXR8.DE vs SXR8)
  const keys = Object.keys(quotes);
  const foundExact = keys.find((k) => k.trim().toUpperCase() === t);
  if (foundExact) return quotes[foundExact];

  const foundPrefix = keys.find((k) => {
    const kClean = k.trim().toUpperCase();
    return kClean.startsWith(t + '.') || t.startsWith(kClean + '.');
  });
  if (foundPrefix) return quotes[foundPrefix];

  return null;
}

// Cotações estritamente em tempo real (sem cache no cliente e sem fallbacks de valores antigos)
export async function fetchLiveQuotes(
  tickers: string[],
  forceRefresh: boolean = true
): Promise<Record<string, any>> {
  if (!tickers || !tickers.length) return {};

  const now = Date.now();
  const normalizedTickers = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase())));
  const result: Record<string, any> = {};

  try {
    const res = await fetch(`/api/quotes?force=${forceRefresh}&t=${now}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      },
      body: JSON.stringify({ tickers: normalizedTickers, force: forceRefresh, timestamp: now }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const fetchedQuotes: Record<string, any> = data.quotes || {};

    let hasSuccess = false;
    normalizedTickers.forEach((ticker) => {
      const q = findQuoteForTicker(fetchedQuotes, ticker);
      const noSuffix = ticker.replace(/\.US$/i, '');
      const withUs = `${noSuffix}.US`;

      if (q && !q.error && q.priceInEur > 0) {
        const formattedQuote = { ...q, ticker };
        result[ticker] = formattedQuote;
        result[noSuffix] = formattedQuote;
        result[withUs] = formattedQuote;
        hasSuccess = true;
      } else {
        const errQuote = { 
          error: true, 
          errorMessage: q?.errorMessage || 'api "Indisponível"' 
        };
        result[ticker] = errQuote;
        result[noSuffix] = errQuote;
        result[withUs] = errQuote;
      }
    });

    if (hasSuccess) {
      lastSuccessfulQuoteUpdate = now;
    }

    return result;
  } catch (err) {
    console.warn('Erro ao obter cotações em tempo real:', err);
    normalizedTickers.forEach((ticker) => {
      const errQuote = { error: true, errorMessage: 'Erro de ligação em tempo real' };
      result[ticker] = errQuote;
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

  // Sincronização inicial de apoio via backend se necessário
  fetch('/api/portfolio/sync')
    .then((res) => res.json())
    .then((syncRes) => {
      if (syncRes?.success && syncRes?.data?.holdings && Array.isArray(syncRes.data.holdings)) {
        // Se o firestore ainda estiver a conectar ou vazio e houver sync recente
        if (syncRes.data.holdings.length > 0) {
          onUpdate(syncRes.data.holdings);
        }
      }
    })
    .catch(() => {});

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

      // Espelhar estado em tempo real no endpoint redundante da Cloud
      if (holdings.length > 0) {
        fetch('/api/portfolio/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: { holdings, portfolioId } }),
        }).catch(() => {});
      }
    },
    (err) => {
      console.warn('Firestore subscription status:', err.message || err);
      // Em caso de falha de conexão direta do Firestore, obter do sync redundante
      fetch('/api/portfolio/sync')
        .then((res) => res.json())
        .then((syncRes) => {
          if (syncRes?.success && syncRes?.data?.holdings && Array.isArray(syncRes.data.holdings)) {
            onUpdate(syncRes.data.holdings);
          }
        })
        .catch(() => {});
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

  // Limpar qualquer documento antigo ou alternativo (ex: com sufixo .US ou IDs não canónicos)
  try {
    if (rawTicker !== normalizedTicker) {
      await deleteDoc(doc(db, 'portfolios', portfolioId, 'holdings', rawTicker));
    }
    const holdingsRef = collection(db, 'portfolios', portfolioId, 'holdings');
    const snap = await getDocs(holdingsRef);
    for (const d of snap.docs) {
      if (d.id !== normalizedTicker) {
        const dTicker = (d.data()?.ticker || '').trim().toUpperCase();
        if (
          dTicker === normalizedTicker ||
          dTicker === rawTicker ||
          convertTickerToYahoo(dTicker).toUpperCase() === normalizedTicker ||
          convertTickerToYahoo(d.id).toUpperCase() === normalizedTicker
        ) {
          await deleteDoc(d.ref);
        }
      }
    }
  } catch (_) {}

  const dataToSave: any = {
    ticker: normalizedTicker,
    shares: Number(shares),
    createdAt: Date.now(),
    color: color || DISTINCT_PALETTE[Math.floor(Math.random() * DISTINCT_PALETTE.length)],
  };
  if (purchases && purchases.length > 0) {
    dataToSave.purchases = purchases;
  }

  try {
    const docRef = doc(db, 'portfolios', portfolioId, 'holdings', normalizedTicker);
    await setDoc(docRef, dataToSave, { merge: true });
  } catch (firestoreErr) {
    console.warn('Firestore write fallback to sync:', firestoreErr);
  }

  // Notificar backend de sincronização imediatamente
  fetch('/api/portfolio/sync')
    .then((r) => r.json())
    .then((res) => {
      let currentHoldings: any[] = res?.data?.holdings || [];
      const idx = currentHoldings.findIndex((h) => h.ticker === normalizedTicker);
      const newHoldingItem = { id: normalizedTicker, ...dataToSave };
      if (idx >= 0) {
        currentHoldings[idx] = newHoldingItem;
      } else {
        currentHoldings.unshift(newHoldingItem);
      }
      return fetch('/api/portfolio/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { holdings: currentHoldings } }),
      });
    })
    .catch(() => {});
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
  const normTicker = ticker.trim().toUpperCase();
  const yahooTicker = convertTickerToYahoo(normTicker).toUpperCase();

  // 1. Eliminar documentos diretamente pelos IDs possíveis no Firestore
  const possibleIds = Array.from(new Set([normTicker, yahooTicker, `${yahooTicker}.US`]));
  for (const docId of possibleIds) {
    try {
      await deleteDoc(doc(db, 'portfolios', portfolioId, 'holdings', docId));
    } catch (_) {}
  }

  // 2. Varrer coleção de holdings para eliminar qualquer documento remanescente que coincida com o ticker
  try {
    const holdingsRef = collection(db, 'portfolios', portfolioId, 'holdings');
    const snapshot = await getDocs(holdingsRef);
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const docTicker = (data?.ticker || '').trim().toUpperCase();
      const docNormYahoo = convertTickerToYahoo(docTicker).toUpperCase();
      const docIdYahoo = convertTickerToYahoo(docSnap.id).toUpperCase();

      if (
        docSnap.id.toUpperCase() === normTicker ||
        docSnap.id.toUpperCase() === yahooTicker ||
        docTicker === normTicker ||
        docTicker === yahooTicker ||
        docNormYahoo === yahooTicker ||
        docIdYahoo === yahooTicker
      ) {
        await deleteDoc(docSnap.ref);
      }
    }
  } catch (firestoreErr) {
    console.warn('Firestore delete fallback to sync:', firestoreErr);
  }

  // 3. Atualizar endpoint de sincronização redundante
  try {
    const res = await fetch('/api/portfolio/sync');
    const syncRes = await res.json();
    let currentHoldings: any[] = syncRes?.data?.holdings || [];
    currentHoldings = currentHoldings.filter((h) => {
      const hTicker = (h.ticker || '').trim().toUpperCase();
      const hYahoo = convertTickerToYahoo(hTicker).toUpperCase();
      return hTicker !== normTicker && hTicker !== yahooTicker && hYahoo !== yahooTicker;
    });
    await fetch('/api/portfolio/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { holdings: currentHoldings } }),
    });
  } catch (_) {}
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
    const weekReturnPercent = isError ? undefined : quote?.weekReturnPercent;
    const monthReturnPercent = isError ? undefined : quote?.monthReturnPercent;
    const threeMonthReturnPercent = isError ? undefined : quote?.threeMonthReturnPercent;
    const targetPrice = isError ? undefined : quote?.targetPrice;
    const fallbackColor = holding.color || getDistinctColor(idx);

    const totalShares = Number(holding.shares || 0);

    const isForeignCurrency = nativeCurrency !== 'EUR';
    const isPence = (quote?.currency === 'GBp' || quote?.currency === 'GBX' || quote?.currency === 'PENCE');

    // Determinar data e preço unitário da primeira compra real (data mais antiga de todas as compras válidas)
    const purchases = holding.purchases || [];
    let firstPurchaseTimestamp: number | undefined = undefined;
    let firstPurchaseDate: string | undefined = undefined;
    let firstPurchasePriceEur: number | undefined = undefined;

    const parseDateToMs = (dateInput: any): number => {
      if (!dateInput) return 0;
      if (typeof dateInput === 'number') return dateInput;
      if (dateInput instanceof Date) return dateInput.getTime();
      if (typeof dateInput === 'string') {
        const trimmed = dateInput.trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
          const [day, month, year] = trimmed.split('/');
          const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
          if (!isNaN(parsed.getTime())) return parsed.getTime();
        }
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) return parsed.getTime();
      }
      if (dateInput && typeof dateInput === 'object') {
        if (typeof dateInput.seconds === 'number') return dateInput.seconds * 1000;
        if (typeof dateInput._seconds === 'number') return dateInput._seconds * 1000;
      }
      return 0;
    };

    const validPurchaseDates = purchases
      .map((p) => parseDateToMs(p.date))
      .filter((d) => !isNaN(d) && d > 0);

    if (validPurchaseDates.length > 0) {
      firstPurchaseTimestamp = Math.min(...validPurchaseDates);
      const d = new Date(firstPurchaseTimestamp);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      firstPurchaseDate = `${day}/${month}/${year}`;

      const oldestPurchase = purchases.find((p) => {
        const t = parseDateToMs(p.date);
        return t === firstPurchaseTimestamp;
      });

      if (oldestPurchase) {
        if (oldestPurchase.priceEur && oldestPurchase.priceEur > 0) {
          firstPurchasePriceEur = Number(oldestPurchase.priceEur);
        } else if (oldestPurchase.price && oldestPurchase.price > 0) {
          let effPrice = oldestPurchase.price;
          if (isPence) effPrice = effPrice / 100;
          firstPurchasePriceEur = isForeignCurrency ? effPrice * fxRateToEur : effPrice;
        } else if (oldestPurchase.totalCostEur && oldestPurchase.shares > 0) {
          firstPurchasePriceEur = oldestPurchase.totalCostEur / oldestPurchase.shares;
        }
      }
    } else if (holding.createdAt && holding.createdAt > 0) {
      firstPurchaseTimestamp = holding.createdAt;
      const d = new Date(firstPurchaseTimestamp);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      firstPurchaseDate = `${day}/${month}/${year}`;
    }

    // 1. Capital Investido e Normalização de Todos os Lotes de Compra
    // Para cada lote registado em purchases (ou lote sintetizado), determinamos:
    // - timestamp da compra
    // - número de ações
    // - custo real em EUR (incluindo taxas e taxa cambial se aplicável)
    const normalizedLots: Array<{ timestamp: number; shares: number; costEur: number }> = [];
    let totalInvested = 0;

    purchases.forEach((p) => {
      const sh = Number(p.shares || 0);
      if (sh <= 0) return;

      const fee = Number(p.feeEur || 0);
      let lotCostEur = 0;

      // Prioridade 1: Custo total em EUR explicitamente registado
      if (p.totalCostEur !== undefined && Number(p.totalCostEur) > 0) {
        lotCostEur = Number(p.totalCostEur) + fee;
      } else {
        const rawPrice = Number(p.price || 0);
        const rawPriceEur = Number(p.priceEur || 0);

        if (isForeignCurrency) {
          if (rawPriceEur > 0 && rawPrice > 0 && Math.abs(rawPriceEur - rawPrice) > 0.001) {
            lotCostEur = sh * rawPriceEur + fee;
          } else {
            let effectiveNativePrice = rawPrice > 0 ? rawPrice : rawPriceEur;
            if (isPence) {
              effectiveNativePrice = effectiveNativePrice / 100;
            }
            const priceConvertedToEur = effectiveNativePrice * fxRateToEur;
            lotCostEur = sh * priceConvertedToEur + fee;
          }
        } else {
          const pPrice = rawPriceEur > 0 ? rawPriceEur : rawPrice;
          if (pPrice > 0) {
            lotCostEur = sh * pPrice + fee;
          }
        }
      }

      if (lotCostEur > 0) {
        totalInvested += lotCostEur;
      }

      const lotTimestamp = parseDateToMs(p.date) || holding.createdAt || Date.now();
      normalizedLots.push({
        timestamp: lotTimestamp,
        shares: sh,
        costEur: lotCostEur,
      });
    });

    // Se não havia compras detalhadas mas existem ações, cria um lote base
    if (normalizedLots.length === 0 && totalShares > 0) {
      const fallbackTs = holding.createdAt || firstPurchaseTimestamp || Date.now();
      normalizedLots.push({
        timestamp: fallbackTs,
        shares: totalShares,
        costEur: totalInvested > 0 ? totalInvested : (totalShares * currentPriceInEur),
      });
    }

    // 2. Preço Médio Ponderado em EUR
    const averagePrice = totalShares > 0 && totalInvested > 0 ? totalInvested / totalShares : 0;

    // 3. Valor Atual em EUR: quantidadeTotal × preçoAtualEmEUR
    const currentValue = isError || totalShares <= 0 ? 0 : totalShares * currentPriceInEur;

    // 4. Lucro/Prejuízo Total: currentValue - totalInvested
    const profitEur = !isError && totalInvested > 0 ? currentValue - totalInvested : 0;

    // 5. Rentabilidade Total da Posição (%): (profitEur / totalInvested) * 100
    let totalReturnPercent: number | undefined = undefined;
    if (!isError && totalShares > 0 && totalInvested > 0 && currentPriceInEur > 0) {
      totalReturnPercent = Number(((profitEur / totalInvested) * 100).toFixed(2));
    }

    // 6. Rentabilidade Total (ROI) a ser apresentada na interface
    // Mostra o impacto real de todo o capital investido na posição.
    let firstPurchaseReturnPercent: number | undefined = totalReturnPercent;

    // 7. Motor de Cálculo Rigoroso para as 4 Janelas Temporais (1d, 1w, 1m, 3m)
    const now = Date.now();
    const computeWindowMetrics = (
      marketReturnPercent: number | undefined,
      windowMs: number
    ): { returnPercent: number | undefined; returnEur: number | undefined } => {
      if (!normalizedLots.length || currentPriceInEur <= 0 || isError) {
        return { returnPercent: undefined, returnEur: undefined };
      }

      const windowStartTime = now - windowMs;

      // Preço unitário no início da janela se marketReturnPercent estiver disponível
      let startPriceEur: number | undefined = undefined;
      if (marketReturnPercent !== undefined && !isNaN(marketReturnPercent)) {
        const ratio = 1 + marketReturnPercent / 100;
        if (ratio > 0.0001) {
          startPriceEur = currentPriceInEur / ratio;
        }
      }

      let sharesBoughtInWindow = 0;
      let windowCostInflows = 0;

      for (const lot of normalizedLots) {
        if (lot.timestamp > windowStartTime) {
          sharesBoughtInWindow += lot.shares;
          const effectiveLotCost = lot.costEur > 0 ? lot.costEur : (lot.shares * averagePrice);
          windowCostInflows += effectiveLotCost;
        }
      }

      // Estima as ações que já tínhamos no início da janela (evitando números negativos)
      const windowStartShares = Math.max(0, totalShares - sharesBoughtInWindow);
      const effectiveStartPrice = startPriceEur !== undefined ? startPriceEur : averagePrice;
      
      const windowStartValue = windowStartShares * effectiveStartPrice;
      const windowCurrentValue = totalShares * currentPriceInEur;
      
      const windowProfitEur = windowCurrentValue - windowStartValue - windowCostInflows;
      const windowCapitalBase = windowStartValue + windowCostInflows;

      let retPct: number | undefined = undefined;
      
      // Aplicar ROI real do capital investido na janela
      if (windowCapitalBase > 0) {
        retPct = (windowProfitEur / windowCapitalBase) * 100;
      } else if (marketReturnPercent !== undefined) {
        retPct = marketReturnPercent;
      }

      const retEur = Number(windowProfitEur.toFixed(2));
      return { 
        returnPercent: retPct !== undefined ? Number(retPct.toFixed(2)) : undefined, 
        returnEur: retEur 
      };
    };

    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    const threeMonthMs = 90 * 24 * 60 * 60 * 1000;

    const m1d = computeWindowMetrics(changePercent, oneDayMs);
    const m1w = computeWindowMetrics(weekReturnPercent ?? changePercent, oneWeekMs);
    const m1m = computeWindowMetrics(monthReturnPercent, oneMonthMs);
    const m3m = computeWindowMetrics(threeMonthReturnPercent, threeMonthMs);

    // Rentabilidades de MERCADO (Ticker) vs PESSOAL (Carteira)
    // Para as colunas de 1d, 1w, 1m, 3m mostramos a variação do MERCADO (Ticker)
    // Para a coluna TOTAL mostramos a variação PESSOAL (ROI)
    const effectiveChangePercent = changePercent !== undefined ? changePercent : m1d.returnPercent;
    const effectiveWeekReturn = weekReturnPercent !== undefined ? weekReturnPercent : (m1w.returnPercent ?? changePercent);
    const effectiveMonthReturn = monthReturnPercent !== undefined ? monthReturnPercent : m1m.returnPercent;
    const effectiveThreeMonthReturn = threeMonthReturnPercent !== undefined ? threeMonthReturnPercent : m3m.returnPercent;
    
    // Os valores em Euros continuam a ser pessoais (quanto ganhaste naquela janela)
    const effectiveChangeEur = m1d.returnEur;
    const effectiveWeekEur = m1w.returnEur;
    const effectiveMonthEur = m1m.returnEur;
    const effectiveThreeMonthEur = m3m.returnEur;

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
      changePercent: effectiveChangePercent,
      changeEur: effectiveChangeEur,
      weekReturnPercent: effectiveWeekReturn,
      weekReturnEur: effectiveWeekEur,
      monthReturnPercent: effectiveMonthReturn,
      monthReturnEur: effectiveMonthEur,
      threeMonthReturnPercent: effectiveThreeMonthReturn,
      threeMonthReturnEur: effectiveThreeMonthEur,
      targetPrice,
      totalReturnPercent,
      firstPurchaseReturnPercent,
      firstPurchaseDate,
      firstPurchaseTimestamp,
      color: fallbackColor,
      isError,
      errorMessage: isError ? (quote?.errorMessage || 'api "Erro"') : undefined,
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
  try {
    const docRef = doc(db, 'portfolios', portfolioId);
    await setDoc(docRef, metaWithTimestamp, { merge: true });
  } catch (err) {
    console.warn('savePortfolioMeta Firestore warning:', err);
  }

  fetch('/api/portfolio/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { meta: metaWithTimestamp } }),
  }).catch(() => {});
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

  try {
    const res = await fetch('/api/portfolio/sync');
    const syncRes = await res.json();
    if (syncRes?.success && syncRes?.data?.meta) {
      return syncRes.data.meta;
    }
  } catch (_) {}

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
