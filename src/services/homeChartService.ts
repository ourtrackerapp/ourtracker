import { HoldingDoc } from '../types';

export type PeriodOption = '1D' | '1S' | '1M' | '3M' | '6M' | '1A' | 'Tudo';

export interface InstrumentMetrics {
  capitalValue: number;
  returnPercent: number;
  euroChange: number;
}

export interface HomeChartPoint {
  timestamp: number;
  formattedDate: string;
  portfolio: InstrumentMetrics;
  sp500?: InstrumentMetrics;
  nasdaq?: InstrumentMetrics;
  russell?: InstrumentMetrics;
}

export interface HomeChartData {
  points: HomeChartPoint[];
  latest: HomeChartPoint;
}

const PERIOD_API_MAP: Record<PeriodOption, string> = {
  '1D': '1d',
  '1S': '1w',
  '1M': '1m',
  '3M': '3m',
  '6M': '6m',
  '1A': '1y',
  'Tudo': 'max',
};

function parseDateInput(dateInput: any): number {
  if (!dateInput) return Date.now();
  if (typeof dateInput === 'number') return dateInput;
  if (dateInput instanceof Date) return dateInput.getTime();
  if (typeof dateInput === 'string') {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      const [day, month, year] = dateInput.split('/');
      const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      if (!isNaN(parsed.getTime())) return parsed.getTime();
    }
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) return parsed.getTime();
  }
  if (dateInput && typeof dateInput === 'object') {
    if (typeof dateInput.seconds === 'number') return dateInput.seconds * 1000;
    if (typeof dateInput._seconds === 'number') return dateInput._seconds * 1000;
    if (typeof dateInput.toDate === 'function') {
      try {
        return dateInput.toDate().getTime();
      } catch {}
    }
  }
  return Date.now();
}

export function formatPointDate(timestamp: number, period: PeriodOption): string {
  const date = new Date(timestamp);
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  if (period === '1D' || period === '1S') {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}, ${day} ${month}. ${year}`;
  }

  return `${day} ${month}. ${year}`;
}

export function formatCurrencyEur(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '€0,00';
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercentString(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0,00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2).replace('.', ',')}%`;
}

export function formatEuroChange(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '€0';
  const isNeg = value < 0;
  const absVal = Math.abs(value);
  const formatted = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(absVal);
  return isNeg ? `-${formatted}` : `+${formatted}`;
}

