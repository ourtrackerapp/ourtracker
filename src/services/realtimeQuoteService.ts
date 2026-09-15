// Serviço de fallback direto em tempo real no cliente para Vercel e Browser
export interface DirectQuote {
  ticker: string;
  name?: string;
  price: number;
  currency: string;
  priceInEur: number;
  changePercent: number;
  monthReturnPercent: number;
  timestamp: number;
  error?: boolean;
  errorMessage?: string;
}

// Obter taxa USD->EUR em tempo real de APIs públicas e abertas
let cachedUsdEurRate = 0.92;
let lastRateFetch = 0;

export async function getLiveUsdEurRate(): Promise<number> {
  const now = Date.now();
  if (now - lastRateFetch < 5 * 60 * 1000 && cachedUsdEurRate > 0) {
    return cachedUsdEurRate;
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.EUR) {
        cachedUsdEurRate = Number(data.rates.EUR);
        lastRateFetch = now;
        return cachedUsdEurRate;
      }
    }
  } catch {}

  try {
    const res2 = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2?.rates?.EUR) {
        cachedUsdEurRate = Number(data2.rates.EUR);
        lastRateFetch = now;
        return cachedUsdEurRate;
      }
    }
  } catch {}

  return cachedUsdEurRate;
}

// Converter símbolos para formato Yahoo padrão
export function formatSymbolForQuery(rawTicker: string): string {
  const t = rawTicker.trim().toUpperCase();
  if (t === 'SXR8.DE') return 'SXR8.DE';
  if (t === 'VVSM.DE') return 'VVSM.DE';
  if (t.endsWith('.US')) return t.replace(/\.US$/i, '');
  return t;
}

// Buscar cotação direta em tempo real via Yahoo Query CORS Proxy / Finnhub / CoinGecko
export async function fetchDirectRealtimeQuote(ticker: string): Promise<DirectQuote | null> {
  const cleanTicker = ticker.trim().toUpperCase();
  const querySymbol = formatSymbolForQuery(cleanTicker);
  const usdEurRate = await getLiveUsdEurRate();

  // 1. Tentar Finnhub para ações dos EUA
  const finnhubKey = 'cvi73f9r01qgcnd3vbh0cvi73f9r01qgcnd3vbhg';
  if (!querySymbol.includes('.')) {
    try {
      const fhRes = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(querySymbol)}&token=${finnhubKey}`
      );
      if (fhRes.ok) {
        const fhData = await fhRes.json();
        const currentPrice = Number(fhData.c);
        if (currentPrice && currentPrice > 0) {
          const changePercent = Number(fhData.dp || 0);
          const priceInEur = currentPrice * usdEurRate;
          return {
            ticker: cleanTicker,
            name: querySymbol,
            price: currentPrice,
            currency: 'USD',
            priceInEur,
            changePercent,
            monthReturnPercent: changePercent,
            timestamp: Date.now(),
          };
        }
      }
    } catch {}
  }

  // 2. Tentar proxies rápidos e abertos de Yahoo Finance Chart API
  const yahooProxies = [
    (sym: string) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d`,
    (sym: string) => `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d`,
    (sym: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1mo&interval=1d`)}`,
  ];

  for (const proxyGen of yahooProxies) {
    try {
      const url = proxyGen(querySymbol);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
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

      const currency = (meta.currency || (querySymbol.endsWith('.DE') ? 'EUR' : 'USD')).toUpperCase();
      let priceInEur = regularPrice;
      if (currency === 'USD') {
        priceInEur = regularPrice * usdEurRate;
      } else if (currency !== 'EUR') {
        priceInEur = regularPrice * usdEurRate;
      }

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

      return {
        ticker: cleanTicker,
        name: meta.shortName || meta.longName || cleanTicker,
        price: regularPrice,
        currency,
        priceInEur,
        changePercent,
        monthReturnPercent,
        timestamp: Date.now(),
      };
    } catch {}
  }

  return null;
}
