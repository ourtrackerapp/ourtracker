import WebSocket from 'ws';
import { DEFAULT_ALPACA_KEY_ID, DEFAULT_ALPACA_SECRET_KEY } from './alpacaCredentials.js';

interface LivePriceStore {
  [symbol: string]: {
    price: number;
    timestamp: number;
    source: string;
  };
}

let livePrices: LivePriceStore = {};
let wsClient: WebSocket | null = null;
let currentSubscribedSymbols: string[] = [];
let isAuthenticated = false;

export function getAlpacaLivePrices(): LivePriceStore {
  return livePrices;
}

export function connectAlpacaStream(symbols: string[] = []) {
  const apiKey = process.env.ALPACA_API_KEY_ID || DEFAULT_ALPACA_KEY_ID;
  const apiSecret = process.env.ALPACA_API_SECRET_KEY || DEFAULT_ALPACA_SECRET_KEY;

  if (!apiKey || !apiSecret || apiKey.startsWith('YOUR_') || apiSecret.startsWith('YOUR_')) {
    console.warn('Alpaca WebSocket skipped: Missing credentials in environment and alpacaCredentials.ts');
    return;
  }

  // O Alpaca só suporta ações/ativos do mercado norte-americano (US)
  // Filtrar tickers internacionais (ex: .DE, .MC, .PA) e manter apenas ações válidas US
  const cleanSymbols = Array.from(
    new Set(
      symbols
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.endsWith('.US') || (!s.includes('.') && /^[A-Z0-9]{1,6}$/.test(s)))
        .map((s) => s.replace(/\.US$/i, ''))
        .filter((s) => /^[A-Z0-9]{1,6}$/.test(s))
    )
  );

  const prevSymbols = [...currentSubscribedSymbols];
  currentSubscribedSymbols = cleanSymbols;

  // 1. Se o socket já estiver ABERTO e AUTENTICADO, atualizar subscrições sem fechar a ligação
  if (wsClient && wsClient.readyState === WebSocket.OPEN && isAuthenticated) {
    const toUnsub = prevSymbols.filter((s) => !cleanSymbols.includes(s));
    if (toUnsub.length > 0) {
      console.log('Alpaca WebSocket: cancelando subscrição de removidos:', toUnsub);
      wsClient.send(
        JSON.stringify({
          action: 'unsubscribe',
          trades: toUnsub,
          quotes: toUnsub,
        })
      );
    }
    const toSub = cleanSymbols.filter((s) => !prevSymbols.includes(s));
    if (toSub.length > 0) {
      console.log('Alpaca WebSocket: subscrevendo novos ativos:', toSub);
      wsClient.send(
        JSON.stringify({
          action: 'subscribe',
          trades: toSub,
          quotes: toSub,
        })
      );
    }
    return;
  }

  // 2. Se o socket ainda estiver em fase de CONEXÃO, apenas registamos os símbolos
  if (wsClient && wsClient.readyState === WebSocket.CONNECTING) {
    console.log('Alpaca WebSocket ainda em conexão. Símbolos atualizados para:', cleanSymbols);
    return;
  }

  // 3. Se o socket estiver fechado ou nulo, encerrar o antigo com segurança sem disparar erros
  if (wsClient) {
    try {
      (wsClient as any).isClosedByApp = true;
      wsClient.removeAllListeners('error');
      wsClient.on('error', () => {}); // Silencia erros na desativação
      wsClient.terminate();
    } catch {}
    wsClient = null;
    isAuthenticated = false;
  }

  const url = 'wss://stream.data.alpaca.markets/v2/iex';
  console.log('Connecting to Alpaca WebSocket stream:', url);

  const ws = new WebSocket(url);
  wsClient = ws;
  isAuthenticated = false;

  ws.on('open', () => {
    console.log('Alpaca WebSocket connected, authenticating...');
    ws.send(
      JSON.stringify({
        action: 'auth',
        key: apiKey,
        secret: apiSecret,
      })
    );
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const messages = JSON.parse(data.toString());
      if (!Array.isArray(messages)) return;

      messages.forEach((msg: any) => {
        if (msg.T === 'success' && msg.msg === 'authenticated') {
          isAuthenticated = true;
          console.log('Alpaca WebSocket authenticated successfully. Subscribing to:', currentSubscribedSymbols);
          if (currentSubscribedSymbols.length > 0) {
            ws.send(
              JSON.stringify({
                action: 'subscribe',
                trades: currentSubscribedSymbols,
                quotes: currentSubscribedSymbols,
              })
            );
          }
        } else if (msg.T === 'error') {
          if (msg.code === 406) {
            console.warn('Alpaca WebSocket connection limit reached. REST snapshots active.');
          } else {
            console.warn('Alpaca WebSocket error message:', msg);
          }
        } else if (msg.T === 't' && msg.S && msg.p) {
          // Trade update
          livePrices[msg.S] = {
            price: Number(msg.p),
            timestamp: msg.t ? new Date(msg.t).getTime() : Date.now(),
            source: 'Alpaca-WS',
          };
        } else if (msg.T === 'q' && msg.S && msg.ap) {
          // Quote update (ask price or bid price)
          const askPrice = Number(msg.ap);
          if (askPrice > 0) {
            livePrices[msg.S] = {
              price: askPrice,
              timestamp: msg.t ? new Date(msg.t).getTime() : Date.now(),
              source: 'Alpaca-WS',
            };
          }
        }
      });
    } catch (err) {
      console.error('Error parsing Alpaca WS message:', err);
    }
  });

  ws.on('error', (err: any) => {
    if ((ws as any).isClosedByApp || err?.message?.includes('closed before the connection was established')) {
      return;
    }
    console.error('Alpaca WebSocket error:', err);
  });

  ws.on('close', () => {
    isAuthenticated = false;
    if ((ws as any).isClosedByApp) {
      console.log('Alpaca WebSocket closed intentionally by application. Reconnect skipped.');
      return;
    }
    console.warn('Alpaca WebSocket closed unexpectedly. Reconnecting in 5s...');
    setTimeout(() => {
      // Re-check if this socket is still the active one before reconnecting
      if (wsClient === ws) {
        connectAlpacaStream(currentSubscribedSymbols);
      }
    }, 5000);
  });
}
