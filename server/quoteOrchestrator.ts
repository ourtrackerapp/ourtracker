import { RawProviderQuote, fetchReturnsForTicker, getYahooRestQuote } from './providers/yahoo.js';
import { getFinnhubQuote, getFinnhubLivePrices } from './providers/finnhub.js';
import { getAlpacaQuote } from './providers/alpaca.js';
import { getAlpacaLivePrices } from './providers/alpacaWs.js';

export interface StandardQuoteResponse {
  ticker: string;
  name: string;
  price: number;
  currency: string;
  fxRateToEur: number;
  priceInEur: number;
  changePercent: number;
  weekReturnPercent?: number;
  monthReturnPercent?: number;
  threeMonthReturnPercent?: number;
  targetPrice?: number;
  timestamp: number;
  source?: string;
  error?: boolean;
  errorMessage?: string;
}

// Strict mapping Ticker -> Provider
const STRICT_MAPPING: Record<string, 'ALPACA' | 'FINNHUB' | 'YAHOO-REST'> = {
  'SPCX': 'FINNHUB',
  'LEU': 'FINNHUB',
  'SKHY': 'ALPACA',
  'ORCL': 'ALPACA',
  'ORACLE': 'ALPACA',
  'GOOGL': 'ALPACA',
  'ALPHABET': 'ALPACA',
  'SKM': 'ALPACA',
  'AMZN': 'ALPACA',
  'AMAZON': 'ALPACA',
  'SXR8': 'YAHOO-REST',
  'SXR8.DE': 'YAHOO-REST',
  'VVSM': 'YAHOO-REST',
  'VVSM.DE': 'YAHOO-REST'
};

// Cache (1s TTL for deduplication, bypassed when force is true)
const quoteCache = new Map<string, { data: StandardQuoteResponse; timestamp: number }>();

export async function fetchSingleQuoteWithFallback(
  rawTicker: string,
  getLiveFxRateToEur: (currency: string) => Promise<number>,
  force: boolean = false
): Promise<StandardQuoteResponse> {
  const cleanTicker = rawTicker.trim().toUpperCase();
  const now = Date.now();

  // Check cache only if not forcing fresh data
  const cached = quoteCache.get(cleanTicker);
  if (!force && cached && (now - cached.timestamp < 1000)) {
    return cached.data;
  }

  // Normalize for mapping check (e.g. AMZN.US -> AMZN)
  const mappingKey = cleanTicker.endsWith('.US') 
    ? cleanTicker.replace(/\.US$/i, '') 
    : cleanTicker;

  let rawQuote: RawProviderQuote | null = null;
  const provider = STRICT_MAPPING[mappingKey];

  if (!provider) {
    return {
      ticker: cleanTicker,
      name: cleanTicker,
      price: 0,
      currency: 'EUR',
      fxRateToEur: 1,
      priceInEur: 0,
      changePercent: 0,
      timestamp: now,
      error: true,
      errorMessage: `api "Provider desconhecido para ${cleanTicker}"`,
    };
  }

  // Use mappingKey for the actual API calls to ensure consistency
  const activeTicker = mappingKey;

  try {
    if (provider === 'ALPACA') {
      const wsPrices = getAlpacaLivePrices();
      if (wsPrices[activeTicker]) {
        rawQuote = {
          name: activeTicker,
          price: wsPrices[activeTicker].price,
          currency: 'USD',
          source: 'Alpaca',
        };
      } else {
        rawQuote = await getAlpacaQuote(activeTicker);
        if (rawQuote) rawQuote.source = 'Alpaca';
      }
    } else if (provider === 'FINNHUB') {
      const fhPrices = getFinnhubLivePrices();
      if (fhPrices[activeTicker]) {
        rawQuote = {
          name: activeTicker,
          price: fhPrices[activeTicker].price,
          currency: 'USD',
          source: 'Finnhub',
        };
      } else {
        rawQuote = await getFinnhubQuote(activeTicker);
        if (rawQuote) rawQuote.source = 'Finnhub';
      }
    } else if (provider === 'YAHOO-REST') {
      rawQuote = await getYahooRestQuote(activeTicker);
    }
  } catch (err) {
    // Fail explicitly as requested
  }

  if (!rawQuote || isNaN(rawQuote.price) || rawQuote.price <= 0) {
    return {
      ticker: cleanTicker,
      name: cleanTicker,
      price: 0,
      currency: 'EUR',
      fxRateToEur: 1,
      priceInEur: 0,
      changePercent: 0,
      timestamp: now,
      error: true,
      errorMessage: `api "${provider}"`,
    };
  }

  // Calculate live FX rate to EUR
  let rawPrice = Number(rawQuote.price);
  let currency = (rawQuote.currency || 'EUR').toUpperCase();
  const fxRateToEur = await getLiveFxRateToEur(currency);
  const priceInEur = Number((rawPrice * fxRateToEur).toFixed(4));

  // Enrich returns and calculate accurate 1D change with pre/after market support
  let finalChangePercent = rawQuote.changePercent ?? 0;
  try {
    const returns = await fetchReturnsForTicker(cleanTicker);
    rawQuote.weekReturnPercent = returns.weekReturn;
    rawQuote.monthReturnPercent = returns.monthReturn;
    rawQuote.threeMonthReturnPercent = returns.threeMonthReturn;
    
    if (returns.extendedChangePercent !== undefined) {
      finalChangePercent = returns.extendedChangePercent;
    } else if (returns.lastRegularClose && returns.lastRegularClose > 0 && rawPrice > 0) {
      finalChangePercent = Number((((rawPrice - returns.lastRegularClose) / returns.lastRegularClose) * 100).toFixed(4));
    }
  } catch {}

  const response: StandardQuoteResponse = {
    ticker: cleanTicker,
    name: rawQuote.name || cleanTicker,
    price: Number(rawPrice.toFixed(4)),
    currency,
    fxRateToEur,
    priceInEur,
    changePercent: finalChangePercent,
    weekReturnPercent: rawQuote.weekReturnPercent,
    monthReturnPercent: rawQuote.monthReturnPercent,
    threeMonthReturnPercent: rawQuote.threeMonthReturnPercent,
    timestamp: now,
    source: rawQuote.source,
  };

  // Update cache
  quoteCache.set(cleanTicker, { data: response, timestamp: now });

  return response;
}

export async function orchestrateQuotes(
  tickers: string[],
  getLiveFxRateToEur: (currency: string) => Promise<number>,
  force: boolean = false
): Promise<Record<string, StandardQuoteResponse>> {
  const result: Record<string, StandardQuoteResponse> = {};

  await Promise.all(
    tickers.map(async (rawTicker) => {
      const cleanTicker = rawTicker.trim().toUpperCase();
      const quote = await fetchSingleQuoteWithFallback(rawTicker, getLiveFxRateToEur, force);
      result[cleanTicker] = quote;
    })
  );

  return result;
}

