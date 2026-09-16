// Serviço em tempo real: 1º Yahoo Finance -> 2º TwelveData -> 3º Finnhub
// Conversão de Moedas: Gratuita (Frankfurter API / Open Exchange Rates)

export interface DirectQuote {
  ticker: string;
  name?: string;
  price: number;
  currency: string;
  priceInEur: number;
  changePercent: number;
  weekReturnPercent?: number;
  monthReturnPercent: number;
  threeMonthReturnPercent?: number;
  timestamp: number;
  source: 'yahoo' | 'twelvedata' | 'finnhub';
  error?: boolean;
  errorMessage?: string;
}

// Obter taxa cambial USD/EUR e outras moedas para EUR de forma 100% gratuita em tempo real
let cachedUsdEurRate = 0.92;
let lastRateFetch = 0;

export async function getLiveFxToEur(fromCurrency: string): Promise<number> {
  const cleanFrom = fromCurrency.toUpperCase();
  if (cleanFrom === 'EUR') return 1.0;

  const now = Date.now();
  if (cleanFrom === 'USD' && now - lastRateFetch < 2 * 60 * 1000 && cachedUsdEurRate > 0) {
    return cachedUsdEurRate;
  }

  // 1. Frankfurter API (Banco Central Europeu - Oficial & Gratuito)
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${cleanFrom}&to=EUR`);
    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.EUR) {
        const rate = Number(data.rates.EUR);
        if (cleanFrom === 'USD') {
          cachedUsdEurRate = rate;
          lastRateFetch = now;
        }
        return rate;
      }
    }
  } catch {}

  // 2. Open Exchange Rates aberto
  try {
    const res2 = await fetch(`https://open.er-api.com/v6/latest/${cleanFrom}`);
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2?.rates?.EUR) {
        const rate = Number(data2.rates.EUR);
        if (cleanFrom === 'USD') {
          cachedUsdEurRate = rate;
          lastRateFetch = now;
        }
        return rate;
      }
    }
  } catch {}

  return cleanFrom === 'USD' ? cachedUsdEurRate : 1.0;
}

// Símbolos especiais ou substitutos conhecidos
export function formatSymbolForYahoo(rawTicker: string): string {
  const t = rawTicker.trim().toUpperCase();
  if (t === 'SXR8.DE' || t === 'SXR8') return 'SXR8.DE';
  if (t === 'VVSM.DE' || t === 'VVSM') return 'VVSM.DE';
  if (t === 'SPCX' || t === 'SPCX.US' || t === 'SPACEX') return 'SPCX';
  if (t === '000660.KS' || t === 'SKHY.US' || t === 'SKHYNIX') return '000660.KS';
  if (t.endsWith('.US')) return t.replace(/\.US$/i, '');
  return t;
}

// 1. MOTOR PRINCIPAL: Yahoo Finance em Tempo Real
async function fetchFromYahoo(ticker: string): Promise<DirectQuote | null> {
  const yahooSymbol = formatSymbolForYahoo(ticker);
  const candidateSymbols = [yahooSymbol];
  if (yahooSymbol === '000660.KS') candidateSymbols.push('HXSCF');
  if (yahooSymbol.endsWith('.DE')) candidateSymbols.push(yahooSymbol.replace(/\.DE$/i, ''));

  for (const sym of candidateSymbols) {
    const yahooUrls = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d&includePrePost=false`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d&includePrePost=false`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1mo&interval=1d`)}`,
    ];

    for (const url of yahooUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) continue;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) continue;

        let regularPrice = Number(meta.regularMarketPrice ?? meta.chartPreviousClose ?? meta.previousClose);
        const closes: number[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        const validCloses = closes.filter((c) => typeof c === 'number' && !isNaN(c) && c > 0);

        if ((!regularPrice || regularPrice <= 0) && validCloses.length > 0) {
          regularPrice = validCloses[validCloses.length - 1];
        }

        if (!regularPrice || regularPrice <= 0) continue;

        const currency = (meta.currency || (sym.endsWith('.DE') ? 'EUR' : sym.endsWith('.KS') ? 'KRW' : 'USD')).toUpperCase();
        const fxRate = await getLiveFxToEur(currency);
        const priceInEur = regularPrice * fxRate;

        let changePercent = 0;
        const prevClose = Number(meta.chartPreviousClose || meta.previousClose);
        if (prevClose && prevClose > 0) {
          changePercent = Number((((regularPrice - prevClose) / prevClose) * 100).toFixed(2));
        }

        let monthReturnPercent = changePercent;
        if (validCloses.length > 1) {
          const firstPrice = validCloses[0];
          monthReturnPercent = Number((((regularPrice - firstPrice) / firstPrice) * 100).toFixed(2));
        }

        // Variação de 1 semana (aproximadamente 5 pregões anteriores)
        let weekReturnPercent = changePercent;
        if (validCloses.length > 5) {
          const weekPrice = validCloses[validCloses.length - 6];
          if (weekPrice && weekPrice > 0) {
            weekReturnPercent = Number((((regularPrice - weekPrice) / weekPrice) * 100).toFixed(2));
          }
        } else if (validCloses.length > 1) {
          const weekPrice = validCloses[0];
          if (weekPrice && weekPrice > 0) {
            weekReturnPercent = Number((((regularPrice - weekPrice) / weekPrice) * 100).toFixed(2));
          }
        }

        return {
          ticker: ticker.toUpperCase(),
          name: meta.shortName || meta.longName || sym,
          price: regularPrice,
          currency,
          priceInEur,
          changePercent,
          weekReturnPercent: isNaN(weekReturnPercent) ? changePercent : weekReturnPercent,
          monthReturnPercent,
          timestamp: Date.now(),
          source: 'yahoo',
        };
      } catch {}
    }
  }
  return null;
}

