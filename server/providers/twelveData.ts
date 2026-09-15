import { RawProviderQuote } from './yahoo';

const KEYS = [
  process.env.TWELVE_DATA_API_KEY_1 || 'c680e1388d9d40a28b1e2b3649aafefb',
  process.env.TWELVE_DATA_API_KEY_2 || 'bc26ad2a1fbd43448e2c6c75b920cf79',
];

let keyIndex = 0;

function getNextKeyOrder(): string[] {
  const first = KEYS[keyIndex % KEYS.length];
  const second = KEYS[(keyIndex + 1) % KEYS.length];
  keyIndex = (keyIndex + 1) % KEYS.length;
  return [first, second];
}

export async function getTwelveDataQuote(ticker: string): Promise<RawProviderQuote | null> {
  const cleanTicker = ticker.trim().toUpperCase();
  const searchTicker = cleanTicker.endsWith('.US')
    ? cleanTicker.replace(/\.US$/i, '')
    : cleanTicker;

  const keyOrder = getNextKeyOrder();

  for (const apiKey of keyOrder) {
    if (!apiKey) continue;
    try {
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
        searchTicker
      )}&apikey=${apiKey}`;

      const res = await fetch(url);
      if (res.status === 429) {
        // Rate limit, try next key
        continue;
      }

      if (!res.ok) continue;

      const data = await res.json();

      // Check if Twelve Data returned an error or limit code
      if (data.status === 'error' || data.code === 429 || data.code === 400) {
        // If it's a rate limit or credit issue, loop to next key
        if (data.code === 429 || (data.message && data.message.toLowerCase().includes('limit'))) {
          continue;
        }
        return null;
      }

      const price = parseFloat(data.close || data.price || data.previous_close);
      if (isNaN(price) || price <= 0) continue;

      const currency = (data.currency || 'USD').toUpperCase();
      const changePercent = data.percent_change ? parseFloat(data.percent_change) : 0;

      return {
        price,
        currency,
        name: data.name || searchTicker,
        changePercent: isNaN(changePercent) ? 0 : Number(changePercent.toFixed(2)),
        monthReturnPercent: isNaN(changePercent) ? 0 : Number(changePercent.toFixed(2)),
        source: 'twelvedata',
      };
    } catch {
      // Try next key on network error
    }
  }

  return null;
}
