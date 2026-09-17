import WebSocket from 'ws';
import { RawProviderQuote } from './yahoo.js';

const KEYS = [
  process.env.FINNHUB_API_KEY_1 || 'dag9ggpr01quf8mtbus0dag9ggpr01quf8mtbusg',
  process.env.FINNHUB_API_KEY_2 || 'dajunfhr01qrg9hppa10dajunfhr01qrg9hppa1g',
];

interface LivePriceStore {
  [symbol: string]: {
    price: number;
    timestamp: number;
    source: string;
  };
}

const livePrices: LivePriceStore = {};
let wsClient: WebSocket | null = null;
let currentKeyIndex = 0;
let currentSubscribedSymbols: string[] = [];

export function getFinnhubLivePrices(): LivePriceStore {
  return livePrices;
}

export function connectFinnhubStream(symbols: string[] = []) {
  if (symbols.length === 0) return;
  
  const apiKey = KEYS[currentKeyIndex % KEYS.length];
  if (!apiKey) return;

  const cleanSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase())));
  const prevSymbols = [...currentSubscribedSymbols];
  currentSubscribedSymbols = cleanSymbols;

  // 1. Se já estiver ABERTO, atualizar apenas os símbolos que mudaram
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    const toUnsub = prevSymbols.filter((s) => !cleanSymbols.includes(s));
    toUnsub.forEach((symbol) => {
      wsClient?.send(JSON.stringify({ type: 'unsubscribe', symbol }));
    });
    const toSub = cleanSymbols.filter((s) => !prevSymbols.includes(s));
    toSub.forEach((symbol) => {
      wsClient?.send(JSON.stringify({ type: 'subscribe', symbol }));
    });
    return;
  }

  // 2. Se estiver a conectar, atualizar apenas a lista
  if (wsClient && wsClient.readyState === WebSocket.CONNECTING) {
    return;
  }

  if (wsClient) {
    try {
      (wsClient as any).isClosedByApp = true;
      wsClient.removeAllListeners('error');
      wsClient.on('error', () => {});
      wsClient.terminate();
    } catch {}
    wsClient = null;
  }

  const url = `wss://ws.finnhub.io?token=${apiKey}`;
  console.log(`Connecting to Finnhub WebSocket (Key ${currentKeyIndex + 1}):`, url);

  const ws = new WebSocket(url);
  wsClient = ws;

  ws.on('open', () => {
    console.log(`Finnhub WebSocket connected (Key ${currentKeyIndex + 1})`);
    currentSubscribedSymbols.forEach(symbol => {
      ws.send(JSON.stringify({ type: 'subscribe', symbol }));
    });
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'data') {
        msg.data.forEach((update: any) => {
          livePrices[update.s] = {
            price: Number(update.p),
            timestamp: update.t,
            source: 'Finnhub-WS'
          };
        });
      } else if (msg.type === 'error') {
        console.error('Finnhub WebSocket Error:', msg.msg || msg);
        if (msg.msg?.toLowerCase().includes('limit') || msg.msg?.toLowerCase().includes('credit')) {
          console.warn('Switching Finnhub WebSocket key...');
          currentKeyIndex = (currentKeyIndex + 1) % KEYS.length;
          connectFinnhubStream(currentSubscribedSymbols);
        }
      }
    } catch (err) {
      console.error('Error parsing Finnhub WS message:', err);
    }
  });

  ws.on('error', (err: any) => {
    if ((ws as any).isClosedByApp || err?.message?.includes('closed before the connection was established')) {
      return;
    }
    console.error('Finnhub WebSocket error:', err);
  });

  ws.on('close', () => {
    if ((ws as any).isClosedByApp) return;
    console.warn('Finnhub WebSocket closed. Reconnecting in 5s...');
    setTimeout(() => {
      if (wsClient === ws) connectFinnhubStream(currentSubscribedSymbols);
    }, 5000);
  });
}

let keyIndex = 0;

function getNextKeyOrder(): string[] {
  const first = KEYS[keyIndex % KEYS.length];
  const second = KEYS[(keyIndex + 1) % KEYS.length];
  keyIndex = (keyIndex + 1) % KEYS.length;
  return [first, second];
}

export async function getFinnhubQuote(ticker: string): Promise<RawProviderQuote | null> {
  const cleanTicker = ticker.trim().toUpperCase();
  const searchTicker = cleanTicker.endsWith('.US')
    ? cleanTicker.replace(/\.US$/i, '')
    : cleanTicker;

  const keyOrder = getNextKeyOrder();

  for (const apiKey of keyOrder) {
    if (!apiKey) continue;
    try {
      const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
        searchTicker
      )}&token=${apiKey}`;

      const res = await fetch(quoteUrl, { signal: AbortSignal.timeout(4000) });
      if (res.status === 429) {
        // Rate limit hit, try next key
        continue;
      }

      if (!res.ok) continue;

      const quoteData = await res.json();
      const currentPrice = Number(quoteData.c);
      if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {
        continue;
      }

      // Calculate change percent
      let changePercent = Number(quoteData.dp || 0);
      if (changePercent === 0 && quoteData.pc && quoteData.pc > 0) {
        changePercent = ((currentPrice - quoteData.pc) / quoteData.pc) * 100;
      }

      // Fetch company profile for name and currency
      let name = searchTicker;
      let currency = 'USD';

      try {
        const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(
          searchTicker
        )}&token=${apiKey}`;
        const profileRes = await fetch(profileUrl, { signal: AbortSignal.timeout(3000) });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.name) name = profileData.name;
          if (profileData.currency) currency = profileData.currency.toUpperCase();
        }
      } catch {
        // Profile fetch failure is non-fatal
      }

      return {
        price: currentPrice,
        currency,
        name,
        changePercent: Number(changePercent.toFixed(2)),
        source: 'finnhub',
      };
    } catch {
      // Try next key on network error
    }
  }

  return null;
}
