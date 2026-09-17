import express from 'express';
import path from 'path';
import { getExchangeRate } from './serverFx.js';
import { orchestrateQuotes, fetchSingleQuoteWithFallback } from './server/quoteOrchestrator.js';
import { connectAlpacaStream, getAlpacaLivePrices } from './server/providers/alpacaWs.js';
import { connectFinnhubStream } from './server/providers/finnhub.js';


interface CachedData<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CachedData<any>>();
const CACHE_TTL_MS = 20 * 1000;
const QUOTE_SUMMARY_TTL_MS = 15 * 60 * 1000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

const CHART_RANGE_CONFIG: Record<string, { range: string; interval: string }> = {
  '1d': { range: '1d', interval: '15m' },
  '1s': { range: '5d', interval: '1h' },
  '1w': { range: '5d', interval: '1h' },
  '5d': { range: '5d', interval: '1h' },
  '1m': { range: '1mo', interval: '1d' },
  '3m': { range: '3mo', interval: '1d' },
  '6m': { range: '6mo', interval: '1d' },
  'ytd': { range: 'ytd', interval: '1d' },
  '1y': { range: '1y', interval: '1d' },
  '1a': { range: '1y', interval: '1d' },
  'max': { range: '10y', interval: '1d' },
  'tudo': { range: '10y', interval: '1d' },
};

async function getFxRateToEur(fromCurrency: string): Promise<number> {
  const cleanFrom = fromCurrency.toUpperCase();
  if (cleanFrom === 'EUR') return 1.0;

  try {
    const fx = await getExchangeRate(cleanFrom, 'EUR');
    return fx.rate;
  } catch (error) {
    console.warn(`Failed multi-API FX rate for ${cleanFrom}, fallback to 1.0`, error);
    return 1.0;
  }
}

interface HistoricalFxSeries {
  timestamps: number[];
  rates: number[];
  dailyMap: Map<string, number>;
}