// 2. MOTOR SECUNDÁRIO: TwelveData em Tempo Real
const TWELVE_KEYS = [
  'c680e1388d9d40a28b1e2b3649aafefb',
  'bc26ad2a1fbd43448e2c6c75b920cf79',
];

async function fetchFromTwelveData(ticker: string): Promise<DirectQuote | null> {
  const cleanTicker = ticker.replace(/\.US$/i, '').toUpperCase();
  for (const key of TWELVE_KEYS) {
    try {
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(cleanTicker)}&apikey=${key}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === 'error' || data.code === 429) continue;

      const price = parseFloat(data.close || data.price || data.previous_close);
      if (isNaN(price) || price <= 0) continue;

      const currency = (data.currency || 'USD').toUpperCase();
      const fxRate = await getLiveFxToEur(currency);
      const priceInEur = price * fxRate;
      const changePercent = data.percent_change ? parseFloat(data.percent_change) : 0;

      return {
        ticker: ticker.toUpperCase(),
        name: data.name || cleanTicker,
        price,
        currency,
        priceInEur,
        changePercent,
        monthReturnPercent: changePercent,
        timestamp: Date.now(),
        source: 'twelvedata',
      };
    } catch {}
  }
  return null;
}

// 3. MOTOR TERCIÁRIO: Finnhub em Tempo Real
async function fetchFromFinnhub(ticker: string): Promise<DirectQuote | null> {
  const finnhubKey = 'cvi73f9r01qgcnd3vbh0cvi73f9r01qgcnd3vbhg';
  const cleanTicker = ticker.replace(/\.US$/i, '').toUpperCase();
  if (cleanTicker.includes('.')) return null; // Finnhub gratuito suporta US

  try {
    const fhRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cleanTicker)}&token=${finnhubKey}`
    );
    if (!fhRes.ok) return null;
    const fhData = await fhRes.json();
    const currentPrice = Number(fhData.c);
    if (!currentPrice || currentPrice <= 0) return null;

    const fxRate = await getLiveFxToEur('USD');
    const changePercent = Number(fhData.dp || 0);

    return {
      ticker: ticker.toUpperCase(),
      name: cleanTicker,
      price: currentPrice,
      currency: 'USD',
      priceInEur: currentPrice * fxRate,
      changePercent,
      monthReturnPercent: changePercent,
      timestamp: Date.now(),
      source: 'finnhub',
    };
  } catch {
    return null;
  }
}

// Orquestrador de cotações em tempo real: Yahoo -> TwelveData -> Finnhub
export async function fetchDirectRealtimeQuote(ticker: string): Promise<DirectQuote | null> {
  // 1º Prioridade: Yahoo Finance
  const yahooQuote = await fetchFromYahoo(ticker);
  if (yahooQuote && yahooQuote.priceInEur > 0) return yahooQuote;

  // 2º Prioridade: TwelveData
  const tdQuote = await fetchFromTwelveData(ticker);
  if (tdQuote && tdQuote.priceInEur > 0) return tdQuote;

  // 3º Prioridade: Finnhub
  const fhQuote = await fetchFromFinnhub(ticker);
  if (fhQuote && fhQuote.priceInEur > 0) return fhQuote;

  return null;
}
