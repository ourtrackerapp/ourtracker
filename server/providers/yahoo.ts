import YahooFinance from 'yahoo-finance2';

export interface RawProviderQuote {
  price: number;
  currency: string;
  name?: string;
  changePercent?: number;
  prevClose?: number;
  weekReturnPercent?: number;
  monthReturnPercent?: number;
  threeMonthReturnPercent?: number;
  targetPrice?: number;
  source: string;
}

const yf = new YahooFinance({
  validation: { logErrors: false },
  suppressNotices: ['yahooSurvey'],
});

const PROVIDER_TIMEOUT_MS = 4000;

export function withTimeout<T>(promise: Promise<T>, ms: number = PROVIDER_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function getYahooRestQuote(ticker: string, errorCollector?: string[]): Promise<RawProviderQuote | null> {
  try {
    const res = await withTimeout(fetchFromQuery2(ticker, new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)), 4000);
    if (res && res.meta) {
      const meta = res.meta;
      const prevClose = meta.chartPreviousClose || meta.previousClose;
      
      // Extended hours priority: fulldayPrice -> postMarketPrice -> preMarketPrice -> regularMarketPrice
      let activePrice = meta.regularMarketPrice;
      let activeChange = meta.regularMarketChangePercent;

      if (typeof meta.fulldayPrice === 'number' && meta.fulldayPrice > 0) {
        activePrice = meta.fulldayPrice;
        if (typeof meta.fulldayChangePercent === 'number') {
          activeChange = meta.fulldayChangePercent;
        } else if (prevClose && prevClose > 0) {
          activeChange = Number((((activePrice - prevClose) / prevClose) * 100).toFixed(4));
        }
      } else if (typeof meta.postMarketPrice === 'number' && meta.postMarketPrice > 0) {
        activePrice = meta.postMarketPrice;
        if (typeof meta.postMarketChangePercent === 'number') {
          activeChange = meta.postMarketChangePercent;
        } else if (prevClose && prevClose > 0) {
          activeChange = Number((((activePrice - prevClose) / prevClose) * 100).toFixed(4));
        }
      } else if (typeof meta.preMarketPrice === 'number' && meta.preMarketPrice > 0) {
        activePrice = meta.preMarketPrice;
        if (typeof meta.preMarketChangePercent === 'number') {
          activeChange = meta.preMarketChangePercent;
        } else if (prevClose && prevClose > 0) {
          activeChange = Number((((activePrice - prevClose) / prevClose) * 100).toFixed(4));
        }
      } else if (prevClose && prevClose > 0 && activePrice) {
        activeChange = Number((((activePrice - prevClose) / prevClose) * 100).toFixed(4));
      }

      return {
        price: activePrice,
        currency: meta.currency || 'EUR',
        name: meta.longName || meta.shortName || ticker,
        changePercent: activeChange,
        prevClose,
        source: 'Yahoo-REST'
      };
    }
  } catch (err: any) {
    const status = err?.status || (err?.response && err.response.status) || null;
    const msg = `Yahoo-Query2 failed: ${err?.message || String(err)}${status ? ` (HTTP ${status})` : ''}`;
    if (errorCollector) {
      errorCollector.push(msg);
    }
    console.error(`[Yahoo-REST-Query2] Error fetching ${ticker}:`, {
      provider: 'Yahoo-REST-Query2',
      ticker,
      message: err?.message || String(err),
      status
    });
    // Fallback to yf.quote below
  }

  try {
    const quote = await yf.quote(ticker);
    if (!quote || !quote.regularMarketPrice) return null;
    const prevClose = (quote as any).regularMarketPreviousClose || (quote as any).chartPreviousClose;
    
    let price = quote.regularMarketPrice;
    let changePercent = quote.regularMarketChangePercent;

    if ((quote as any).postMarketPrice) {
      price = (quote as any).postMarketPrice;
      changePercent = (quote as any).postMarketChangePercent ?? (prevClose ? ((price - prevClose) / prevClose) * 100 : changePercent);
    } else if ((quote as any).preMarketPrice) {
      price = (quote as any).preMarketPrice;
      changePercent = (quote as any).preMarketChangePercent ?? (prevClose ? ((price - prevClose) / prevClose) * 100 : changePercent);
    }

    return {
      price,
      currency: quote.currency || 'EUR',
      name: quote.longName || quote.shortName || ticker,
      changePercent,
      prevClose,
      source: 'Yahoo-REST'
    };
  } catch (err: any) {
    const status = err?.status || (err?.response && err.response.status) || null;
    const msg = `Yahoo-yf.quote failed: ${err?.message || String(err)}${status ? ` (HTTP ${status})` : ''}`;
    if (errorCollector) {
      errorCollector.push(msg);
    }
    console.error(`[Yahoo-yf.quote] Error fetching ${ticker}:`, {
      provider: 'Yahoo-yf.quote',
      ticker,
      message: err?.message || String(err),
      status
    });
    return null;
  }
}