const historicalFxCache = new Map<string, CachedData<HistoricalFxSeries>>();
const HISTORICAL_FX_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchHistoricalFxSeries(
  currency: string,
  range: string,
  interval: string
): Promise<HistoricalFxSeries | null> {
  const cleanCurrency = currency.toUpperCase();
  if (cleanCurrency === 'EUR') return null;

  const effectiveCurrency = cleanCurrency === 'GBP' || cleanCurrency === 'GBP' ? 'GBP' : cleanCurrency;
  const cacheKey = `fx_series_${effectiveCurrency}_${range}_${interval}`;
  const cached = historicalFxCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HISTORICAL_FX_CACHE_TTL) {
    return cached.data;
  }

  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  const pairDirect = `${effectiveCurrency}EUR=X`;
  const pairInverse = `EUR${effectiveCurrency}=X`;

  for (const pair of [pairDirect, pairInverse]) {
    const isInverse = pair === pairInverse;
    for (const host of hosts) {
      try {
        const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
          pair
        )}?interval=${interval}&range=${range}`;
        const res = await fetchWithTimeout(
          url,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: 'application/json, text/plain, */*',
            },
          },
          4000
        );

        if (!res.ok) continue;
        const json = await res.json();
        const r = json?.chart?.result?.[0];
        if (!r || !r.timestamp || r.timestamp.length === 0) continue;

        const tsList: number[] = r.timestamp;
        const closes: (number | null)[] = r.indicators?.quote?.[0]?.close || [];
        const validTs: number[] = [];
        const validRates: number[] = [];
        const dailyMap = new Map<string, number>();

        for (let i = 0; i < tsList.length; i++) {
          const rawC = closes[i];
          if (rawC == null || isNaN(rawC) || rawC <= 0) continue;
          const rate = isInverse ? 1 / rawC : rawC;
          if (!isFinite(rate) || rate <= 0) continue;

          validTs.push(tsList[i]);
          validRates.push(rate);

          const dateStr = new Date(tsList[i] * 1000).toISOString().slice(0, 10);
          dailyMap.set(dateStr, rate);
        }

        if (validTs.length > 0) {
          const seriesData: HistoricalFxSeries = {
            timestamps: validTs,
            rates: validRates,
            dailyMap,
          };
          historicalFxCache.set(cacheKey, { data: seriesData, timestamp: Date.now() });
          return seriesData;
        }
      } catch {
        // try next
      }
    }
  }

  // Fallback para histórico diário caso o intervalo intraday não esteja disponível
  if (interval !== '1d' && interval !== '1mo') {
    try {
      const dailySeries = await fetchHistoricalFxSeries(currency, range, '1d');
      if (dailySeries) {
        historicalFxCache.set(cacheKey, { data: dailySeries, timestamp: Date.now() });
        return dailySeries;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Encontra a taxa de câmbio histórica de forma rigorosa:
 * 1. Timestamp exato ou mais próximo (dentro de tolerância de 2 horas para intraday ou janela do intervalo)
 * 2. Cotação de fecho do mesmo dia (dailyMap)
 * 3. Se nenhuma cotação histórica estiver disponível na data ou janela, devolve null (NÃO fabricar valor nem usar taxa atual constante)
 */
function findHistoricalRate(
  targetSec: number,
  series: HistoricalFxSeries,
  maxToleranceSec: number = 7200
): number | null {
  const { timestamps, rates, dailyMap } = series;
  if (timestamps.length === 0) return null;

  // 1. Procura binária pelo timestamp mais próximo
  let low = 0;
  let high = timestamps.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (timestamps[mid] === targetSec) {
      return rates[mid];
    } else if (timestamps[mid] < targetSec) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  let bestIdx = 0;
  let minDiff = Infinity;
  const checkIndices = [high, low].filter((idx) => idx >= 0 && idx < timestamps.length);

  for (const idx of checkIndices) {
    const diff = Math.abs(timestamps[idx] - targetSec);
    if (diff < minDiff) {
      minDiff = diff;
      bestIdx = idx;
    }
  }

  if (minDiff <= maxToleranceSec) {
    return rates[bestIdx];
  }

  // 2. Fecho do mesmo dia (data civil UTC)
  const targetDateStr = new Date(targetSec * 1000).toISOString().slice(0, 10);
  if (dailyMap.has(targetDateStr)) {
    return dailyMap.get(targetDateStr)!;
  }

  // 3. Dias não úteis (fins de semana ou feriados cambiais): procurar dia útil imediatamente anterior (até 4 dias)
  for (let back = 1; back <= 4; back++) {
    const prevDateStr = new Date(targetSec * 1000 - back * 86400000).toISOString().slice(0, 10);
    if (dailyMap.has(prevDateStr)) {
      return dailyMap.get(prevDateStr)!;
    }
  }

  // Se não for possível obter histórico com segurança cronológica
  return null;
}

async function fetchSingleYahooSymbol(symbol: string) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastError: any = null;

  for (const host of hosts) {
    try {
      const response = await fetchWithTimeout(
        `https://${host}/v8/finance/chart/${encodeURIComponent(
          symbol
        )}?interval=1d&range=3mo`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: 'https://finance.yahoo.com/',
          },
        },
        4500
      );

      if (!response.ok) {
        lastError = new Error(`Yahoo Finance ${host} HTTP ${response.status}`);
        continue;
      }

      const json = await response.json();
      const result = json?.chart?.result?.[0];
      if (!result || !result.meta) {
        lastError = new Error(`Sem dados para o símbolo: ${symbol}`);
        continue;
      }

      const meta = result.meta;
      const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
      if (!price || Number(price) <= 0) {
        lastError = new Error(`Preço nulo ou inválido para ${symbol}`);
        continue;
      }

      const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = Number(price) - Number(previousClose);
      const changePercent = previousClose ? (change / Number(previousClose)) * 100 : 0;

      let monthReturnPercent = Number(changePercent);
      const timestamps: number[] = result.timestamp || [];
      const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

      if (timestamps.length > 0 && closes.length > 0) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let firstMonthPrice: number | null = null;
        let lastPrevMonthPrice: number | null = null;

        for (let i = 0; i < timestamps.length; i++) {
          const c = closes[i];
          if (c === null || c === undefined || isNaN(c) || c <= 0) continue;
          const d = new Date(timestamps[i] * 1000);
          if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
            if (firstMonthPrice === null) {
              firstMonthPrice = c;
            }
          } else if (
            d.getFullYear() < currentYear ||
            (d.getFullYear() === currentYear && d.getMonth() < currentMonth)
          ) {
            lastPrevMonthPrice = c;
          }
        }

        const monthBase = lastPrevMonthPrice || firstMonthPrice;
        if (monthBase && monthBase > 0) {
          monthReturnPercent = ((Number(price) - monthBase) / monthBase) * 100;
        }

        // Variação de 1 semana (aproximadamente 5 sessões de negociação anteriores)
        const validCloses = closes.filter((c) => typeof c === 'number' && !isNaN(c) && c > 0);
        let weekReturnPercent = Number(changePercent);
        if (validCloses.length > 5) {
          const weekPrice = validCloses[validCloses.length - 6];
          if (weekPrice && weekPrice > 0) {
            weekReturnPercent = Number((((Number(price) - weekPrice) / weekPrice) * 100).toFixed(2));
          }
        } else if (validCloses.length > 1) {
          const weekPrice = validCloses[0];
          if (weekPrice && weekPrice > 0) {
            weekReturnPercent = Number((((Number(price) - weekPrice) / weekPrice) * 100).toFixed(2));
          }
        }

        return {
          symbol: meta.symbol || symbol,
          name: meta.shortName || meta.longName || meta.symbol || symbol,
          currency: (meta.currency || 'USD').toUpperCase(),
          price: Number(price),
          change: Number(change),
          changePercent: Number(changePercent),
          weekReturnPercent: isNaN(weekReturnPercent) ? Number(changePercent) : weekReturnPercent,
          monthReturnPercent: Number(monthReturnPercent.toFixed(2)),
          previousClose: Number(previousClose),
          timestamp: Date.now(),
        };
      }

      return {
        symbol: meta.symbol || symbol,
        name: meta.shortName || meta.longName || meta.symbol || symbol,
        currency: (meta.currency || 'USD').toUpperCase(),
        price: Number(price),
        change: Number(change),
        changePercent: Number(changePercent),
        weekReturnPercent: Number(changePercent),
        monthReturnPercent: Number(monthReturnPercent.toFixed(2)),
        previousClose: Number(previousClose),
        timestamp: Date.now(),
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Yahoo Finance indisponível para ${symbol}`);
}

