import fetch from 'node-fetch';
import { RawProviderQuote, withTimeout } from './yahoo.js';

const DEFAULT_ALPACA_KEY_ID = 'PK7WO5X3UXAXJPFDU27ZPJGHBP';
const DEFAULT_ALPACA_SECRET_KEY = 'HwD6C4i7GoDuiuvEbrdTAgRqvuxXCJYo66sGSdDv2ttZ';

export async function getAlpacaQuote(symbol: string): Promise<RawProviderQuote | null> {
  const apiKey = process.env.ALPACA_API_KEY_ID || DEFAULT_ALPACA_KEY_ID;
  const apiSecret = process.env.ALPACA_API_SECRET_KEY || DEFAULT_ALPACA_SECRET_KEY;

  if (!apiKey || !apiSecret || apiKey.startsWith('YOUR_') || apiSecret.startsWith('YOUR_')) {
    return null;
  }

  // Clean symbol for Alpaca (remove .US if present)
  const cleanSymbol = symbol.trim().toUpperCase().replace(/\.US$/i, '');

  try {
    const headers = {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
      'Accept': 'application/json',
    };

    // Try multi-symbol snapshots first
    const url = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(cleanSymbol)}`;
    const response = await withTimeout(fetch(url, { headers }), 4000);

    let item: any = null;
    if (response && response.ok) {
      const data: any = await response.json();
      item = data[cleanSymbol] || data[cleanSymbol.toUpperCase()] || data[cleanSymbol.toLowerCase()];
    }

    // Fallback to single-symbol snapshot endpoint if multi-symbol didn't yield results
    if (!item) {
      const fallbackUrl = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(cleanSymbol)}/snapshot`;
      const fallbackResponse = await withTimeout(fetch(fallbackUrl, { headers }), 4000);
      if (fallbackResponse && fallbackResponse.ok) {
        item = await fallbackResponse.json();
      }
    }

    if (!item) return null;

    const latestTrade = item.latestTrade || item.latest_trade;
    const dailyBar = item.dailyBar || item.daily_bar;
    const prevDailyBar = item.prevDailyBar || item.prev_daily_bar;
    const latestQuote = item.latestQuote || item.latest_quote;

    const price = latestTrade?.p || dailyBar?.c || latestQuote?.ap || latestQuote?.bp || 0;
    const prevClose = prevDailyBar?.c || dailyBar?.o || price;

    if (!price || price <= 0) return null;

    const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

    return {
      name: cleanSymbol,
      price,
      currency: 'USD', // Alpaca stocks are primarily USD
      changePercent,
      source: 'Alpaca-REST',
    };
  } catch (err) {
    return null;
  }
}