// Cache for ticker returns (10 minutes TTL)
const returnsCache = new Map<string, { data: { weekReturn?: number; monthReturn?: number; threeMonthReturn?: number; prevClose?: number; extendedPrice?: number; extendedChangePercent?: number }; timestamp: number }>();

async function fetchFromQuery2(sym: string, period1: string): Promise<any> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${Math.floor(new Date(period1).getTime() / 1000)}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    signal: AbortSignal.timeout(3500)
  });
  if (!res.ok) {
    const err = new Error(`Yahoo Query2 failed: ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const json = await res.json();
  return json.chart.result[0];
}

export async function fetchReturnsForTicker(ticker: string): Promise<{
  weekReturn?: number;
  monthReturn?: number;
  threeMonthReturn?: number;
  lastRegularClose?: number;
  prevDayClose?: number;
  extendedPrice?: number;
  extendedChangePercent?: number;
}> {
  const cleanSym = ticker.replace(/\.US$/i, '').toUpperCase();
  const cached = returnsCache.get(cleanSym);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.data;
  }

  const candidateSymbols = [cleanSym];
  if (cleanSym.endsWith('.DE')) {
    candidateSymbols.push(cleanSym);
  }

  for (const sym of candidateSymbols) {
    try {
      const d = new Date();
      d.setDate(d.getDate() - 110);
      const period1 = d.toISOString().slice(0, 10);

      const res = await withTimeout(fetchFromQuery2(sym, period1), 4000);

      const timestamps = res.timestamp || [];
      const closes = res.indicators?.quote?.[0]?.close || [];
      const quotes = timestamps.map((t: number, i: number) => ({
        date: new Date(t * 1000),
        close: closes[i]
      })).filter((q: any) => typeof q.close === 'number' && !isNaN(q.close) && q.close > 0);

      if (quotes.length < 2) continue;

      const meta = res.meta || {};
      const lastRegularClose = quotes[quotes.length - 1].close;
      const prevDayClose = quotes.length >= 2 ? quotes[quotes.length - 2].close : lastRegularClose;
      
      let extendedPrice = meta.fulldayPrice || meta.postMarketPrice || meta.preMarketPrice || meta.regularMarketPrice || lastRegularClose;
      let extendedChangePercent = meta.regularMarketChangePercent;

      if (typeof meta.fulldayChangePercent === 'number') {
        extendedChangePercent = meta.fulldayChangePercent;
      } else if (typeof meta.postMarketChangePercent === 'number') {
        extendedChangePercent = meta.postMarketChangePercent;
      } else if (typeof meta.preMarketChangePercent === 'number') {
        extendedChangePercent = meta.preMarketChangePercent;
      } else if (extendedPrice && lastRegularClose && Math.abs(extendedPrice - lastRegularClose) > 0.001) {
        extendedChangePercent = ((extendedPrice - lastRegularClose) / lastRegularClose) * 100;
      }

      const currentPrice = extendedPrice;
      const nowMs = Date.now();
      const target1w = nowMs - 7 * 86400000;
      const target1m = nowMs - 30 * 86400000;
      const target3m = nowMs - 90 * 86400000;

      const findCloseAtOrBefore = (targetMs: number) => {
        for (let i = quotes.length - 1; i >= 0; i--) {
          const qTime = new Date(quotes[i].date).getTime();
          if (qTime <= targetMs) {
            return quotes[i].close;
          }
        }
        return quotes[0]?.close;
      };

      const p1w = findCloseAtOrBefore(target1w);
      const p1m = findCloseAtOrBefore(target1m);
      const p3m = findCloseAtOrBefore(target3m);

      const weekReturn = p1w > 0 ? Number((((currentPrice - p1w) / p1w) * 100).toFixed(2)) : undefined;
      const monthReturn = p1m > 0 ? Number((((currentPrice - p1m) / p1m) * 100).toFixed(2)) : undefined;
      const threeMonthReturn = p3m > 0 ? Number((((currentPrice - p3m) / p3m) * 100).toFixed(2)) : undefined;

      const result = {
        weekReturn,
        monthReturn,
        threeMonthReturn,
        lastRegularClose,
        prevDayClose,
        extendedPrice,
        extendedChangePercent: extendedChangePercent !== undefined ? Number(Number(extendedChangePercent).toFixed(4)) : undefined
      };
      returnsCache.set(cleanSym, { data: result, timestamp: Date.now() });
      return result;
    } catch (err: any) {
      const status = err?.status || (err?.response && err.response.status) || null;
      console.error(`[Yahoo-Returns] Error fetching returns for ${ticker} (sym: ${sym}):`, {
        provider: 'Yahoo-Returns',
        ticker,
        sym,
        message: err?.message || String(err),
        status
      });
      // Continue to next symbol
    }
  }

  return {};
}