async function fetchFromYahoo(ticker: string) {
  const cleanInput = ticker.trim().toUpperCase();
  const cacheKey = `ticker_${cleanInput}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const candidates: string[] = [];
  if (cleanInput.endsWith('.US')) {
    candidates.push(cleanInput.replace(/\.US$/i, ''));
  }
  if (!candidates.includes(cleanInput)) {
    candidates.push(cleanInput);
  }
  if (cleanInput.startsWith('US.')) {
    candidates.push(cleanInput.replace(/^US\./i, ''));
  }

  for (const sym of candidates) {
    try {
      const data = await fetchSingleYahooSymbol(sym);
      cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch {
      // Continue
    }
  }

  try {
    const searchQuery = cleanInput.replace(/\.US$/i, '');
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
    };
    const searchRes = await fetchWithTimeout(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        searchQuery
      )}&quotesCount=5&newsCount=0`,
      { headers },
      4000
    );
    if (searchRes.ok) {
      const searchJson = await searchRes.json();
      const quotes = searchJson?.quotes || [];
      const matching = quotes.find(
        (q: any) =>
          q.symbol &&
          (q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND')
      );
      if (matching && matching.symbol && !candidates.includes(matching.symbol.toUpperCase())) {
        const data = await fetchSingleYahooSymbol(matching.symbol);
        cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }
    }
  } catch (searchErr) {
    console.warn(`Smart search fallback failed for ${cleanInput}:`, searchErr);
  }

  throw new Error(`Cotação indisponível`);
}

let yahooSessionCache: { cookie: string; crumb: string; timestamp: number } | null = null;
const summaryCache = new Map<string, CachedData<any>>();

async function getYahooSession(): Promise<{ cookie: string; crumb: string } | null> {
  if (yahooSessionCache && Date.now() - yahooSessionCache.timestamp < 30 * 60 * 1000) {
    return { cookie: yahooSessionCache.cookie, crumb: yahooSessionCache.crumb };
  }

  try {
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    
    const fcRes = await fetchWithTimeout('https://fc.yahoo.com', {
      headers: { 'User-Agent': userAgent },
    }, 3500);
    const cookie = fcRes.headers.get('set-cookie') || '';

    const crumbRes = await fetchWithTimeout('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': userAgent,
        Cookie: cookie,
      },
    }, 3500);
    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('<html>')) return null;

    yahooSessionCache = { cookie, crumb: crumb.trim(), timestamp: Date.now() };
    return { cookie, crumb: crumb.trim() };
  } catch {
    return null;
  }
}

async function fetchQuoteSummaryData(symbol: string) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const cacheKey = `qs_${cleanSymbol}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QUOTE_SUMMARY_TTL_MS) {
    return cached.data;
  }

  const session = await getYahooSession();
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  if (session?.cookie) {
    headers['Cookie'] = session.cookie;
  }

  const crumbParam = session?.crumb ? `&crumb=${encodeURIComponent(session.crumb)}` : '';
  const modules = 'summaryDetail,defaultKeyStatistics,financialData,calendarEvents';

  try {
    let res: Response | null = null;
    try {
      res = await fetchWithTimeout(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(cleanSymbol)}?modules=${modules}${crumbParam}`,
        { headers },
        4000
      );
    } catch {
      // ignore
    }

    if (!res || !res.ok) {
      try {
        res = await fetchWithTimeout(
          `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(cleanSymbol)}?modules=${modules}${crumbParam}`,
          { headers },
          4000
        );
      } catch {
        // ignore
      }
    }

    if (!res || !res.ok) {
      if (cached) return cached.data;
      return null;
    }

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0] || null;
    if (result) {
      summaryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    return result;
  } catch {
    if (cached) return cached.data;
    return null;
  }
}

