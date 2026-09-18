import { RawProviderQuote, fetchReturnsForTicker, getYahooRestQuote } from './providers/yahoo.js';

export interface StandardQuoteResponse {
  ticker: string;
  name: string;
  price: number;
  currency: string;
  fxRateToEur: number;
  priceInEur: number;
  livePriceInEur?: number;
  changePercent: number;
  weekReturnPercent?: number;
  monthReturnPercent?: number;
  threeMonthReturnPercent?: number;
  ytdReturnPercent?: number;
  targetPrice?: number;
  timestamp: number;
  source?: string;
  error?: boolean;
  errorMessage?: string;
}

// Cache for deduplication and protecting against rate limits
const quoteCache = new Map<string, { data: StandardQuoteResponse; timestamp: number }>();

export async function fetchSingleQuoteWithFallback(
  rawTicker: string,
  getLiveFxRateToEur: (currency: string) => Promise<number>,
  force: boolean = false
): Promise<StandardQuoteResponse> {
  const cleanTicker = rawTicker.trim().toUpperCase();
  const now = Date.now();

  // Cache check for high-frequency requests (allow fresh fetch on force or every 2.5 seconds)
  const cached = quoteCache.get(cleanTicker);
  if (cached) {
    const age = now - cached.timestamp;
    if (age < 2500 && !force) {
      return cached.data;
    }
  }

  const mappingKey = cleanTicker.endsWith('.US') 
    ? cleanTicker.replace(/\.US$/i, '') 
    : cleanTicker;

  const errorCollector: string[] = [];
  const activeTicker = mappingKey;

  // 100% Yahoo Finance Provider
  let yahooRawQuote: RawProviderQuote | null = null;
  try {
    yahooRawQuote = await getYahooRestQuote(activeTicker, errorCollector);
  } catch (err: any) {
    const status = err?.status || (err?.response && err.response.status) || null;
    errorCollector.push(`Yahoo REST error: ${err?.message || String(err)}${status ? ` (HTTP ${status})` : ''}`);
  }

  const baseQuote = yahooRawQuote;

  if (!baseQuote || isNaN(baseQuote.price) || baseQuote.price <= 0) {
    const errorDetails = errorCollector.length > 0 ? ` (${errorCollector.join('; ')})` : '';
    return {
      ticker: cleanTicker,
      name: cleanTicker,
      price: 0,
      currency: 'EUR',
      fxRateToEur: 1,
      priceInEur: 0,
      livePriceInEur: 0,
      changePercent: 0,
      timestamp: now,
      error: true,
      errorMessage: `api "YAHOO-REST"${errorDetails}`,
    };
  }

  // Calculate live FX rate to EUR for primary price
  let rawPrice = Number(baseQuote.price);
  let currency = (baseQuote.currency || 'EUR').toUpperCase();
  const fxRateToEur = await getLiveFxRateToEur(currency);
  const priceInEur = Number((rawPrice * fxRateToEur).toFixed(4));
  const livePriceInEur = priceInEur;

  // Enrich returns and calculate accurate 1D change
  let finalChangePercent = baseQuote.changePercent ?? 0;
  let ytdReturnPercent: number | undefined = undefined;
  try {
    const returns = await fetchReturnsForTicker(cleanTicker);
    baseQuote.weekReturnPercent = returns.weekReturn;
    baseQuote.monthReturnPercent = returns.monthReturn;
    baseQuote.threeMonthReturnPercent = returns.threeMonthReturn;
    ytdReturnPercent = returns.ytdReturn;
    
    if (returns.extendedChangePercent !== undefined) {
      finalChangePercent = returns.extendedChangePercent;
    } else if (returns.lastRegularClose && returns.lastRegularClose > 0 && rawPrice > 0) {
      finalChangePercent = Number((((rawPrice - returns.lastRegularClose) / returns.lastRegularClose) * 100).toFixed(4));
    }
  } catch {}

  const response: StandardQuoteResponse = {
    ticker: cleanTicker,
    name: baseQuote.name || cleanTicker,
    price: Number(rawPrice.toFixed(4)),
    currency,
    fxRateToEur,
    priceInEur,
    livePriceInEur,
    changePercent: finalChangePercent,
    weekReturnPercent: baseQuote.weekReturnPercent,
    monthReturnPercent: baseQuote.monthReturnPercent,
    threeMonthReturnPercent: baseQuote.threeMonthReturnPercent,
    ytdReturnPercent,
    timestamp: now,
    source: 'Yahoo-REST',
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

