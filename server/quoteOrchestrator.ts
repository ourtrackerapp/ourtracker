import YahooFinance from 'yahoo-finance2';
import { getYahooQuote, RawProviderQuote, withTimeout } from './providers/yahoo.js';
import { getTwelveDataQuote } from './providers/twelveData.js';
import { getFinnhubQuote } from './providers/finnhub.js';

const yf = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ['yahooSurvey'],
});

export interface StandardQuoteResponse {
  ticker: string;
  name: string;
  price: number;
  currency: string;
  fxRateToEur: number;
  priceInEur: number;
  changePercent: number;
  monthReturnPercent: number;
  timestamp: number;
  source?: string;
  error?: boolean;
  errorMessage?: string;
}

interface CacheEntry {
  data: StandardQuoteResponse;
  timestamp: number;
}

// 5-minute in-memory cache for SUCCESSFUL quotes only
const CACHE_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map<string, CacheEntry>();

// Cache for resolved symbols (e.g. NVIDIA -> NVDA)
const resolvedSymbolCache = new Map<string, string>();

async function resolveSymbolIfName(rawQuery: string): Promise<string> {
  const clean = rawQuery.trim().toUpperCase();
  if (resolvedSymbolCache.has(clean)) {
    return resolvedSymbolCache.get(clean)!;
  }

  try {
    const searchRes: any = await withTimeout(
      yf.search(clean, {
        quotesCount: 5,
        newsCount: 0,
        enableFuzzyQuery: true,
      }),
      4000
    );
    const quotes = Array.isArray(searchRes?.quotes) ? searchRes.quotes : [];
    const firstSymbol = quotes.find((q: any) => q.symbol)?.symbol;
    if (firstSymbol) {
      resolvedSymbolCache.set(clean, firstSymbol.toUpperCase());
      return firstSymbol.toUpperCase();
    }
  } catch {
    // Fallback to original
  }

  return clean;
}

export async function fetchSingleQuoteWithFallback(
  rawTicker: string,
  getLiveFxRateToEur: (currency: string) => Promise<number>
): Promise<StandardQuoteResponse> {
  const cleanTicker = rawTicker.trim().toUpperCase();
  const searchTicker = cleanTicker.endsWith('.US')
    ? cleanTicker.replace(/\.US$/i, '')
    : cleanTicker;

  const now = Date.now();

  // 1. Check in-memory cache (TTL: 5 min)
  const cached = memoryCache.get(searchTicker) || memoryCache.get(cleanTicker);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      ...cached.data,
      ticker: cleanTicker,
    };
  }

  // 2. Cascade execution: Yahoo (query1 -> query2) -> Twelve Data -> Finnhub
  let rawQuote: RawProviderQuote | null = null;
  let activeTicker = searchTicker;

  // Step 1: Yahoo Finance (query1 -> query2)
  try {
    rawQuote = await getYahooQuote(activeTicker);
  } catch (e) {
    rawQuote = null;
  }

  // Step 2: Twelve Data (Key 1 -> Key 2 on limit)
  if (!rawQuote) {
    try {
      rawQuote = await getTwelveDataQuote(activeTicker);
    } catch (e) {
      rawQuote = null;
    }
  }

  // Step 3: Finnhub (Key 1 -> Key 2 on limit)
  if (!rawQuote) {
    try {
      rawQuote = await getFinnhubQuote(activeTicker);
    } catch (e) {
      rawQuote = null;
    }
  }

  // Step 4: If still not found, try auto-resolving company name to official ticker (e.g. NVIDIA -> NVDA)
  if (!rawQuote) {
    const resolved = await resolveSymbolIfName(searchTicker);
    if (resolved && resolved !== searchTicker) {
      activeTicker = resolved;
      try {
        rawQuote = await getYahooQuote(activeTicker);
      } catch {}
      if (!rawQuote) {
        try {
          rawQuote = await getTwelveDataQuote(activeTicker);
        } catch {}
      }
      if (!rawQuote) {
        try {
          rawQuote = await getFinnhubQuote(activeTicker);
        } catch {}
      }
    }
  }

  // If all sources failed: Return explicit error, NEVER serve stale cache
  if (!rawQuote || isNaN(rawQuote.price) || rawQuote.price <= 0) {
    // Delete any stale cache entry
    memoryCache.delete(searchTicker);
    memoryCache.delete(cleanTicker);

    return {
      ticker: cleanTicker,
      name: cleanTicker,
      price: 0,
      currency: 'EUR',
      fxRateToEur: 1,
      priceInEur: 0,
      changePercent: 0,
      monthReturnPercent: 0,
      timestamp: now,
      error: true,
      errorMessage: 'Cotação indisponível (todas as fontes falharam)',
    };
  }

  // Calculate live FX rate to EUR
  let rawPrice = Number(rawQuote.price);
  let currency = (rawQuote.currency || 'EUR').toUpperCase();
  if (currency === 'GBP' || currency === 'GBX' || currency === 'PENCE') {
    rawPrice = rawPrice / 100;
    currency = 'GBP';
  }

  const fxRateToEur = await getLiveFxRateToEur(currency);
  const priceInEur = Number((rawPrice * fxRateToEur).toFixed(4));

  const quoteResponse: StandardQuoteResponse = {
    ticker: cleanTicker,
    name: rawQuote.name || cleanTicker,
    price: Number(rawPrice.toFixed(4)),
    currency,
    fxRateToEur,
    priceInEur,
    changePercent: rawQuote.changePercent ?? 0,
    monthReturnPercent: rawQuote.monthReturnPercent ?? rawQuote.changePercent ?? 0,
    timestamp: now,
    source: rawQuote.source,
  };

  // Only store SUCCESSFUL quotes in memory cache
  memoryCache.set(searchTicker, { data: quoteResponse, timestamp: now });
  memoryCache.set(cleanTicker, { data: quoteResponse, timestamp: now });
  if (activeTicker !== cleanTicker) {
    memoryCache.set(activeTicker, { data: quoteResponse, timestamp: now });
  }

  return quoteResponse;
}

export async function orchestrateQuotes(
  tickers: string[],
  getLiveFxRateToEur: (currency: string) => Promise<number>
): Promise<Record<string, StandardQuoteResponse>> {
  const result: Record<string, StandardQuoteResponse> = {};

  await Promise.all(
    tickers.map(async (rawTicker) => {
      const cleanTicker = rawTicker.trim().toUpperCase();
      const searchTicker = cleanTicker.endsWith('.US')
        ? cleanTicker.replace(/\.US$/i, '')
        : cleanTicker;

      const quote = await fetchSingleQuoteWithFallback(rawTicker, getLiveFxRateToEur);

      result[cleanTicker] = quote;
      result[searchTicker] = quote;
      result[`${searchTicker}.US`] = quote;
    })
  );

  return result;
}
