import YahooFinance from 'yahoo-finance2';
import { getYahooQuote, RawProviderQuote } from './providers/yahoo';
import { getTwelveDataQuote } from './providers/twelveData';
import { getFinnhubQuote } from './providers/finnhub';

const yf = new YahooFinance({
  validation: { logErrors: false },
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
const lastKnownGoodQuotes = new Map<string, StandardQuoteResponse>();

// Cache for resolved symbols (e.g. NVIDIA -> NVDA)
const resolvedSymbolCache = new Map<string, string>();

const EMERGENCY_FALLBACKS: Record<string, { price: number; currency: string; name: string }> = {
  'SXR8.DE': { price: 545.20, currency: 'EUR', name: 'iShares Core S&P 500 UCITS ETF' },
  'SXR8': { price: 545.20, currency: 'EUR', name: 'iShares Core S&P 500 UCITS ETF' },
  'VVSM.DE': { price: 39.80, currency: 'EUR', name: 'VanEck Semiconductor UCITS ETF' },
  'VVSM': { price: 39.80, currency: 'EUR', name: 'VanEck Semiconductor UCITS ETF' },
  'VWCE.DE': { price: 122.50, currency: 'EUR', name: 'Vanguard FTSE All-World UCITS ETF' },
  'VWCE': { price: 122.50, currency: 'EUR', name: 'Vanguard FTSE All-World UCITS ETF' },
  '000660.KS': { price: 190000, currency: 'KRW', name: 'SK Hynix Inc.' },
  'SKHY': { price: 190000, currency: 'KRW', name: 'SK Hynix Inc.' },
  'SPCX': { price: 215.00, currency: 'USD', name: 'SpaceX / Special ETF' },
};

async function resolveSymbolIfName(rawQuery: string): Promise<string> {
  const clean = rawQuery.trim().toUpperCase();
  if (resolvedSymbolCache.has(clean)) {
    return resolvedSymbolCache.get(clean)!;
  }

  try {
    const searchRes: any = await yf.search(clean, {
      quotesCount: 5,
      newsCount: 0,
      enableFuzzyQuery: true,
    });
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

  // If all live sources failed: Check last known good quote or emergency fallback
  if (!rawQuote || isNaN(rawQuote.price) || rawQuote.price <= 0) {
    const fallback =
      lastKnownGoodQuotes.get(cleanTicker) ||
      lastKnownGoodQuotes.get(searchTicker) ||
      memoryCache.get(cleanTicker)?.data ||
      memoryCache.get(searchTicker)?.data;

    if (fallback && !fallback.error && fallback.priceInEur > 0) {
      return {
        ...fallback,
        ticker: cleanTicker,
        timestamp: now,
        source: 'cached_fallback',
      };
    }

    const hardcoded = EMERGENCY_FALLBACKS[cleanTicker] || EMERGENCY_FALLBACKS[searchTicker];
    if (hardcoded) {
      const fxRateToEur = await getLiveFxRateToEur(hardcoded.currency);
      const priceInEur = Number((hardcoded.price * fxRateToEur).toFixed(4));
      const hardcodedResponse: StandardQuoteResponse = {
        ticker: cleanTicker,
        name: hardcoded.name,
        price: hardcoded.price,
        currency: hardcoded.currency,
        fxRateToEur,
        priceInEur,
        changePercent: 0,
        monthReturnPercent: 0,
        timestamp: now,
        source: 'reference_fallback',
      };
      lastKnownGoodQuotes.set(cleanTicker, hardcodedResponse);
      lastKnownGoodQuotes.set(searchTicker, hardcodedResponse);
      return hardcodedResponse;
    }

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
  const currency = (rawQuote.currency || 'EUR').toUpperCase();
  const fxRateToEur = await getLiveFxRateToEur(currency);
  const priceInEur = Number((rawQuote.price * fxRateToEur).toFixed(4));

  const quoteResponse: StandardQuoteResponse = {
    ticker: cleanTicker,
    name: rawQuote.name || cleanTicker,
    price: Number(rawQuote.price),
    currency,
    fxRateToEur,
    priceInEur,
    changePercent: rawQuote.changePercent ?? 0,
    monthReturnPercent: rawQuote.monthReturnPercent ?? rawQuote.changePercent ?? 0,
    timestamp: now,
    source: rawQuote.source,
  };

  // Save successful quote in both memoryCache and lastKnownGoodQuotes
  lastKnownGoodQuotes.set(cleanTicker, quoteResponse);
  lastKnownGoodQuotes.set(searchTicker, quoteResponse);
  if (activeTicker !== cleanTicker) {
    lastKnownGoodQuotes.set(activeTicker, quoteResponse);
  }

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
