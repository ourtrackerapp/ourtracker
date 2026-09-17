import { HoldingDoc } from '../types';

export type PeriodOption = '1D' | '1S' | '1M' | '3M' | 'YTD' | 'Tudo';

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
}

export interface HomeChartData {
  points: HomeChartPoint[];
  latest: HomeChartPoint;
}

const PERIOD_API_MAP: Record<PeriodOption, string> = {
  '1D': '1d',
  '1S': '5d',
  '1M': '1m',
  '3M': '3m',
  'YTD': 'ytd',
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
  if (value === undefined || value === null || isNaN(value)) return '€0,00';
  const isNeg = value < 0;
  const absVal = Math.abs(value);
  const formatted = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
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
          points.push({ timestamp: t * 1000, price: c, priceEur: c, close: c, closeEur: c });
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
  includeSp500: boolean
): Promise<HomeChartData | null> {
  const apiPeriod = PERIOD_API_MAP[period] || '1m';

  const holdingTickers = Array.from(new Set(holdings.map((h) => h.ticker).filter(Boolean)));
  const benchmarkTickers: string[] = [];
  if (includeSp500) benchmarkTickers.push('SXR8.DE');

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
        const pEur = points[i].priceEur ?? points[i].price ?? points[i].closeEur ?? points[i].close ?? 0;
        return { priceEur: pEur, timestamp: points[i].timestamp };
      }
    }

    const last = points[points.length - 1];
    return { priceEur: last?.priceEur ?? last?.price ?? last?.closeEur ?? last?.close ?? 0, timestamp: last?.timestamp ?? targetTimestamp };
  };

  const latestPriceMap = new Map<string, number>();
  const getTickerPriceAt = (ticker: string, t: number): number => {
    const key = ticker.toUpperCase();
    const points = chartMap.get(key) || [];
    if (points.length === 0) return 0;

    let price = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i].timestamp <= t) {
        price = points[i].priceEur ?? points[i].price ?? points[i].closeEur ?? points[i].close ?? price;
      } else {
        break;
      }
    }

    if (price <= 0) {
      price = points[0].priceEur ?? points[0].price ?? points[0].closeEur ?? points[0].close ?? 0;
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

  // If no explicit deposits were created in meta, fallback to purchase records so deposits are never empty
  if (depositEvents.length === 0) {
    holdings.forEach((h) => {
      if (h.purchases && h.purchases.length > 0) {
        h.purchases.forEach((p) => {
          const cost = p.totalCostEur || (p.priceEur ? p.shares * p.priceEur : 0);
          if (cost > 0) {
            depositEvents.push({ timestamp: p.date, amount: cost });
          }
        });
      } else if (h.createdAt && h.shares > 0) {
        const estPrice = getTickerPriceAt(h.ticker, h.createdAt) || 100;
        depositEvents.push({ timestamp: h.createdAt, amount: h.shares * estPrice });
      }
    });
  }
  depositEvents.sort((a, b) => a.timestamp - b.timestamp);

  let sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);
  if (sortedTimestamps.length === 0) return null;

  const firstDepositTime = depositEvents.length > 0 ? depositEvents[0].timestamp : sortedTimestamps[0];

  if (period === '1D') {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const nowTime = now.getTime();
    
    // Filter points between local midnight and now
    let todayTimestamps = sortedTimestamps.filter((t) => t >= startOfDay && t <= nowTime);
    
    // Always ensure start of day (midnight 00:00) and current time are included
    if (todayTimestamps.length === 0 || todayTimestamps[0] > startOfDay) {
      todayTimestamps = [startOfDay, ...todayTimestamps];
    }
    if (todayTimestamps[todayTimestamps.length - 1] < nowTime) {
      todayTimestamps = [...todayTimestamps, nowTime];
    }
    
    sortedTimestamps = todayTimestamps;
  } else if (period === 'YTD') {
    // YTD deve começar rigorosamente no início do ano civil (1 de Janeiro do ano corrente)
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
    
    let ytdTimestamps = sortedTimestamps.filter((t) => t >= startOfYear);
    if (ytdTimestamps.length === 0 || ytdTimestamps[0] > startOfYear) {
      ytdTimestamps = [startOfYear, ...ytdTimestamps];
    }
    sortedTimestamps = ytdTimestamps;
  } else {
    if (firstDepositTime) {
      // Se o período selecionado começar antes do primeiro depósito da carteira,
      // o gráfico começa na data do 1º depósito
      if (sortedTimestamps[0] < firstDepositTime) {
        const validTimestamps = sortedTimestamps.filter((t) => t >= firstDepositTime);
        if (validTimestamps.length > 0) {
          if (validTimestamps[0] > firstDepositTime) {
            sortedTimestamps = [firstDepositTime, ...validTimestamps];
          } else {
            sortedTimestamps = validTimestamps;
          }
        }
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

  // Compute TWR for Portfolio and Benchmarks strictly neutralizing capital inflows
  let portIndex = 100;
  let spIndex = 100;

  let spCapital = 0;

  let initialWindowDeposits = 0;
  const initialWindowCapital = portfolioPoints[0]?.capital || 0;

  const resultPoints: HomeChartPoint[] = [];

  portfolioPoints.forEach((pt, idx) => {
    const t = pt.timestamp;
    const formattedDate = formatPointDate(t, period);

    // Sum deposits up to this point
    let totalDepositsUpToT = 0;
    depositEvents.forEach((d) => {
      if (d.timestamp <= t) totalDepositsUpToT += d.amount;
    });

    // --- PORTFOLIO & BENCHMARK TWR UPDATES ---
    if (idx === 0) {
      initialWindowDeposits = totalDepositsUpToT;
      portIndex = 100;
      spIndex = 100;
      
      spCapital = pt.capital;
    } else {
      const prevPort = portfolioPoints[idx - 1];
      const prevCap = prevPort.capital;
      const cashInflow = pt.cashInflow;
      const prevT = prevPort.timestamp;

      // Portfolio TWR
      if (prevCap > 0) {
        const subReturn = (pt.capital - cashInflow - prevCap) / prevCap;
        portIndex = portIndex * (1 + subReturn);
      } else if (pt.capital > 0) {
        portIndex = 100;
      }

      // Benchmarks TWR & Capital
      if (includeSp500) {
        const prevSp = getTickerPriceAt('SXR8.DE', prevT);
        const currSp = getTickerPriceAt('SXR8.DE', t);
        const spReturn = prevSp > 0 ? (currSp - prevSp) / prevSp : 0;
        spIndex = spIndex * (1 + spReturn);
        spCapital = (spCapital * (1 + spReturn)) + cashInflow;
      }
    }

    const windowNetDeposits = totalDepositsUpToT - initialWindowDeposits;

    let portReturnPercent = 0;
    let portEuroChange = 0;

    if (period === 'Tudo') {
      portReturnPercent = isNaN(portIndex - 100) ? 0 : (portIndex - 100);
      portEuroChange = pt.capital - totalDepositsUpToT;
    } else {
      portReturnPercent = isNaN(portIndex - 100) ? 0 : (portIndex - 100);
      portEuroChange = pt.capital - initialWindowCapital - windowNetDeposits;
    }

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
      if (t < firstDepositTime || totalDepositsUpToT === 0) {
        pointItem.sp500 = { capitalValue: 0, returnPercent: 0, euroChange: 0 };
      } else {
        let spReturnPercent = 0;
        let spEuroChange = 0;
        
        if (period === 'Tudo') {
          // For 'Tudo', we use simple calculation since initial capital is 0
          spEuroChange = spCapital - totalDepositsUpToT;
          spReturnPercent = totalDepositsUpToT > 0 ? ((spCapital - totalDepositsUpToT) / totalDepositsUpToT) * 100 : 0;
        } else {
          spReturnPercent = isNaN(spIndex - 100) ? 0 : (spIndex - 100);
          spEuroChange = spCapital - initialWindowCapital - windowNetDeposits;
        }

        pointItem.sp500 = {
          capitalValue: spCapital,
          returnPercent: isNaN(spReturnPercent) ? 0 : spReturnPercent,
          euroChange: spEuroChange,
        };
      }
    }

    resultPoints.push(pointItem);
  });

  const latest = resultPoints[resultPoints.length - 1];
  const finalResult = { points: resultPoints, latest };

  return finalResult;
}

export async function fetchAllTimeTwrBaseline(
  holdings: HoldingDoc[],
  deposits: any[]
): Promise<{ baseIndex: number; baseCapital: number; lastTimestamp: number } | null> {
  try {
    const data = await fetchHomeChartData(holdings, deposits, 'Tudo', false);
    if (!data || !data.latest) return null;
    const lastPt = data.latest;
    const baseIndex = 1 + (lastPt.portfolio.returnPercent || 0) / 100;
    const baseCapital = lastPt.portfolio.capitalValue || 0;
    const lastTimestamp = lastPt.timestamp;
    return { baseIndex, baseCapital, lastTimestamp };
  } catch (err) {
    console.warn('Error fetching all-time TWR baseline:', err);
    return null;
  }
}