async function fetchTickerChart(ticker: string, apiPeriod: string): Promise<any[]> {
  try {
    const res = await fetch(`/api/chart/${encodeURIComponent(ticker)}?range=${apiPeriod}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.points) && data.points.length > 0) {
        return data.points;
      }
    }
  } catch {}

  // Fallback direto em tempo real para o gráfico via Yahoo Finance Client
  try {
    const cleanSym = ticker.replace(/\.US$/i, '');
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSym)}?range=${encodeURIComponent(apiPeriod)}&interval=1d`;
    const yRes = await fetch(url);
    if (yRes.ok) {
      const yData = await yRes.json();
      const result = yData?.chart?.result?.[0];
      const timestamps: number[] = result?.timestamp || [];
      const closes: number[] = result?.indicators?.quote?.[0]?.close || [];
      const points: any[] = [];
      timestamps.forEach((t, i) => {
        const c = closes[i];
        if (typeof c === 'number' && !isNaN(c) && c > 0) {
          points.push({ timestamp: t * 1000, close: c, closeEur: c });
        }
      });
      if (points.length > 0) return points;
    }
  } catch {}

  return [];
}

const CHART_CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchHomeChartData(
  holdings: HoldingDoc[],
  deposits: any[],
  period: PeriodOption,
  includeSp500: boolean,
  includeNasdaq: boolean,
  includeRussell: boolean = false
): Promise<HomeChartData | null> {
  const apiPeriod = PERIOD_API_MAP[period] || '1m';

  const holdingTickers = Array.from(new Set(holdings.map((h) => h.ticker).filter(Boolean)));
  const benchmarkTickers: string[] = [];
  if (includeSp500) benchmarkTickers.push('SXR8.DE');
  if (includeNasdaq) benchmarkTickers.push('SXRV.DE');
  if (includeRussell) benchmarkTickers.push('IWM');

  const allTickersToFetch = Array.from(new Set([...holdingTickers, ...benchmarkTickers]));
  if (allTickersToFetch.length === 0) {
    return null;
  }

  let chartResults: any[] = [];
  try {
    chartResults = await Promise.all(
      allTickersToFetch.map(async (t) => {
        const points = await fetchTickerChart(t, apiPeriod);
        return { ticker: t, points };
      })
    );
  } catch {
    return null;
  }

  const hasAnyPoints = chartResults.some((r) => r.points && r.points.length > 0);
  if (!hasAnyPoints) {
    return null;
  }

  const chartMap = new Map<string, any[]>();
  chartResults.forEach(({ ticker, points }) => {
    chartMap.set(ticker.toUpperCase(), points);
    chartMap.set(ticker.replace(/\.US$/i, '').toUpperCase(), points);
  });

  const timestampSet = new Set<number>();
  chartResults.forEach(({ points }) => {
    points.forEach((pt: any) => {
      if (pt.timestamp) timestampSet.add(pt.timestamp);
    });
  });

  // Helper to get price on or immediately after target timestamp (handling weekends/holidays)
  const getPriceOnOrAfter = (ticker: string, targetTimestamp: number): { priceEur: number; timestamp: number } => {
    const key = ticker.toUpperCase();
    const points = chartMap.get(key) || [];
    if (points.length === 0) return { priceEur: 0, timestamp: targetTimestamp };

    for (let i = 0; i < points.length; i++) {
      if (points[i].timestamp >= targetTimestamp) {
        const pEur = points[i].priceEur ?? points[i].price ?? 0;
        return { priceEur: pEur, timestamp: points[i].timestamp };
      }
    }

    const last = points[points.length - 1];
    return { priceEur: last?.priceEur ?? last?.price ?? 0, timestamp: last?.timestamp ?? targetTimestamp };
  };

  const latestPriceMap = new Map<string, number>();
  const getTickerPriceAt = (ticker: string, t: number): number => {
    const key = ticker.toUpperCase();
    const points = chartMap.get(key) || [];
    if (points.length === 0) return 0;

    let price = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i].timestamp <= t) {
        price = points[i].priceEur ?? points[i].price ?? price;
      } else {
        break;
      }
    }

    if (price <= 0) {
      price = points[0].priceEur ?? points[0].price ?? 0;
    }

    if (price > 0) {
      latestPriceMap.set(key, price);
    } else {
      price = latestPriceMap.get(key) || 0;
    }

    return price;
  };

  // Prepare deposit events first
  const depositEvents: { timestamp: number; amount: number }[] = [];
  (deposits || []).forEach((d: any) => {
    if (d.date && d.amount) {
      depositEvents.push({ timestamp: parseDateInput(d.date), amount: Number(d.amount) || 0 });
    }
  });
  depositEvents.sort((a, b) => a.timestamp - b.timestamp);

  let sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);
  if (sortedTimestamps.length === 0) return null;

  if (period === '1D') {
    const now = new Date();
    const midnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
    const nextMidnightUtc = midnightUtc + (24 * 60 * 60 * 1000);
    const nowTime = now.getTime();
    
    // Filter points between midnight and now
    let todayTimestamps = sortedTimestamps.filter((t) => t >= midnightUtc && t <= nowTime);
    
    // Always ensure midnight and current time are included as bounds for the line
    if (todayTimestamps.length === 0 || todayTimestamps[0] > midnightUtc) {
      todayTimestamps = [midnightUtc, ...todayTimestamps];
    }
    if (todayTimestamps[todayTimestamps.length - 1] < nowTime) {
      todayTimestamps = [...todayTimestamps, nowTime];
    }
    
    sortedTimestamps = todayTimestamps;
  }

  if (period === 'Tudo' && depositEvents.length > 0) {
    const firstDepositTime = depositEvents[0].timestamp;
    const earlierTimestamps = sortedTimestamps.filter((t) => t < firstDepositTime);
    const validTimestamps = sortedTimestamps.filter((t) => t >= firstDepositTime);

    if (validTimestamps.length > 0) {
      if (earlierTimestamps.length > 0) {
        const lastAnchor = earlierTimestamps[earlierTimestamps.length - 1];
        sortedTimestamps = [lastAnchor, ...validTimestamps];
      } else {
        sortedTimestamps = validTimestamps;
      }
    }
  }

  // --- BENCHMARK DETAILED AUDIT / BREAKDOWN LOGGING FOR USER TEST ---
  const auditBenchmarks = ['SXR8.DE', 'SXRV.DE', 'IWM'];
  auditBenchmarks.forEach((bm) => {
    if (benchmarkTickers.includes(bm)) {
      console.log(`\n================ AUDIT BENCHMARK: ${bm} ================\n`);
      depositEvents.forEach((d) => {
        const res = getPriceOnOrAfter(bm, d.timestamp);
        const virtualShares = res.priceEur > 0 ? d.amount / res.priceEur : 0;
        const latestPrice = getTickerPriceAt(bm, sortedTimestamps[sortedTimestamps.length - 1] || Date.now());
        const currentVal = virtualShares * latestPrice;
        console.log(`Depósito: €${d.amount} em ${new Date(d.timestamp).toISOString().slice(0, 10)}`);
        console.log(`→ Preço histórico usado (on/after): €${res.priceEur.toFixed(4)} (em ${new Date(res.timestamp).toISOString().slice(0, 10)})`);
        console.log(`→ Unidades virtuais compradas: ${virtualShares.toFixed(4)} shares`);
        console.log(`→ Valor atual dessas unidades: €${currentVal.toFixed(2)}\n`);
      });
    }
  });

  // Calculate Portfolio Points
  const portfolioPoints: {
    timestamp: number;
    etfValue: number;
    cash: number;
    capital: number;
    cashInflow: number;
  }[] = [];

  sortedTimestamps.forEach((t, idx) => {
    let etfValue = 0;
    holdings.forEach((h) => {
      let sharesAtT = 0;
      if (h.purchases && h.purchases.length > 0) {
        h.purchases.forEach((p) => {
          if (p.date <= t) {
            sharesAtT += p.shares;
          }
        });
      } else {
        if (!h.createdAt || h.createdAt <= t) {
          sharesAtT = h.shares;
        }
      }
      const price = getTickerPriceAt(h.ticker, t);
      etfValue += sharesAtT * price;
    });

    let totalDepositsUpToT = 0;
    depositEvents.forEach((d) => {
      if (d.timestamp <= t) totalDepositsUpToT += d.amount;
    });

    let totalPurchasesUpToT = 0;
    holdings.forEach((h) => {
      if (h.purchases && h.purchases.length > 0) {
        h.purchases.forEach((p) => {
          if (p.date <= t) {
            const purchasePrice = p.priceEur || getTickerPriceAt(h.ticker, p.date);
            totalPurchasesUpToT += p.totalCostEur || (p.shares * purchasePrice);
          }
        });
      }
    });

    const cash = Math.max(0, totalDepositsUpToT - totalPurchasesUpToT);
    const capital = etfValue + cash;

    let cashInflow = 0;
    if (idx > 0) {
      const prevT = sortedTimestamps[idx - 1];
      depositEvents.forEach((d) => {
        if (d.timestamp > prevT && d.timestamp <= t) {
          cashInflow += d.amount;
        }
      });
    }

    portfolioPoints.push({
      timestamp: t,
      etfValue,
      cash,
      capital,
      cashInflow,
    });
  });

  // Compute TWR for Portfolio strictly neutralizing capital inflows
  let portIndex = 100;
  const resultPoints: HomeChartPoint[] = [];

  // Helper to calculate benchmark simulated capital using exact deposit historical prices on/after deposit date
  const getBenchmarkSimulatedCapital = (ticker: string, t: number): number => {
    let totalVal = 0;
    depositEvents.forEach((d) => {
      if (d.timestamp <= t) {
        const res = getPriceOnOrAfter(ticker, d.timestamp);
        if (res.priceEur > 0) {
          const shares = d.amount / res.priceEur;
          const currentPrice = getTickerPriceAt(ticker, t);
          totalVal += shares * currentPrice;
        }
      }
    });
    return totalVal;
  };

  const firstDepositTime = depositEvents.length > 0 ? depositEvents[0].timestamp : (sortedTimestamps[0] || Date.now());
  let sp500InitialPrice = includeSp500 ? (getPriceOnOrAfter('SXR8.DE', firstDepositTime).priceEur || getTickerPriceAt('SXR8.DE', firstDepositTime)) : 0;
  let nasdaqInitialPrice = includeNasdaq ? (getPriceOnOrAfter('SXRV.DE', firstDepositTime).priceEur || getTickerPriceAt('SXRV.DE', firstDepositTime)) : 0;
  let russellInitialPrice = includeRussell ? (getPriceOnOrAfter('IWM', firstDepositTime).priceEur || getTickerPriceAt('IWM', firstDepositTime)) : 0;

  portfolioPoints.forEach((pt, idx) => {
    const t = pt.timestamp;
    const formattedDate = formatPointDate(t, period);

    // --- PORTFOLIO TWR ---
    if (idx === 0) {
      portIndex = 100;
    } else {
      const prevPort = portfolioPoints[idx - 1];
      const prevCap = prevPort.capital;
      const cashInflow = pt.cashInflow;

      if (prevCap > 0) {
        const subReturn = (pt.capital - cashInflow - prevCap) / prevCap;
        portIndex = portIndex * (1 + subReturn);
      } else if (pt.capital > 0) {
        portIndex = 100;
      }
    }

    const portReturnPercent = portIndex - 100;
    
    // Calculate Euro Change as the nominal performance gain/loss within the period
    // Formula: Initial Value * (ReturnPercent / 100)
    // This ensures sign (+/-) always matches the return percentage
    const initialCap = portfolioPoints[0]?.capital || 0;
    const portEuroChange = initialCap * (portReturnPercent / 100);

    const pointItem: HomeChartPoint = {
      timestamp: t,
      formattedDate,
      portfolio: {
        capitalValue: pt.capital,
        returnPercent: isNaN(portReturnPercent) ? 0 : portReturnPercent,
        euroChange: portEuroChange,
      },
    };

    // --- S&P 500 BENCHMARK ---
    if (includeSp500) {
      const priceSp = getTickerPriceAt('SXR8.DE', t);
      if (idx === 0 || sp500InitialPrice === 0) {
        if (priceSp > 0) sp500InitialPrice = priceSp;
      }
      const spReturnPercent = sp500InitialPrice > 0 ? ((priceSp / sp500InitialPrice) - 1) * 100 : 0;
      const spCapital = getBenchmarkSimulatedCapital('SXR8.DE', t);
      
      // Sync benchmark euroChange with its performance
      const spInitialSimCap = getBenchmarkSimulatedCapital('SXR8.DE', sortedTimestamps[0]);
      const spRef = spInitialSimCap > 0 ? spInitialSimCap : sp500InitialPrice;
      const spEuroChange = spRef * (spReturnPercent / 100);

      pointItem.sp500 = {
        capitalValue: spCapital > 0 ? spCapital : priceSp,
        returnPercent: isNaN(spReturnPercent) ? 0 : spReturnPercent,
        euroChange: spEuroChange,
      };
    }

    // --- NASDAQ BENCHMARK ---
    if (includeNasdaq) {
      const priceNas = getTickerPriceAt('SXRV.DE', t);
      if (idx === 0 || nasdaqInitialPrice === 0) {
        if (priceNas > 0) nasdaqInitialPrice = priceNas;
      }
      const nasReturnPercent = nasdaqInitialPrice > 0 ? ((priceNas / nasdaqInitialPrice) - 1) * 100 : 0;
      const nasCapital = getBenchmarkSimulatedCapital('SXRV.DE', t);
      
      const nasInitialSimCap = getBenchmarkSimulatedCapital('SXRV.DE', sortedTimestamps[0]);
      const nasRef = nasInitialSimCap > 0 ? nasInitialSimCap : nasdaqInitialPrice;
      const nasEuroChange = nasRef * (nasReturnPercent / 100);

      pointItem.nasdaq = {
        capitalValue: nasCapital > 0 ? nasCapital : priceNas,
        returnPercent: isNaN(nasReturnPercent) ? 0 : nasReturnPercent,
        euroChange: nasEuroChange,
      };
    }

    // --- RUSSELL BENCHMARK ---
    if (includeRussell) {
      const priceRus = getTickerPriceAt('IWM', t);
      if (idx === 0 || russellInitialPrice === 0) {
        if (priceRus > 0) russellInitialPrice = priceRus;
      }
      const rusReturnPercent = russellInitialPrice > 0 ? ((priceRus / russellInitialPrice) - 1) * 100 : 0;
      const rusCapital = getBenchmarkSimulatedCapital('IWM', t);
      
      const rusInitialSimCap = getBenchmarkSimulatedCapital('IWM', sortedTimestamps[0]);
      const rusRef = rusInitialSimCap > 0 ? rusInitialSimCap : russellInitialPrice;
      const rusEuroChange = rusRef * (rusReturnPercent / 100);

      pointItem.russell = {
        capitalValue: rusCapital > 0 ? rusCapital : priceRus,
        returnPercent: isNaN(rusReturnPercent) ? 0 : rusReturnPercent,
        euroChange: rusEuroChange,
      };
    }

    resultPoints.push(pointItem);
  });

  const latest = resultPoints[resultPoints.length - 1];
  const finalResult = { points: resultPoints, latest };

  return finalResult;
}