async function fetchChartFromYahoo(ticker: string, requestedRange: string = '1m') {
  const cleanInput = ticker.trim().toUpperCase();
  const rangeConfig = CHART_RANGE_CONFIG[requestedRange.toLowerCase()] || CHART_RANGE_CONFIG['1m'];
  const cacheKey = `chart_${cleanInput}_${rangeConfig.range}_${rangeConfig.interval}`;
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }

  const candidates: string[] = [];
  if (cleanInput.endsWith('.US')) {
    candidates.push(cleanInput.replace(/\.US$/i, ''));
  }
  if (!candidates.includes(cleanInput)) {
    candidates.push(cleanInput);
  }
  if (cleanInput.startsWith('US.')) {
    candidates.push(cleanInput.replace(/^US\./i, ''));
  }

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  let lastError: any = null;
  const isShortPeriod = requestedRange === '1d' || requestedRange === '1w' || requestedRange === '1m';

  for (const sym of candidates) {
    try {
      let response: Response | null = null;
      try {
        response = await fetchWithTimeout(
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            sym
          )}?interval=${rangeConfig.interval}&range=${rangeConfig.range}&includePrePost=${isShortPeriod ? 'true' : 'false'}`,
          { headers },
          5000
        );
      } catch {
        // ignore
      }

      if (!response || !response.ok) {
        try {
          response = await fetchWithTimeout(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
              sym
            )}?interval=${rangeConfig.interval}&range=${rangeConfig.range}&includePrePost=${isShortPeriod ? 'true' : 'false'}`,
            { headers },
            5000
          );
        } catch {
          // ignore
        }
      }

      if (!response || !response.ok) continue;

      const json = await response.json();
      const result = json?.chart?.result?.[0];
      if (!result || !result.meta) continue;

      const meta = result.meta;
      const currency = (meta.currency || 'USD').toUpperCase();
      const isGBp = currency === 'GBP' || currency === 'GBX' || currency === 'PENCE';
      const isEur = currency === 'EUR';

      // 1. Obter taxa cambial spot atual (para métricas gerais de mercado)
      const currentSpotFx = await getFxRateToEur(isGBp ? 'GBP' : (currency === 'GBP' ? 'GBP' : currency));

      // 2. Se a moeda for diferente de EUR, obter o histórico cambial correspondente ao range e intervalo
      let historicalFxSeries: HistoricalFxSeries | null = null;
      if (!isEur) {
        historicalFxSeries = await fetchHistoricalFxSeries(
          currency,
          rangeConfig.range,
          rangeConfig.interval
        );
        // Se a moeda não for EUR e não foi possível obter nenhuma série histórica cambial nem diária,
        // não fabricar valores: lançar erro para tratamento seguro
        if (!historicalFxSeries) {
          throw new Error(`Dados cambiais históricos indisponíveis para a moeda ${currency}`);
        }
      }

      const timestamps: number[] = result.timestamp || [];
      const quoteObj = result.indicators?.quote?.[0] || {};
      const adjcloseObj = result.indicators?.adjclose?.[0] || {};
      const adjcloses: (number | null)[] = adjcloseObj.adjclose || [];
      const closes: (number | null)[] = quoteObj.close || [];
      const opens: (number | null)[] = quoteObj.open || [];
      const highs: (number | null)[] = quoteObj.high || [];
      const lows: (number | null)[] = quoteObj.low || [];
      const volumes: (number | null)[] = quoteObj.volume || [];

      const regularPeriods: Array<{ start: number; end: number }> = [];
      if (meta?.tradingPeriods?.regular && Array.isArray(meta.tradingPeriods.regular)) {
        for (const dayArray of meta.tradingPeriods.regular) {
          if (Array.isArray(dayArray)) {
            for (const p of dayArray) {
              if (p?.start && p?.end) {
                regularPeriods.push({ start: p.start, end: p.end });
              }
            }
          }
        }
      } else if (meta?.currentTradingPeriod?.regular) {
        regularPeriods.push({
          start: meta.currentTradingPeriod.regular.start,
          end: meta.currentTradingPeriod.regular.end,
        });
      }

      const points: Array<{
        timestamp: number;
        date: string;
        price: number;
        priceEur: number;
        isMarketOpen: boolean;
        high?: number;
        low?: number;
        highEur?: number;
        lowEur?: number;
        open?: number;
        volume?: number;
      }> = [];

      for (let i = 0; i < timestamps.length; i++) {
        let c = adjcloses[i];
        if (c === null || c === undefined || isNaN(c) || c <= 0) {
          c = closes[i];
        }
        if (c === null || c === undefined || isNaN(c) || c <= 0) continue;
        const rawSec = timestamps[i];
        const ts = rawSec * 1000;
        const nativeP = Number(c);

        // Obter taxa histórica específica deste ponto (tempo exato ou cotação de fecho do mesmo dia)
        let pointFx = 1.0;
        if (!isEur) {
          let historicalRate = historicalFxSeries
            ? findHistoricalRate(rawSec, historicalFxSeries)
            : null;
          if (historicalRate == null || isNaN(historicalRate) || historicalRate <= 0) {
            // Se para este ponto não houver cotação cambial histórica fiável, usamos a taxa spot atual como fallback seguro
            historicalRate = currentSpotFx;
          }
          pointFx = isGBp ? historicalRate / 100 : historicalRate;
        }

        const pEur = nativeP * pointFx;
        
        let isMarketHours = true;
        if (isShortPeriod) {
          if (regularPeriods.length > 0) {
            isMarketHours = regularPeriods.some((p) => rawSec >= p.start && rawSec <= p.end);
          } else {
            const d = new Date(ts);
            const day = d.getUTCDay();
            const hour = d.getUTCHours();
            isMarketHours = day >= 1 && day <= 5 && (hour >= 13 && hour <= 20);
          }
        }

        const hVal = highs[i] ? Number(highs[i]!.toFixed(4)) : undefined;
        const lVal = lows[i] ? Number(lows[i]!.toFixed(4)) : undefined;
        const hEur = hVal != null ? Number((hVal * pointFx).toFixed(4)) : undefined;
        const lEur = lVal != null ? Number((lVal * pointFx).toFixed(4)) : undefined;

        points.push({
          timestamp: ts,
          date: new Date(ts).toISOString(),
          price: Number(nativeP.toFixed(4)),
          priceEur: Number(pEur.toFixed(4)),
          isMarketOpen: isMarketHours,
          open: opens[i] ? Number(opens[i]!.toFixed(4)) : undefined,
          high: hVal,
          low: lVal,
          highEur: hEur,
          lowEur: lEur,
          volume: volumes[i] ?? undefined,
        });
      }

      if (points.length === 0) {
        throw new Error(`Sem pontos históricos válidos para ${sym}`);
      }

      const cleanReqRange = requestedRange.toLowerCase();
      if (cleanReqRange === '1m') {
        const dateMap = new Map<string, { am: any; pm: any }>();
        points.forEach((pt) => {
          const d = new Date(pt.timestamp);
          const dateStr = d.toISOString().slice(0, 10);
          const hour = d.getHours();
          const bucket = hour < 12 ? 'am' : 'pm';
          if (!dateMap.has(dateStr)) {
            dateMap.set(dateStr, { am: null, pm: null });
          }
          const entry = dateMap.get(dateStr)!;
          if (!entry[bucket]) {
            entry[bucket] = pt;
          }
        });
        const filteredPoints: typeof points = [];
        dateMap.forEach((val) => {
          if (val.am) filteredPoints.push(val.am);
          if (val.pm) filteredPoints.push(val.pm);
        });
        if (filteredPoints.length > 0) {
          points.length = 0;
          points.push(...filteredPoints);
        }
      }

      // Preço atual em EUR: ponto mais recente do gráfico
      const lastPoint = points[points.length - 1];
      const currentPriceNative = meta.regularMarketPrice ?? lastPoint.price;
      const currentPriceEur = lastPoint.priceEur;

      const prevCloseNative = meta.chartPreviousClose ?? meta.previousClose ?? points[0].price;
      const prevCloseEur = isGBp ? (prevCloseNative / 100) * currentSpotFx : prevCloseNative * currentSpotFx;

      // =========================================================================
      // DEFINIÇÃO TEMPORAL DETERMINÍSTICA DA JANELA DO GRÁFICO:
      // =========================================================================
      // 1. Calcula explicitamente o targetStartTimestamp de acordo com o range
      // 2. Seleciona o primeiro ponto histórico negociado no ou imediatamente após esse target
      // 3. Se o target calhar fora de horas de mercado, fim de semana ou feriado,
      //    o primeiro ponto válido após a abertura do mercado é selecionado deterministamente
      // 4. Se nenhum ponto for >= targetStart (ex.: janela excede histórico total),
      //    usa-se o ponto cronologicamente mais próximo (início do histórico)
      const endTimestamp = lastPoint.timestamp;
      const endDate = new Date(endTimestamp);
      let targetStartDate = new Date(endDate);

      if (cleanReqRange === '1d') {
        targetStartDate.setDate(targetStartDate.getDate() - 1);
      } else if (cleanReqRange === '1w') {
        targetStartDate.setDate(targetStartDate.getDate() - 7);
      } else if (cleanReqRange === '1m') {
        targetStartDate.setMonth(targetStartDate.getMonth() - 1);
      } else if (cleanReqRange === '3m') {
        targetStartDate.setMonth(targetStartDate.getMonth() - 3);
      } else if (cleanReqRange === '6m') {
        targetStartDate.setMonth(targetStartDate.getMonth() - 6);
      } else if (cleanReqRange === 'ytd') {
        targetStartDate = new Date(endDate.getFullYear(), 0, 1);
      } else if (cleanReqRange === '1y') {
        targetStartDate.setFullYear(targetStartDate.getFullYear() - 1);
      } else {
        // 'max' / 'tudo': início é o ponto inaugural do histórico
        targetStartDate = new Date(points[0].timestamp);
      }

      const targetStartTimestamp = targetStartDate.getTime();
      let startPointIndex = 0;

      if (cleanReqRange !== 'max') {
        let found = false;
        for (let idx = 0; idx < points.length; idx++) {
          if (points[idx].timestamp >= targetStartTimestamp) {
            startPointIndex = idx;
            found = true;
            break;
          }
        }
        if (!found) {
          let minDiff = Infinity;
          for (let idx = 0; idx < points.length; idx++) {
            const diff = Math.abs(points[idx].timestamp - targetStartTimestamp);
            if (diff < minDiff) {
              minDiff = diff;
              startPointIndex = idx;
            }
          }
        }
      }

      const startPoint = points[startPointIndex];
      const startPriceNative = startPoint.price;
      const startPriceEur = startPoint.priceEur;
      const endPriceNative = lastPoint.price;
      const endPriceEur = lastPoint.priceEur;

      const changeRange = endPriceEur - startPriceEur;
      const changeRangePercent = startPriceEur > 0 ? (changeRange / startPriceEur) * 100 : 0;

      const windowMetrics = {
        range: requestedRange,
        targetStartTimestamp,
        actualStartTimestamp: startPoint.timestamp,
        startPointIndex,
        startPriceNative: Number(startPriceNative.toFixed(4)),
        startPriceEur: Number(startPriceEur.toFixed(4)),
        endTimestamp,
        endPriceNative: Number(endPriceNative.toFixed(4)),
        endPriceEur: Number(endPriceEur.toFixed(4)),
        returnPercentNative: startPriceNative > 0 ? Number((((endPriceNative - startPriceNative) / startPriceNative) * 100).toFixed(2)) : 0,
        returnPercentEur: Number(changeRangePercent.toFixed(2)),
      };

      const summary = await fetchQuoteSummaryData(sym);
      const summaryDetail = summary?.summaryDetail || {};
      const keyStats = summary?.defaultKeyStatistics || {};
      const financial = summary?.financialData || {};
      const calendar = summary?.calendarEvents || {};

      const dayHighNative = summaryDetail.dayHigh?.raw ?? meta.regularMarketDayHigh ?? null;
      const dayLowNative = summaryDetail.dayLow?.raw ?? meta.regularMarketDayLow ?? null;
      const dayHighEur = dayHighNative != null ? (isGBp ? (dayHighNative / 100) * currentSpotFx : dayHighNative * currentSpotFx) : null;
      const dayLowEur = dayLowNative != null ? (isGBp ? (dayLowNative / 100) * currentSpotFx : dayLowNative * currentSpotFx) : null;

      const fiftyTwoWeekHighNative = summaryDetail.fiftyTwoWeekHigh?.raw ?? meta.fiftyTwoWeekHigh ?? null;
      const fiftyTwoWeekLowNative = summaryDetail.fiftyTwoWeekLow?.raw ?? meta.fiftyTwoWeekLow ?? null;
      const fiftyTwoWeekHighEur = fiftyTwoWeekHighNative != null ? (isGBp ? (fiftyTwoWeekHighNative / 100) * currentSpotFx : fiftyTwoWeekHighNative * currentSpotFx) : null;
      const fiftyTwoWeekLowEur = fiftyTwoWeekLowNative != null ? (isGBp ? (fiftyTwoWeekLowNative / 100) * currentSpotFx : fiftyTwoWeekLowNative * currentSpotFx) : null;

      let fiftyTwoWeekRangePercent: number | null = null;
      if (fiftyTwoWeekHighEur != null && fiftyTwoWeekLowEur != null && fiftyTwoWeekHighEur > fiftyTwoWeekLowEur) {
        const ratio = (currentPriceEur - fiftyTwoWeekLowEur) / (fiftyTwoWeekHighEur - fiftyTwoWeekLowEur);
        fiftyTwoWeekRangePercent = Math.max(0, Math.min(100, ratio * 100));
      }

      const pe = summaryDetail.trailingPE?.raw ?? summaryDetail.forwardPE?.raw ?? null;
      const pb = keyStats.priceToBook?.raw ?? null;
      const ps = summaryDetail.priceToSalesTrailing12Months?.raw ?? null;
      const epsNative = keyStats.trailingEps?.raw ?? keyStats.forwardEps?.raw ?? null;
      const epsEur = epsNative != null ? (isGBp ? (epsNative / 100) * currentSpotFx : epsNative * currentSpotFx) : null;
      const beta = summaryDetail.beta?.raw ?? keyStats.beta?.raw ?? null;

      const targetPriceNative = financial.targetMeanPrice?.raw ?? null;
      const targetPriceEur = targetPriceNative != null ? (isGBp ? (targetPriceNative / 100) * currentSpotFx : targetPriceNative * currentSpotFx) : null;
      
      let recommendation: string | null = null;
      if (financial.recommendationKey) {
        const recKey = String(financial.recommendationKey).toLowerCase();
        if (recKey === 'strong_buy') recommendation = 'Compra Forte';
        else if (recKey === 'buy') recommendation = 'Compra';
        else if (recKey === 'hold') recommendation = 'Manter';
        else if (recKey === 'underperform') recommendation = 'Desempenho Inferior';
        else if (recKey === 'sell') recommendation = 'Venda';
      }

      let dividendYield: number | null = null;
      if (summaryDetail.dividendYield?.raw != null) {
        dividendYield = summaryDetail.dividendYield.raw * 100;
      }
      const dividendRateNative = summaryDetail.dividendRate?.raw ?? null;
      const dividendRateEur = dividendRateNative != null ? (isGBp ? (dividendRateNative / 100) * currentSpotFx : dividendRateNative * currentSpotFx) : null;

      let exDividendDate: string | null = null;
      if (summaryDetail.exDividendDate?.raw) {
        exDividendDate = new Date(summaryDetail.exDividendDate.raw * 1000).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }

      let earningsDate: string | null = null;
      const earningsRaw = calendar.earnings?.earningsDate?.[0]?.raw;
      if (earningsRaw) {
        earningsDate = new Date(earningsRaw * 1000).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }

      const metrics = {
        dayHigh: dayHighNative,
        dayLow: dayLowNative,
        dayHighEur,
        dayLowEur,
        fiftyTwoWeekHigh: fiftyTwoWeekHighNative,
        fiftyTwoWeekLow: fiftyTwoWeekLowNative,
        fiftyTwoWeekHighEur,
        fiftyTwoWeekLowEur,
        fiftyTwoWeekRangePercent,
        pe: pe != null ? Number(pe.toFixed(2)) : null,
        pb: pb != null ? Number(pb.toFixed(2)) : null,
        ps: ps != null ? Number(ps.toFixed(2)) : null,
        eps: epsNative != null ? Number(epsNative.toFixed(2)) : null,
        epsEur: epsEur != null ? Number(epsEur.toFixed(2)) : null,
        beta: beta != null ? Number(beta.toFixed(2)) : null,
        targetPrice: targetPriceNative != null ? Number(targetPriceNative.toFixed(2)) : null,
        targetPriceEur: targetPriceEur != null ? Number(targetPriceEur.toFixed(2)) : null,
        recommendation,
        dividendYield: dividendYield != null ? Number(dividendYield.toFixed(2)) : null,
        dividendRate: dividendRateNative != null ? Number(dividendRateNative.toFixed(2)) : null,
        dividendRateEur: dividendRateEur != null ? Number(dividendRateEur.toFixed(2)) : null,
        exDividendDate,
        earningsDate,
      };

      const chartData = {
        symbol: meta.symbol || sym,
        name: meta.shortName || meta.longName || sym,
        currency,
        fxRateToEur: Number(currentSpotFx.toFixed(4)),
        currentPrice: Number(currentPriceNative.toFixed(4)),
        currentPriceEur: Number(currentPriceEur.toFixed(4)),
        previousClose: Number(prevCloseNative.toFixed(4)),
        previousCloseEur: Number(prevCloseEur.toFixed(4)),
        rangeChange: Number(changeRange.toFixed(4)),
        rangeChangePercent: Number(changeRangePercent.toFixed(2)),
        range: requestedRange,
        points,
        windowMetrics,
        metrics,
      };

      cache.set(cacheKey, { data: chartData, timestamp: Date.now() });
      return chartData;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Gráfico indisponível para ${ticker}`);
}

const app = express();
const PORT = 3000;

// CORS and Path normalization for serverless environments (e.g. Vercel)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  if (process.env.VERCEL && req.url && !req.url.startsWith('/api/') && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Sincronização e Backup Cloud redundante em tempo real
let globalPortfolioSyncState: any = {
  holdings: [],
  meta: { totalDeposited: 0, deposits: [] },
  backups: []
};

app.get('/api/portfolio/sync', (req, res) => {
  res.json({
    success: true,
    data: globalPortfolioSyncState,
    timestamp: Date.now()
  });
});

app.post('/api/portfolio/sync', (req, res) => {
  try {
    const { data } = req.body;
    if (data) {
      globalPortfolioSyncState = {
        ...globalPortfolioSyncState,
        ...data,
        lastUpdated: new Date().toISOString()
      };
      return res.json({ success: true, message: 'Portfólio sincronizado com sucesso!' });
    }
    return res.status(400).json({ error: 'Dados inválidos' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao sincronizar' });
  }
});

// 1. API Search
app.get('/api/search', async (req, res) => {
  try {
    const query = ((req.query.q as string) || '').trim();
    if (!query) {
      return res.json({ quotes: [], results: [] });
    }

    const cacheKey = `search_${query.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json({ quotes: cached.data, results: cached.data });
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8',
    };

    let response: Response | null = null;
    try {
      response = await fetchWithTimeout(
        `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
          query
        )}&quotesCount=10&newsCount=0`,
        { headers },
        4000
      );
    } catch {
      // ignore
    }

    if (!response || !response.ok) {
      try {
        response = await fetchWithTimeout(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
            query
          )}&quotesCount=10&newsCount=0`,
          { headers },
          4000
        );
      } catch {
        // ignore
      }
    }

    if (!response || !response.ok) {
      if (cached) return res.json({ quotes: cached.data, results: cached.data });
      return res.json({ quotes: [], results: [] });
    }

    const json = await response.json();
    const quotes = (json?.quotes || []).map((q: any) => ({
      symbol: q.symbol,
      shortname: q.shortname || q.longname || q.symbol,
      longname: q.longname || q.shortname || q.symbol,
      exchange: q.exchange || q.exchDisp || '',
      quoteType: q.quoteType || '',
      score: q.score || 0,
    }));

    cache.set(cacheKey, { data: quotes, timestamp: Date.now() });
    res.json({ quotes, results: quotes });
  } catch (err: any) {
    console.error('Yahoo search error:', err);
    res.status(500).json({ error: err?.message || 'Failed to search Yahoo Finance' });
  }
});

// 2. API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 3. API Chart
app.get('/api/chart/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.trim();
    const range = ((req.query.range as string) || '1m').toLowerCase();
    const chartData = await fetchChartFromYahoo(ticker, range);
    res.json(chartData);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch chart data' });
  }
});

// 4. API Single Quote
app.get('/api/quote/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.trim();
    const quote = await fetchSingleQuoteWithFallback(ticker, getFxRateToEur);
    if (quote.error) {
      return res.status(404).json({ error: quote.errorMessage || 'Cotação indisponível' });
    }
    res.json(quote);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch quote' });
  }
});

// 5. API Batch Quotes (supports both GET and POST)
const handleBatchQuotes = async (req: express.Request, res: express.Response) => {
  let tickers: string[] = [];
  if (typeof req.query.symbols === 'string') {
    tickers = req.query.symbols.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (typeof req.query.tickers === 'string') {
    tickers = req.query.tickers.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(req.body?.tickers)) {
    tickers = req.body.tickers.map((s: any) => String(s).trim()).filter(Boolean);
  } else if (Array.isArray(req.body?.symbols)) {
    tickers = req.body.symbols.map((s: any) => String(s).trim()).filter(Boolean);
  }

  const force = req.query.force === 'true' || req.body?.force === true;
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (!tickers || tickers.length === 0) {
    return res.json({ quotes: {} });
  }

  // Auto-subscribe WebSockets dynamically for requested tickers (only on standalone servers, not Vercel Serverless)
  try {
    if (!process.env.VERCEL) {
      connectAlpacaStream(tickers);
      connectFinnhubStream(tickers);
    }
  } catch {}

  try {
    const quotesResult = await orchestrateQuotes(tickers, getFxRateToEur, force);
    res.json({ quotes: quotesResult });
  } catch (error: any) {
    console.error('Erro global na rota /api/quotes:', error);
    res.status(500).json({ error: error.message || 'Erro interno no servidor' });
  }
};

app.get('/api/quotes', handleBatchQuotes);
app.post('/api/quotes', handleBatchQuotes);

// 6. API FX Rate
app.get('/api/fx/:from', async (req, res) => {
  try {
    const from = req.params.from.toUpperCase();
    const rate = await getFxRateToEur(from);
    res.json({ from, to: 'EUR', rate });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch FX' });
  }
});

// 7. API FX Convert
app.get('/api/fx/convert/rate', async (req, res) => {
  try {
    const from = ((req.query.from as string) || 'USD').toUpperCase();
    const to = ((req.query.to as string) || 'EUR').toUpperCase();
    const fx = await getExchangeRate(from, to);
    res.json(fx);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to convert currency' });
  }
});

// 8. Alpaca WebSocket Live Prices
app.get('/api/alpaca/live', (req, res) => {
  res.json({ prices: getAlpacaLivePrices() });
});

app.post('/api/alpaca/subscribe', (req, res) => {
  const symbols = req.body?.symbols || req.body?.tickers || [];
  if (Array.isArray(symbols) && symbols.length > 0 && !process.env.VERCEL) {
    connectAlpacaStream(symbols);
    connectFinnhubStream(symbols);
  }
  res.json({ status: 'ok', subscribed: symbols });
});

// Initialize WebSocket streams on boot (only on standalone servers, not Vercel Serverless)
if (!process.env.VERCEL) {
  connectAlpacaStream(['SKHY', 'ORCL', 'GOOGL', 'SKM', 'AMZN']);
  connectFinnhubStream(['SPCX', 'LEU']);
}

// In development / production
if (!process.env.VERCEL) {
  void (async () => {
    if (process.env.NODE_ENV !== 'production') {
      const viteModuleName = 'vite';
      const { createServer: createViteServer } = await import(viteModuleName);
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })();
}

export default app;
