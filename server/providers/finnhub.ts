import { RawProviderQuote } from './yahoo';

const KEYS = [
  process.env.FINNHUB_API_KEY_1 || 'dag9ggpr01quf8mtbus0dag9ggpr01quf8mtbusg',
  process.env.FINNHUB_API_KEY_2 || 'dajunfhr01qrg9hppa10dajunfhr01qrg9hppa1g',
];

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

      const res = await fetch(quoteUrl);
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
        const profileRes = await fetch(profileUrl);
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
        monthReturnPercent: Number(changePercent.toFixed(2)),
        source: 'finnhub',
      };
    } catch {
      // Try next key on network error
    }
  }

  return null;
}
