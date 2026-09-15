import YahooFinance from 'yahoo-finance2';

export interface RawProviderQuote {
  price: number;
  currency: string;
  name?: string;
  changePercent?: number;
  monthReturnPercent?: number;
  source: 'yahoo' | 'twelvedata' | 'finnhub';
}

const yf = new YahooFinance({
  validation: { logErrors: false },
});

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Helper to fetch directly from query1 / query2 as fallback with multi-range support
async function fetchYahooChartDirect(ticker: string, host: string): Promise<RawProviderQuote | null> {
  const ranges = ['1d', '5d', '1mo'];
  for (const range of ranges) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d&includePrePost=false`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://finance.yahoo.com',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (!result || !result.meta) continue;

      const meta = result.meta;
      const currency = (meta.currency || (ticker.endsWith('.DE') ? 'EUR' : 'USD')).toUpperCase();

      let regularPrice =
        meta.regularMarketPrice ??
        meta.chartPreviousClose ??
        meta.previousClose;

      if (!regularPrice || isNaN(regularPrice) || Number(regularPrice) <= 0) {
        const closes: number[] = result.indicators?.quote?.[0]?.close || [];
        const valid = closes.filter((c) => typeof c === 'number' && !isNaN(c) && c > 0);
        if (valid.length > 0) {
          regularPrice = valid[valid.length - 1];
        }
      }

      if (!regularPrice || isNaN(regularPrice) || Number(regularPrice) <= 0) {
        continue;
      }

      let changePercent = 0;
      const prevClose = meta.chartPreviousClose || meta.previousClose;
      if (prevClose && prevClose > 0) {
        changePercent = Number((((Number(regularPrice) - prevClose) / prevClose) * 100).toFixed(2));
      }

      let monthReturnPercent = changePercent;
      const closePrices = result.indicators?.quote?.[0]?.close || [];
      const validCloses = closePrices.filter((c: any) => typeof c === 'number' && !isNaN(c) && c > 0);
      if (validCloses.length > 1) {
        const firstMonthPrice = validCloses[0];
        monthReturnPercent = Number(
          (((Number(regularPrice) - firstMonthPrice) / firstMonthPrice) * 100).toFixed(2)
        );
      }

      return {
        price: Number(regularPrice),
        currency,
        name: meta.shortName || meta.longName || meta.symbol || ticker,
        changePercent: isNaN(changePercent) ? 0 : changePercent,
        monthReturnPercent: isNaN(monthReturnPercent) ? 0 : monthReturnPercent,
        source: 'yahoo',
      };
    } catch {
      // Try next range
    }
  }
  return null;
}

export async function getYahooQuote(ticker: string): Promise<RawProviderQuote | null> {
  const cleanTicker = ticker.trim().toUpperCase();
  const searchTicker = cleanTicker.endsWith('.US')
    ? cleanTicker.replace(/\.US$/i, '')
    : cleanTicker;

  // Build candidate symbols to guarantee universal support for any market (US, Germany XETRA, Korea, UK, Euronext, etc.)
  const candidates = [searchTicker];
  if (cleanTicker !== searchTicker && !candidates.includes(cleanTicker)) {
    candidates.push(cleanTicker);
  }

  // 1. First strategy: official yf.quote() on candidates
  for (const sym of candidates) {
    try {
      const quote: any = await yf.quote(sym);
      if (quote) {
        const currency = (quote.currency || 'EUR').toUpperCase();
        const regularPrice =
          quote.regularMarketPrice ??
          quote.postMarketPrice ??
          quote.preMarketPrice ??
          quote.regularMarketPreviousClose ??
          quote.previousClose;

        if (regularPrice && !isNaN(regularPrice) && Number(regularPrice) > 0) {
          let changePercent = quote.regularMarketChangePercent ?? 0;
          if (
            changePercent === 0 &&
            quote.regularMarketPreviousClose &&
            quote.regularMarketPreviousClose > 0
          ) {
            changePercent = Number(
              (
                ((Number(regularPrice) - quote.regularMarketPreviousClose) /
                  quote.regularMarketPreviousClose) *
                100
              ).toFixed(2)
            );
          } else {
            changePercent = Number(Number(changePercent).toFixed(2));
          }

          return {
            price: Number(regularPrice),
            currency,
            name: quote.shortName || quote.longName || quote.displayName || cleanTicker,
            changePercent,
            monthReturnPercent: changePercent,
            source: 'yahoo',
          };
        }
      }
    } catch (err) {
      // Continue
    }
  }

  // 2. Second strategy: quoteSummary price module (essential for European ETFs like SXR8.DE, VWCE.DE)
  for (const sym of candidates) {
    try {
      const summary: any = await yf.quoteSummary(sym, { modules: ['price'] });
      const priceModule = summary?.price;
      if (priceModule) {
        const regularPrice =
          priceModule.regularMarketPrice ??
          priceModule.regularMarketPreviousClose ??
          priceModule.preMarketPrice ??
          priceModule.postMarketPrice;

        if (regularPrice && !isNaN(regularPrice) && Number(regularPrice) > 0) {
          const currency = (priceModule.currency || 'EUR').toUpperCase();
          const changePercent = Number((priceModule.regularMarketChangePercent ?? 0) * 100);
          return {
            price: Number(regularPrice),
            currency,
            name: priceModule.shortName || priceModule.longName || cleanTicker,
            changePercent: Number(changePercent.toFixed(2)),
            monthReturnPercent: Number(changePercent.toFixed(2)),
            source: 'yahoo',
          };
        }
      }
    } catch (summaryErr) {
      // Continue
    }
  }

  // 3. Third strategy: Direct query1.finance.yahoo.com
  for (const sym of candidates) {
    const q1Result = await fetchYahooChartDirect(sym, 'https://query1.finance.yahoo.com');
    if (q1Result) {
      return { ...q1Result, name: q1Result.name || cleanTicker };
    }
  }

  // 4. Fourth strategy: Direct query2.finance.yahoo.com
  for (const sym of candidates) {
    const q2Result = await fetchYahooChartDirect(sym, 'https://query2.finance.yahoo.com');
    if (q2Result) {
      return { ...q2Result, name: q2Result.name || cleanTicker };
    }
  }

  return null;
}
