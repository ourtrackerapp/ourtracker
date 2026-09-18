import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  X,
  DollarSign,
  Scale,
  Plus,
  Search,
  Target,
  TrendingUp,
  BarChart2,
  PieChart,
  Building2,
  Users,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { PortfolioPosition, HoldingDoc, PurchaseRecord } from '../types';
import { getShortDescription } from '../utils/tickerHelper';
import { METRIC_EXPLANATIONS, generateCustomMetricComparison } from '../utils/metricExplanations';

interface ChartPoint {
  timestamp: number;
  date: string;
  price: number;
  priceEur: number;
  isMarketOpen: boolean;
  high?: number;
  low?: number;
  highEur?: number;
  lowEur?: number;
  open?: number;
  volume?: number;
}

interface StockMetrics {
  dayHigh?: number | null;
  dayLow?: number | null;
  dayHighEur?: number | null;
  dayLowEur?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  fiftyTwoWeekHighEur?: number | null;
  fiftyTwoWeekLowEur?: number | null;
  fiftyTwoWeekRangePercent?: number | null;

  // Valuation
  pe?: number | null;
  forwardPE?: number | null;
  pegRatio?: number | null;
  pb?: number | null;
  ps?: number | null;
  evEbitda?: number | null;
  evRevenue?: number | null;
  eps?: number | null;
  epsEur?: number | null;
  forwardEps?: number | null;
  forwardEpsEur?: number | null;
  beta?: number | null;

  // Wall Street Targets
  targetPrice?: number | null;
  targetPriceEur?: number | null;
  targetHigh?: number | null;
  targetHighEur?: number | null;
  targetLow?: number | null;
  targetLowEur?: number | null;
  targetMedian?: number | null;
  targetMedianEur?: number | null;
  targetUpsidePercent?: number | null;

  // Recommendations
  recommendation?: string | null;
  recommendationMean?: number | null;
  numberOfAnalystOpinions?: number | null;
  recommendationTrend?: {
    strongBuy: number;
    buy: number;
    hold: number;
    underperform: number;
    sell: number;
  } | null;

  // Profitability & Margins
  profitMargins?: number | null;
  operatingMargins?: number | null;
  grossMargins?: number | null;
  returnOnEquity?: number | null;
  returnOnAssets?: number | null;

  // Balance Sheet & Cash
  totalCash?: number | null;
  totalCashEur?: number | null;
  totalDebt?: number | null;
  totalDebtEur?: number | null;
  currentRatio?: number | null;
  debtToEquity?: number | null;
  freeCashflow?: number | null;
  freeCashflowEur?: number | null;
  marketCap?: number | null;
  marketCapEur?: number | null;

  // Ownership & Short Sentiment
  heldPercentInstitutions?: number | null;
  heldPercentInsiders?: number | null;
  shortPercentOfFloat?: number | null;

  // Dividends & Calendar
  dividendYield?: number | null;
  dividendRate?: number | null;
  dividendRateEur?: number | null;
  payoutRatio?: number | null;
  fiveYearAvgDividendYield?: number | null;
  exDividendDate?: string | null;
  earningsDate?: string | null;
}

interface ChartWindowMetrics {
  range: string;
  targetStartTimestamp: number;
  actualStartTimestamp: number;
  startPointIndex: number;
  startPriceNative: number;
  startPriceEur: number;
  endTimestamp: number;
  endPriceNative: number;
  endPriceEur: number;
  returnPercentNative: number;
  returnPercentEur: number;
}

interface ChartResponse {
  symbol: string;
  name: string;
  currency: string;
  fxRateToEur: number;
  currentPrice: number;
  currentPriceEur: number;
  previousClose: number;
  previousCloseEur: number;
  rangeChange: number;
  rangeChangePercent: number;
  range: string;
  points: ChartPoint[];
  windowMetrics?: ChartWindowMetrics;
  metrics?: StockMetrics;
}

export type ChartTimeRange = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'max';

interface StockChartModalProps {
  position: PortfolioPosition | null;
  holding?: HoldingDoc | null;
  isOpen: boolean;
  onClose: () => void;
}

const TIME_RANGES: Array<{ key: ChartTimeRange; label: string }> = [
  { key: '1d', label: '1D' },
  { key: '1w', label: '1S' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1A' },
  { key: 'max', label: 'Tudo' },
];

export const StockChartModal: React.FC<StockChartModalProps> = ({
  position,
  holding,
  isOpen,
  onClose,
}) => {
  const [selectedRange, setSelectedRange] = useState<ChartTimeRange>('1m');
  const [chartData, setChartData] = useState<ChartResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  // Benchmark state
  const [benchmarkTicker, setBenchmarkTicker] = useState<string>('');
  const [benchmarkData, setBenchmarkData] = useState<ChartResponse | null>(null);
  const [isBenchmarkLoading, setIsBenchmarkLoading] = useState<boolean>(false);
  const [benchmarkError, setBenchmarkError] = useState<boolean>(false);
  const [showBenchmarkInput, setShowBenchmarkInput] = useState<boolean>(false);
  const [benchmarkSearchQuery, setBenchmarkSearchQuery] = useState<string>('');
  const [benchmarkSearchResults, setBenchmarkSearchResults] = useState<any[]>([]);
  const [isSearchingBenchmark, setIsSearchingBenchmark] = useState<boolean>(false);

  // Two-Finger Range Selection: [startIdx, endIdx]
  const [twoFingerRange, setTwoFingerRange] = useState<[number, number] | null>(null);

  // Zoom Window Index Range [startIdx, endIdx]
  const [zoomWindow, setZoomWindow] = useState<[number, number] | null>(null);
  const lastTapRef = useRef<number>(0);
  const [touchMode, setTouchMode] = useState<'idle' | 'scrub' | 'two-finger' | 'pinch'>('idle');
  const touchStartDistRef = useRef<number | null>(null);
  const initialZoomWindowRef = useRef<[number, number] | null>(null);
  const touchStartCenterRatioRef = useRef<number>(0.5);

  const [activePurchaseTooltip, setActivePurchaseTooltip] = useState<{
    id: string;
    x: number;
    y: number;
    timestamp: number;
    buyPrice: number;
    buyPriceEur: number;
    dateFormatted: string;
    shares: number;
    high: number;
    low: number;
    highEur: number;
    lowEur: number;
  } | null>(null);

  // Selected metric for explanation modal/bottom sheet
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  // Determine if stock is US-based (USD currency)
  const isUsd = useMemo(() => {
    const curr = (chartData?.currency || position?.nativeCurrency || '').toUpperCase();
    if (curr === 'USD') return true;
    if (curr === 'EUR') return false;
    const ticker = (position?.ticker || '').toUpperCase();
    return !ticker.includes('.') || ticker.endsWith('.US');
  }, [chartData?.currency, position?.nativeCurrency, position?.ticker]);

  const currencySymbol = isUsd ? '$' : '€';

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 360, height: 260 });

  // Auto-adjust default range based on earliest purchase date when modal opens
  useEffect(() => {
    if (isOpen && holding) {
      let earliestTs = Date.now();
      let hasPurchases = false;

      const checkAndSetEarliest = (val: any) => {
        if (!val) return;
        let t = NaN;
        if (typeof val === 'string') {
          t = Date.parse(val);
          if (isNaN(t)) {
            // Try parse PT format "DD/MM/YYYY"
            const parts = val.split('/');
            if (parts.length === 3) {
              const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
              t = d.getTime();
            }
          }
        } else if (val instanceof Date) {
          t = val.getTime();
        } else if (typeof val === 'number') {
          t = val;
        }
        if (!isNaN(t) && t < earliestTs) {
          earliestTs = t;
          hasPurchases = true;
        }
      };

      if (Array.isArray(holding.purchases) && holding.purchases.length > 0) {
        holding.purchases.forEach(p => checkAndSetEarliest(p.date));
      } else if (holding.createdAt) {
        checkAndSetEarliest(holding.createdAt);
      }

      if (hasPurchases) {
        const daysAgo = (Date.now() - earliestTs) / (1000 * 60 * 60 * 24);
        if (daysAgo <= 1) {
          setSelectedRange('1d');
        } else if (daysAgo <= 7) {
          setSelectedRange('1w');
        } else if (daysAgo <= 30) {
          setSelectedRange('1m');
        } else if (daysAgo <= 90) {
          setSelectedRange('3m');
        } else if (daysAgo <= 180) {
          setSelectedRange('6m');
        } else if (daysAgo <= 365) {
          setSelectedRange('1y');
        } else {
          setSelectedRange('max');
        }
      } else {
        setSelectedRange('1m');
      }
    }
  }, [isOpen, holding]);

  // Fetch chart data when position or range changes
  useEffect(() => {
    if (!isOpen || !position) return;

    let isMounted = true;
    setIsLoading(true);
    setHasError(false);
    setChartData(null);
    setScrubIndex(null);
    setTwoFingerRange(null);
    setZoomWindow(null);
    setActivePurchaseTooltip(null);

    const fetchChart = async () => {
      try {
        const cleanTicker = position.ticker.trim();
        const res = await fetch(`/api/chart/${encodeURIComponent(cleanTicker)}?range=${selectedRange}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: ChartResponse = await res.json();
        if (isMounted) {
          if (!data || !data.points || data.points.length === 0) {
            setHasError(true);
          } else {
            setChartData(data);
          }
        }
      } catch (err) {
        console.error('Error loading chart:', err);
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchChart();

    // Auto refresh stock chart every 1 minute (60,000 ms)
    const interval = setInterval(fetchChart, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, position?.ticker, selectedRange]);

  // Fetch benchmark data
  useEffect(() => {
    if (!isOpen || !benchmarkTicker) {
      setBenchmarkData(null);
      return;
    }

    let isMounted = true;
    setIsBenchmarkLoading(true);
    setBenchmarkError(false);

    const fetchBenchmark = async () => {
      try {
        const res = await fetch(`/api/chart/${encodeURIComponent(benchmarkTicker)}?range=${selectedRange}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ChartResponse = await res.json();
        if (isMounted) {
          if (!data || !data.points || data.points.length === 0) {
            setBenchmarkError(true);
          } else {
            setBenchmarkData(data);
          }
        }
      } catch (err) {
        console.error('Error loading benchmark:', err);
        if (isMounted) setBenchmarkError(true);
      } finally {
        if (isMounted) setIsBenchmarkLoading(false);
      }
    };

    fetchBenchmark();

    return () => {
      isMounted = false;
    };
  }, [isOpen, benchmarkTicker, selectedRange]);

  // Benchmark Search effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (benchmarkSearchQuery.trim().length < 2) {
        setBenchmarkSearchResults([]);
        return;
      }

      setIsSearchingBenchmark(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(benchmarkSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setBenchmarkSearchResults(data.quotes || []);
        }
      } catch (err) {
        console.error('Benchmark search error:', err);
      } finally {
        setIsSearchingBenchmark(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [benchmarkSearchQuery]);

  // Observe SVG container width
  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          setSvgDimensions({ width, height });
        }
      }
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, [isOpen, chartData]);

  const rawPoints = useMemo(() => {
    const raw = chartData?.points || [];
    let pts = selectedRange === '1d' ? raw.filter((pt) => pt.isMarketOpen) : [...raw];
    if (pts.length === 0) pts = [...raw];
    if (pts.length === 0) return [];

    // Garantir deterministamente que o último ponto do gráfico termina no valor atual da ação
    const targetPriceEur = position?.currentPrice ?? chartData?.currentPriceEur;
    const targetPriceNative = isUsd 
      ? (position?.nativePrice ?? chartData?.currentPrice ?? targetPriceEur)
      : (targetPriceEur ?? position?.nativePrice ?? chartData?.currentPrice);

    if (targetPriceEur != null && targetPriceEur > 0) {
      const last = pts[pts.length - 1];
      const nowTs = Date.now();
      const timeDiff = nowTs - last.timestamp;
      
      // Se a última vela for de hoje (menos de 4 horas de diferença), atualiza o preço para a cotação atual
      if (timeDiff < 1000 * 60 * 60 * 4) {
        pts[pts.length - 1] = {
          ...last,
          price: targetPriceNative ?? last.price,
          priceEur: targetPriceEur,
        };
      } else {
        // Se pertencer a um fecho anterior (ex: range 1M, 1y com velas diárias), anexa ponto em tempo real
        pts.push({
          timestamp: nowTs,
          date: new Date(nowTs).toISOString(),
          price: targetPriceNative ?? targetPriceEur,
          priceEur: targetPriceEur,
          isMarketOpen: true,
        });
      }
    }

    return pts;
  }, [chartData?.points, chartData?.currentPrice, chartData?.currentPriceEur, selectedRange, position?.currentPrice, position?.nativePrice, isUsd]);

  // Filter points based on zoom window
  const points = useMemo(() => {
    if (rawPoints.length === 0) return [];
    if (!zoomWindow) return rawPoints;
    const [start, end] = zoomWindow;
    return rawPoints.slice(Math.max(0, start), Math.min(rawPoints.length, end + 1));
  }, [rawPoints, zoomWindow]);

  const benchmarkPoints = useMemo(() => {
    const raw = benchmarkData?.points || [];
    if (raw.length === 0) return [];
    
    // For 1d, filter market hours
    let filtered = selectedRange === '1d' ? raw.filter(pt => pt.isMarketOpen) : [...raw];
    if (filtered.length === 0) filtered = [...raw];

    const targetPriceEur = benchmarkData?.currentPriceEur;
    const targetPriceNative = benchmarkData?.currentPrice ?? targetPriceEur;

    if (targetPriceEur != null && targetPriceEur > 0) {
      const last = filtered[filtered.length - 1];
      const nowTs = Date.now();
      const timeDiff = nowTs - last.timestamp;
      if (timeDiff < 1000 * 60 * 60 * 4) {
        filtered[filtered.length - 1] = {
          ...last,
          price: targetPriceNative ?? last.price,
          priceEur: targetPriceEur,
        };
      } else {
        filtered.push({
          timestamp: nowTs,
          date: new Date(nowTs).toISOString(),
          price: targetPriceNative ?? targetPriceEur,
          priceEur: targetPriceEur,
          isMarketOpen: true,
        });
      }
    }

    if (!zoomWindow) return filtered;
    
    // Attempt to align zoom window by timestamp ratio if index doesn't match perfectly
    // (Benchmarks might have slightly different number of points)
    const [startIdx, endIdx] = zoomWindow;
    const startRatio = startIdx / Math.max(1, rawPoints.length - 1);
    const endRatio = endIdx / Math.max(1, rawPoints.length - 1);
    
    const bStart = Math.floor(startRatio * (filtered.length - 1));
    const bEnd = Math.ceil(endRatio * (filtered.length - 1));
    
    return filtered.slice(bStart, bEnd + 1);
  }, [benchmarkData?.points, benchmarkData?.currentPrice, benchmarkData?.currentPriceEur, selectedRange, zoomWindow, rawPoints.length]);

  // All purchase records for this holding
  const purchaseRecords: PurchaseRecord[] = useMemo(() => {
    if (!holding) return [];
    let list: PurchaseRecord[] = [];
    if (Array.isArray(holding.purchases) && holding.purchases.length > 0) {
      list = holding.purchases;
    } else if (holding.createdAt) {
      list = [
        {
          id: 'initial-purchase',
          date: holding.createdAt,
          shares: holding.shares,
          priceEur: position?.currentPrice,
        },
      ];
    }
    
    // Normalize dates to numeric timestamps
    return list.map(p => {
      const rawDate: any = p.date;
      let normalizedDate = Date.now();
      if (typeof rawDate === 'string') {
        const parsed = Date.parse(rawDate);
        if (!isNaN(parsed)) {
          normalizedDate = parsed;
        } else {
          // Try parse PT format "DD/MM/YYYY" or similar
          const parts = rawDate.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) {
              normalizedDate = d.getTime();
            }
          }
        }
      } else if (rawDate instanceof Date) {
        normalizedDate = rawDate.getTime();
      } else if (typeof rawDate === 'number') {
        normalizedDate = rawDate;
      }

      return {
        ...p,
        date: normalizedDate
      };
    });
  }, [holding, position?.currentPrice]);

  // Find earliest purchase date
  const earliestPurchaseTimestamp = useMemo(() => {
    if (purchaseRecords.length === 0) return null;
    return Math.min(...purchaseRecords.map((p) => p.date));
  }, [purchaseRecords]);

  const {
    fullPathD,
    areaD,
    coordinates,
    horizontalLineY,
    benchmarkPathD,
    benchmarkCoordinates,
  } = useMemo(() => {
    if (points.length === 0) {
      return {
        fullPathD: '',
        areaD: '',
        coordinates: [],
        horizontalLineY: 130,
        benchmarkPathD: '',
        benchmarkCoordinates: [],
      };
    }

    const w = svgDimensions.width || 360;
    const h = svgDimensions.height || 260;
    const marginX = 8;
    const usableWidth = w - marginX * 2;

    // Normalization logic: if benchmark is present, we use percentage returns
    const useNormalization = benchmarkPoints.length > 0;
    
    let mainPrices: number[] = [];
    let bPrices: number[] = [];

    if (useNormalization) {
      const startP = isUsd ? (points[0].price ?? points[0].priceEur) : points[0].priceEur;
      mainPrices = points.map(p => {
        const val = isUsd ? (p.price ?? p.priceEur) : p.priceEur;
        return ((val / (startP || 1)) - 1) * 100;
      });

      const bStartP = isUsd ? (benchmarkPoints[0].price ?? benchmarkPoints[0].priceEur) : benchmarkPoints[0].priceEur;
      bPrices = benchmarkPoints.map(p => {
        const val = isUsd ? (p.price ?? p.priceEur) : p.priceEur;
        return ((val / (bStartP || 1)) - 1) * 100;
      });
    } else {
      mainPrices = points.map((p) => (isUsd ? (p.price ?? p.priceEur) : p.priceEur));
    }

    const allPrices = useNormalization ? [...mainPrices, ...bPrices] : mainPrices;
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const paddingY = (max - min) * 0.15 || (Math.abs(max) > 0 ? Math.abs(max) * 0.1 : 1);
    const yMin = min - paddingY;
    const yMax = max + paddingY;

    // Helper to calculate Y coordinate
    const getY = (val: number) => {
      const yRatio = (val - yMin) / (yMax - yMin || 1);
      return h - (yRatio * (h - 40) + 20);
    };

    const coords = points.map((p, idx) => {
      const x = marginX + (idx / Math.max(1, points.length - 1)) * usableWidth;
      const y = getY(mainPrices[idx]);
      return { x, y, point: p, index: idx, normalizedVal: useNormalization ? mainPrices[idx] : undefined };
    });

    let bCoords: any[] = [];
    let bPath = '';
    if (useNormalization && benchmarkPoints.length > 0) {
      bCoords = benchmarkPoints.map((p, idx) => {
        const x = marginX + (idx / Math.max(1, benchmarkPoints.length - 1)) * usableWidth;
        const y = getY(bPrices[idx]);
        return { x, y, point: p, index: idx, normalizedVal: bPrices[idx] };
      });

      if (bCoords.length > 1) {
        bPath = `M ${bCoords[0].x.toFixed(1)},${bCoords[0].y.toFixed(1)}`;
        for (let i = 0; i < bCoords.length - 1; i++) {
          const c = bCoords[i];
          const n = bCoords[i + 1];
          const cpX = (c.x + n.x) / 2;
          bPath += ` C ${cpX.toFixed(1)},${c.y.toFixed(1)} ${cpX.toFixed(1)},${n.y.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}`;
        }
      }
    }

    const refStartValue = useNormalization ? 0 : (isUsd
      ? (chartData?.windowMetrics?.startPriceNative ?? points[0]?.price ?? points[0]?.priceEur)
      : (chartData?.windowMetrics?.startPriceEur ?? points[0]?.priceEur));
    const hLineY = getY(refStartValue);

    if (coords.length === 1) {
      return {
        fullPathD: `M 0,${coords[0].y} L ${w},${coords[0].y}`,
        areaD: `M 0,${coords[0].y} L ${w},${coords[0].y} L ${w},${h} L 0,${h} Z`,
        coordinates: coords,
        horizontalLineY: hLineY,
        benchmarkPathD: bPath,
        benchmarkCoordinates: bCoords,
      };
    }

    // Base path
    let fullD = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const c = coords[i];
      const n = coords[i + 1];
      const cpX = (c.x + n.x) / 2;
      fullD += ` C ${cpX.toFixed(1)},${c.y.toFixed(1)} ${cpX.toFixed(1)},${n.y.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}`;
    }

    // Gradient area starts STRICTLY from first purchase
    let areaPath = '';
    if (!useNormalization) {
      let firstPurchaseIdx = 0;
      if (earliestPurchaseTimestamp) {
        const firstTs = coords[0].point.timestamp;
        const lastTs = coords[coords.length - 1].point.timestamp;

        if (earliestPurchaseTimestamp > firstTs && earliestPurchaseTimestamp <= lastTs) {
          let minDiff = Infinity;
          for (let i = 0; i < coords.length; i++) {
            const diff = Math.abs(coords[i].point.timestamp - earliestPurchaseTimestamp);
            if (diff < minDiff) {
              minDiff = diff;
              firstPurchaseIdx = i;
            }
          }
        } else if (earliestPurchaseTimestamp <= firstTs) {
          firstPurchaseIdx = 0;
        }
      }

      const sliceCoords = coords.slice(firstPurchaseIdx);

      if (sliceCoords.length > 1) {
        const startCoord = sliceCoords[0];
        const endCoord = sliceCoords[sliceCoords.length - 1];

        let curveD = `M ${startCoord.x.toFixed(1)},${startCoord.y.toFixed(1)}`;
        for (let i = 0; i < sliceCoords.length - 1; i++) {
          const c = sliceCoords[i];
          const n = sliceCoords[i + 1];
          const cpX = (c.x + n.x) / 2;
          curveD += ` C ${cpX.toFixed(1)},${c.y.toFixed(1)} ${cpX.toFixed(1)},${n.y.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}`;
        }

        areaPath = `${curveD} L ${endCoord.x.toFixed(1)},${h} L ${startCoord.x.toFixed(1)},${h} Z`;
      }
    }

    return {
      fullPathD: fullD,
      areaD: areaPath,
      coordinates: coords,
      horizontalLineY: hLineY,
      benchmarkPathD: bPath,
      benchmarkCoordinates: bCoords,
    };
  }, [points, benchmarkPoints, svgDimensions, earliestPurchaseTimestamp, isUsd, chartData]);

  // Position purchase markers on the curve
  const purchaseMarkers = useMemo(() => {
    if (purchaseRecords.length === 0 || coordinates.length === 0) return [];

    const firstTs = coordinates[0].point.timestamp;
    const lastTs = coordinates[coordinates.length - 1].point.timestamp;

    const markers: Array<{
      id: string;
      x: number;
      y: number;
      timestamp: number;
      buyPrice: number;
      buyPriceEur: number;
      dateFormatted: string;
      shares: number;
      high: number;
      low: number;
      highEur: number;
      lowEur: number;
    }> = [];

    purchaseRecords.forEach((purchase, idx) => {
      const pTs = purchase.date;
      if (pTs < firstTs - 86400000 || pTs > lastTs + 86400000) {
        return;
      }

      let closest = coordinates[0];
      let minDiff = Math.abs(coordinates[0].point.timestamp - pTs);

      for (let i = 1; i < coordinates.length; i++) {
        const diff = Math.abs(coordinates[i].point.timestamp - pTs);
        if (diff < minDiff) {
          minDiff = diff;
          closest = coordinates[i];
        }
      }

      const fx = chartData?.fxRateToEur || 1;
      let pEur = purchase.priceEur ?? purchase.price ?? closest.point.priceEur;

      const dayHigh = closest.point.highEur != null 
        ? closest.point.highEur 
        : (closest.point.high != null ? closest.point.high * fx : closest.point.priceEur);
      const dayLow = closest.point.lowEur != null 
        ? closest.point.lowEur 
        : (closest.point.low != null ? closest.point.low * fx : closest.point.priceEur);

      if (fx !== 1 && pEur > dayHigh * 1.05 && closest.point.high && Math.abs(pEur - closest.point.high) < Math.abs(pEur - dayHigh)) {
        pEur = pEur * fx;
      } else if (fx !== 1 && purchase.price != null && purchase.priceEur == null) {
        pEur = purchase.price * fx;
      }

      const pNative = purchase.price != null 
        ? purchase.price 
        : (fx > 0 ? pEur / fx : pEur);
      const dayHighNative = closest.point.high != null ? closest.point.high : (fx > 0 ? dayHigh / fx : dayHigh);
      const dayLowNative = closest.point.low != null ? closest.point.low : (fx > 0 ? dayLow / fx : dayLow);

      markers.push({
        id: purchase.id || `purchase-${idx}`,
        x: closest.x,
        y: closest.y,
        timestamp: pTs,
        buyPrice: isUsd ? pNative : pEur,
        buyPriceEur: pEur,
        dateFormatted: new Date(pTs).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        shares: purchase.shares,
        high: isUsd ? dayHighNative : dayHigh,
        low: isUsd ? dayLowNative : dayLow,
        highEur: dayHigh,
        lowEur: dayLow,
      });
    });

    return markers;
  }, [purchaseRecords, coordinates, chartData, isUsd]);

  const hoveredPurchaseInfo = useMemo(() => {
    if (activePurchaseTooltip) return activePurchaseTooltip;
    if (scrubIndex !== null && points[scrubIndex]) {
      const currentPoint = points[scrubIndex];
      const match = purchaseMarkers.find((m) => {
        const diffMs = Math.abs(m.timestamp - currentPoint.timestamp);
        return diffMs <= 36 * 60 * 60 * 1000;
      });
      return match || null;
    }
    return null;
  }, [activePurchaseTooltip, scrubIndex, points, purchaseMarkers]);

  const twoFingerStats = useMemo(() => {
    if (!twoFingerRange || points.length === 0) return null;
    const [startIdx, endIdx] = twoFingerRange;
    const leftIdx = Math.min(startIdx, endIdx);
    const rightIdx = Math.max(startIdx, endIdx);

    const sliced = points.slice(leftIdx, rightIdx + 1);
    if (sliced.length === 0) return null;

    const startPoint = sliced[0];
    const endPoint = sliced[sliced.length - 1];

    const startPrice = isUsd ? (startPoint.price ?? startPoint.priceEur) : startPoint.priceEur;
    const endPrice = isUsd ? (endPoint.price ?? endPoint.priceEur) : endPoint.priceEur;
    const diff = endPrice - startPrice;
    const diffPercent = startPrice > 0 ? (diff / startPrice) * 100 : 0;
    const isPos = diff >= 0;

    const leftCoord = coordinates[leftIdx] || coordinates[0];
    const rightCoord = coordinates[rightIdx] || coordinates[coordinates.length - 1];
    const centerX = (leftCoord.x + rightCoord.x) / 2;

    const leftDateFormatted = new Date(startPoint.timestamp).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: selectedRange === '1y' || selectedRange === 'max' ? 'numeric' : undefined,
      hour: selectedRange === '1d' || selectedRange === '1w' ? '2-digit' : undefined,
      minute: selectedRange === '1d' || selectedRange === '1w' ? '2-digit' : undefined,
    });
    const rightDateFormatted = new Date(endPoint.timestamp).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: selectedRange === '1y' || selectedRange === 'max' ? 'numeric' : undefined,
      hour: selectedRange === '1d' || selectedRange === '1w' ? '2-digit' : undefined,
      minute: selectedRange === '1d' || selectedRange === '1w' ? '2-digit' : undefined,
    });

    return {
      startPrice,
      endPrice,
      diff,
      diffPercent,
      isPos,
      leftX: leftCoord.x,
      rightX: rightCoord.x,
      centerX,
      leftDateFormatted,
      rightDateFormatted,
    };
  }, [twoFingerRange, points, coordinates, selectedRange, isUsd]);

  const activeIndex = scrubIndex !== null ? scrubIndex : points.length - 1;
  const activePoint = points[activeIndex] || null;
  const activeCoord = coordinates[activeIndex] || null;

  // Ponto inicial determinístico da janela (calculado pelo backend com base no targetStartTimestamp da janela selecionada)
  const defaultStartPrice = isUsd
    ? (chartData?.windowMetrics?.startPriceNative ?? (points.length > 0 ? (points[0].price ?? points[0].priceEur) : (position?.nativePrice || position?.currentPrice || 0)))
    : (chartData?.windowMetrics?.startPriceEur ?? (points.length > 0 ? points[0].priceEur : (position?.currentPrice || 0)));
  const startPrice = defaultStartPrice;
  const displayedPrice = activePoint 
    ? (isUsd ? (activePoint.price ?? activePoint.priceEur) : activePoint.priceEur)
    : (isUsd ? (position?.nativePrice || position?.currentPrice || 0) : (position?.currentPrice || 0));
  const diffFromStart = displayedPrice - startPrice;
  const diffPercentFromStart = startPrice > 0 ? (diffFromStart / startPrice) * 100 : 0;
  const isPositive = diffFromStart >= 0;

  // Benchmark return for the visible window
  const benchmarkPerf = useMemo(() => {
    if (!benchmarkPoints || benchmarkPoints.length < 2) return null;
    const first = isUsd ? (benchmarkPoints[0].price ?? benchmarkPoints[0].priceEur) : benchmarkPoints[0].priceEur;
    const last = isUsd ? (benchmarkPoints[benchmarkPoints.length - 1].price ?? benchmarkPoints[benchmarkPoints.length - 1].priceEur) : benchmarkPoints[benchmarkPoints.length - 1].priceEur;
    if (!first || first === 0) return 0;
    return ((last / first) - 1) * 100;
  }, [benchmarkPoints, isUsd]);

  const getIndexFromClientX = (clientX: number) => {
    if (!svgRef.current || coordinates.length === 0) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;

    let closestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < coordinates.length; i++) {
      const dist = Math.abs(coordinates[i].x - relX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }
    return closestIdx;
  };

  const handleDoubleTap = (clientX: number) => {
    if (zoomWindow) {
      setZoomWindow(null);
    } else if (rawPoints.length > 10) {
      const rect = svgRef.current?.getBoundingClientRect();
      const relX = rect ? clientX - rect.left : svgDimensions.width / 2;
      const ratio = Math.max(0, Math.min(1, relX / (rect?.width || svgDimensions.width)));
      const centerIdx = Math.round(ratio * (rawPoints.length - 1));
      const halfWindow = Math.round(rawPoints.length * 0.2);
      const start = Math.max(0, centerIdx - halfWindow);
      const end = Math.min(rawPoints.length - 1, start + halfWindow * 2);
      setZoomWindow([start, end]);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setScrubIndex(null);
      setActivePurchaseTooltip(null);

      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      initialZoomWindowRef.current = zoomWindow || [0, rawPoints.length - 1];
      const rect = svgRef.current?.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      touchStartCenterRatioRef.current = rect ? (midX - rect.left) / rect.width : 0.5;

      setTouchMode('two-finger');
      const idx1 = getIndexFromClientX(e.touches[0].clientX);
      const idx2 = getIndexFromClientX(e.touches[1].clientX);
      setTwoFingerRange([Math.min(idx1, idx2), Math.max(idx1, idx2)]);
    } else if (e.touches.length === 1) {
      setTwoFingerRange(null);
      setTouchMode('scrub');
      const now = Date.now();
      if (now - lastTapRef.current < 320) {
        handleDoubleTap(e.touches[0].clientX);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      const idx = getIndexFromClientX(e.touches[0].clientX);
      setScrubIndex(idx);
      setActivePurchaseTooltip(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      if (touchStartDistRef.current && Math.abs(dist - touchStartDistRef.current) > 18) {
        setTouchMode('pinch');
        setTwoFingerRange(null);

        if (rawPoints.length > 8) {
          const scaleFactor = dist / touchStartDistRef.current;
          const [initStart, initEnd] = initialZoomWindowRef.current || [0, rawPoints.length - 1];
          const initialSpan = initEnd - initStart;
          const newSpan = Math.max(6, Math.min(rawPoints.length, Math.round(initialSpan / scaleFactor)));
          if (newSpan < rawPoints.length) {
            const centerIdx = initStart + Math.round(initialSpan * touchStartCenterRatioRef.current);
            let newStart = Math.max(0, centerIdx - Math.round(newSpan * touchStartCenterRatioRef.current));
            let newEnd = newStart + newSpan;
            if (newEnd >= rawPoints.length) {
              newEnd = rawPoints.length - 1;
              newStart = Math.max(0, newEnd - newSpan);
            }
            setZoomWindow([newStart, newEnd]);
          }
        }
      } else if (touchMode !== 'pinch') {
        const idx1 = getIndexFromClientX(e.touches[0].clientX);
        const idx2 = getIndexFromClientX(e.touches[1].clientX);
        setTwoFingerRange([Math.min(idx1, idx2), Math.max(idx1, idx2)]);
      }
    } else if (e.touches.length === 1 && !twoFingerRange) {
      const idx = getIndexFromClientX(e.touches[0].clientX);
      setScrubIndex(idx);
    }
  };

  const handleTouchEnd = () => {
    setScrubIndex(null);
    setTouchMode('idle');
    touchStartDistRef.current = null;
  };

  if (!isOpen || !position) return null;

  const shortName = getShortDescription(position.ticker, position.name);
  const metrics = chartData?.metrics;

  const hasDayRange = metrics?.dayHighEur != null && metrics?.dayLowEur != null;
  const has52wRange = metrics?.fiftyTwoWeekHighEur != null && metrics?.fiftyTwoWeekLowEur != null;
  const hasValuation =
    metrics?.pe != null ||
    metrics?.forwardPE != null ||
    metrics?.pegRatio != null ||
    metrics?.pb != null ||
    metrics?.ps != null ||
    metrics?.evEbitda != null ||
    metrics?.evRevenue != null ||
    metrics?.epsEur != null ||
    metrics?.forwardEpsEur != null ||
    metrics?.beta != null;

  const hasEstimates =
    metrics?.targetPriceEur != null ||
    metrics?.recommendation != null ||
    metrics?.numberOfAnalystOpinions != null ||
    metrics?.recommendationTrend != null;

  const hasProfitability =
    metrics?.profitMargins != null ||
    metrics?.operatingMargins != null ||
    metrics?.grossMargins != null ||
    metrics?.returnOnEquity != null ||
    metrics?.returnOnAssets != null;

  const hasBalanceSheet =
    metrics?.totalCashEur != null ||
    metrics?.totalDebtEur != null ||
    metrics?.currentRatio != null ||
    metrics?.debtToEquity != null ||
    metrics?.freeCashflowEur != null ||
    metrics?.marketCapEur != null;

  const hasOwnership =
    metrics?.heldPercentInstitutions != null ||
    metrics?.heldPercentInsiders != null ||
    metrics?.shortPercentOfFloat != null;

  const hasDividends =
    metrics?.dividendYield != null ||
    metrics?.dividendRateEur != null ||
    metrics?.payoutRatio != null ||
    metrics?.fiveYearAvgDividendYield != null ||
    metrics?.exDividendDate != null;

  const hasEarnings = metrics?.earningsDate != null;

  const customComparison = selectedMetricId && position
    ? generateCustomMetricComparison({
        metricId: selectedMetricId,
        ticker: position.ticker,
        name: position.name,
        currentPrice: isUsd
          ? (position.nativePrice ?? chartData?.currentPrice ?? position.currentPrice)
          : (position.currentPrice ?? chartData?.currentPriceEur),
        metrics: metrics,
        currencySymbol: currencySymbol,
        isUsd: isUsd,
        shares: position.shares || 0,
      })
    : null;

  const formatLargeNum = (val: number | null | undefined, prefix: string = '') => {
    if (val == null) return '-';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}k`;
    return `${sign}${prefix}${abs.toFixed(2)}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        id="stock-chart-fullscreen-view"
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden select-none"
      >
        {/* Minimalist Header: Company Name & Discrete Ticker on Left, Minimalist X on Right */}
        <div className="w-full px-5 pt-[env(safe-area-inset-top,14px)] pb-2 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-md shrink-0 z-10">
          <div className="flex flex-col items-start">
            <h2 className="text-base font-black text-slate-900 tracking-tight max-w-[260px] truncate">
              {shortName}
            </h2>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              {position.ticker}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 -mr-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Scrollable Viewport Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col pb-[env(safe-area-inset-bottom,32px)]">
          {/* Main Price Header */}
          <div className="px-5 pt-4 pb-1 shrink-0">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-900">{currencySymbol}</span>
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight tabular-nums">
                  {displayedPrice.toLocaleString('pt-PT', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex flex-col gap-0.5 mt-2">
                {/* Main Ticker Row */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider w-11">
                    {position.ticker}
                  </span>
                  <span className={`text-[12px] font-bold tabular-nums ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isPositive ? '+' : ''}{diffPercentFromStart.toFixed(2)}%
                  </span>
                  {!benchmarkTicker && (
                    <span className="text-[12px] font-medium text-slate-400 tabular-nums ml-0.5">
                      ({isPositive ? '+' : '-'}{currencySymbol}{Math.abs(diffFromStart).toLocaleString('pt-PT', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })})
                    </span>
                  )}
                </div>

                {/* Benchmark Row */}
                {benchmarkTicker && benchmarkPerf !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider w-11">
                      {benchmarkTicker}
                    </span>
                    <span className={`text-[12px] font-bold tabular-nums ${benchmarkPerf >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {benchmarkPerf >= 0 ? '+' : ''}{benchmarkPerf.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="h-[36px] mt-1 flex flex-col justify-center">
                {hoveredPurchaseInfo ? (
                  <div className="flex flex-col gap-0.5 animate-fadeIn">
                    <div className="text-xs text-slate-700 font-medium leading-tight">
                      Preço compra:{' '}
                      <strong className="text-xs font-bold text-slate-900 tabular-nums">
                        {currencySymbol}
                        {hoveredPurchaseInfo.buyPrice.toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-normal tabular-nums leading-tight">
                      <span>
                        Mín: {currencySymbol}
                        {hoveredPurchaseInfo.low.toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        Máx: {currencySymbol}
                        {hoveredPurchaseInfo.high.toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-full" />
                )}
              </div>
            </div>
          </div>

          {/* Interactive Chart Area */}
          <div className="relative w-full px-3 py-1 shrink-0 h-[260px] flex flex-col justify-center">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 z-20">
                <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                <span className="text-xs font-bold text-slate-400">A carregar dados do mercado...</span>
              </div>
            )}

            {hasError && !isLoading && (
              <div className="w-full py-12 flex flex-col items-center justify-center text-center px-4">
                <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                <p className="text-xs font-bold text-slate-700">Histórico de cotação temporariamente indisponível</p>
                <button
                  type="button"
                  onClick={() => setSelectedRange(selectedRange)}
                  className="mt-3 px-3 py-1.5 bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            )}

            {!hasError && (
              <div
                className="relative w-full h-full touch-none cursor-crosshair overflow-visible"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onPointerDown={(e) => {
                  const idx = getIndexFromClientX(e.clientX);
                  setScrubIndex(idx);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) {
                    const idx = getIndexFromClientX(e.clientX);
                    setScrubIndex(idx);
                  }
                }}
                onPointerUp={() => setScrubIndex(null)}
                onPointerLeave={() => setScrubIndex(null)}
              >
                <svg
                  ref={svgRef}
                  className="w-full h-full overflow-visible"
                  viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="ultraLightSkyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity="0.16" />
                      <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#f0f9ff" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Reference Line */}
                  <line
                    x1="0"
                    y1={horizontalLineY}
                    x2={svgDimensions.width}
                    y2={horizontalLineY}
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                    opacity="0.9"
                  />

                  {/* Gradient Area */}
                  {areaD && (
                    <path
                      d={areaD}
                      fill="url(#ultraLightSkyGrad)"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Benchmark Line */}
                  {benchmarkPathD && (
                    <path
                      d={benchmarkPathD}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300"
                      strokeDasharray="1 0"
                    />
                  )}

                  {/* Solid Continuous Line */}
                  <path
                    d={fullPathD}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-200"
                  />

                  {/* Purchase Markers */}
                  {purchaseMarkers.map((marker) => {
                    const isSelected = hoveredPurchaseInfo?.id === marker.id;
                    return (
                      <g
                        key={marker.id}
                        className="cursor-pointer"
                        onMouseEnter={() => setActivePurchaseTooltip(marker)}
                        onMouseLeave={() => setActivePurchaseTooltip(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePurchaseTooltip((prev) => (prev?.id === marker.id ? null : marker));
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          setActivePurchaseTooltip((prev) => (prev?.id === marker.id ? null : marker));
                        }}
                      >
                        <circle cx={marker.x} cy={marker.y} r="14" fill="transparent" />
                        <circle
                          cx={marker.x}
                          cy={marker.y}
                          r={isSelected ? "9" : "6.5"}
                          fill="#0284c7"
                          fillOpacity={isSelected ? "0.35" : "0.15"}
                          className="animate-pulse"
                        />
                        <circle
                          cx={marker.x}
                          cy={marker.y}
                          r={isSelected ? "4.5" : "3.2"}
                          fill={isSelected ? "#0284c7" : "#FFFFFF"}
                          stroke="#0284c7"
                          strokeWidth="1.5"
                          className="shadow-sm"
                        />
                      </g>
                    );
                  })}

                  {/* Single Finger Vertical Reference Line */}
                  {activeCoord && scrubIndex !== null && !twoFingerStats && (
                    <g>
                      <line
                        x1={activeCoord.x}
                        y1="0"
                        x2={activeCoord.x}
                        y2={svgDimensions.height}
                        stroke="#94a3b8"
                        strokeWidth="1.2"
                        opacity="1"
                      />
                      {benchmarkCoordinates.length > 0 && (
                        <circle
                          cx={activeCoord.x}
                          cy={benchmarkCoordinates[Math.min(benchmarkCoordinates.length - 1, Math.round((activeCoord.x - 8) / (svgDimensions.width - 16) * (benchmarkCoordinates.length - 1)))].y}
                          r="3"
                          fill="#f59e0b"
                          stroke="white"
                          strokeWidth="1.5"
                        />
                      )}
                      <circle
                        cx={activeCoord.x}
                        cy={activeCoord.y}
                        r="4"
                        fill="#0284c7"
                        stroke="white"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}

                  {/* Two-Finger Dual Vertical Boundary Lines */}
                  {twoFingerStats && (
                    <g>
                      <line
                        x1={twoFingerStats.leftX}
                        y1="0"
                        x2={twoFingerStats.leftX}
                        y2={svgDimensions.height}
                        stroke="#94a3b8"
                        strokeWidth="0.9"
                        opacity="0.8"
                      />
                      <line
                        x1={twoFingerStats.rightX}
                        y1="0"
                        x2={twoFingerStats.rightX}
                        y2={svgDimensions.height}
                        stroke="#94a3b8"
                        strokeWidth="0.9"
                        opacity="0.8"
                      />
                    </g>
                  )}
                </svg>

                {activeCoord && scrubIndex !== null && !twoFingerStats && (
                  <div
                    className="absolute pointer-events-none transform -translate-x-1/2 top-0 text-[11px] font-bold text-slate-600 bg-white/95 px-2 py-1 rounded-lg shadow-lg border border-slate-100 backdrop-blur-sm z-30 flex flex-col items-center gap-0.5"
                    style={{
                      left: `${(activeCoord.x / (svgDimensions.width || 1)) * 100}%`,
                    }}
                  >
                    <span className="text-slate-400 text-[10px] whitespace-nowrap mb-0.5">
                      {new Date(activeCoord.point.timestamp).toLocaleDateString('pt-PT', {
                        day: '2-digit',
                        month: 'short',
                        year: selectedRange === '1y' || selectedRange === 'max' ? 'numeric' : undefined,
                        hour: selectedRange === '1d' || selectedRange === '1w' ? '2-digit' : undefined,
                        minute: selectedRange === '1d' || selectedRange === '1w' ? '2-digit' : undefined,
                      })}
                    </span>
                    
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-3 min-w-[80px]">
                        <span className="text-sky-600 font-black">{position.ticker}</span>
                        <span className={`font-black tabular-nums ${activeCoord.normalizedVal !== undefined ? (activeCoord.normalizedVal >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-900'}`}>
                          {activeCoord.normalizedVal !== undefined 
                            ? `${activeCoord.normalizedVal >= 0 ? '+' : ''}${activeCoord.normalizedVal.toFixed(2)}%`
                            : `${currencySymbol}${(isUsd ? (activeCoord.point.price ?? activeCoord.point.priceEur) : activeCoord.point.priceEur).toFixed(2)}`
                          }
                        </span>
                      </div>
                      
                      {benchmarkCoordinates.length > 0 && (() => {
                        // Find benchmark point at same relative index
                        const bIdx = Math.min(benchmarkCoordinates.length - 1, Math.round((activeCoord.x - 8) / (svgDimensions.width - 16) * (benchmarkCoordinates.length - 1)));
                        const bCoord = benchmarkCoordinates[bIdx];
                        if (!bCoord) return null;
                        
                        return (
                          <div className="flex items-center justify-between gap-3 min-w-[80px] border-t border-slate-50 mt-0.5 pt-0.5">
                            <span className="text-amber-600 font-black">{benchmarkTicker}</span>
                            <span className={`font-black tabular-nums ${bCoord.normalizedVal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {bCoord.normalizedVal >= 0 ? '+' : ''}{bCoord.normalizedVal.toFixed(2)}%
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {twoFingerStats && (
                  <div className="absolute top-0 left-0 right-0 pointer-events-none z-20">
                    <div
                      className="absolute transform -translate-x-1/2 top-0 flex flex-col items-center"
                      style={{
                        left: `${(twoFingerStats.leftX / (svgDimensions.width || 1)) * 100}%`,
                      }}
                    >
                      <span className="text-xs font-black text-slate-900 tabular-nums bg-white/90 px-1 rounded">
                        {currencySymbol}{twoFingerStats.startPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                        {twoFingerStats.leftDateFormatted}
                      </span>
                    </div>

                    <div
                      className="absolute transform -translate-x-1/2 top-0 flex flex-col items-center"
                      style={{
                        left: `${(twoFingerStats.centerX / (svgDimensions.width || 1)) * 100}%`,
                      }}
                    >
                      <span
                        className={`text-xs font-black tabular-nums bg-white/90 px-1.5 rounded ${
                          twoFingerStats.isPos ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {twoFingerStats.isPos ? '+' : '-'}{currencySymbol}{Math.abs(twoFingerStats.diff).toFixed(2)}
                      </span>
                      <span
                        className={`text-[11px] font-black tabular-nums ${
                          twoFingerStats.isPos ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {twoFingerStats.isPos ? '+' : ''}
                        {twoFingerStats.diffPercent.toFixed(2)}%
                      </span>
                    </div>

                    <div
                      className="absolute transform -translate-x-1/2 top-0 flex flex-col items-center"
                      style={{
                        left: `${(twoFingerStats.rightX / (svgDimensions.width || 1)) * 100}%`,
                      }}
                    >
                      <span className="text-xs font-black text-slate-900 tabular-nums bg-white/90 px-1 rounded">
                        {currencySymbol}{twoFingerStats.endPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                        {twoFingerStats.rightDateFormatted}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Benchmark Action Bar (Matching Home tab design) */}
          <div className="w-full flex justify-end items-center px-5 pt-0 pb-1">
            {!benchmarkTicker && (
              <button
                type="button"
                onClick={() => setShowBenchmarkInput(!showBenchmarkInput)}
                className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 focus:outline-none"
              >
                <span>+</span>
                <span>Benchmark</span>
              </button>
            )}

            {benchmarkTicker && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <span className="uppercase tracking-wider">{benchmarkTicker}</span>
                <button 
                  onClick={() => {
                    setBenchmarkTicker('');
                    setBenchmarkData(null);
                    setShowBenchmarkInput(false);
                  }}
                  className="p-1 -mr-1 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Benchmark Search Input */}
          <AnimatePresence>
            {showBenchmarkInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-5 relative z-50 mb-2"
              >
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={benchmarkSearchQuery}
                      onChange={(e) => setBenchmarkSearchQuery(e.target.value)}
                      placeholder="Comparar com (ex: SPY, AAPL...)"
                      className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      autoFocus
                    />
                    {isSearchingBenchmark && (
                      <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                    )}
                  </div>

                  {benchmarkSearchResults.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[60] max-h-48 overflow-y-auto p-1">
                      {benchmarkSearchResults.map((res) => (
                        <button
                          key={res.symbol}
                          type="button"
                          onClick={() => {
                            setBenchmarkTicker(res.symbol);
                            setShowBenchmarkInput(false);
                            setBenchmarkSearchQuery('');
                            setBenchmarkSearchResults([]);
                          }}
                          className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg transition-colors text-left"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">{res.symbol}</span>
                            <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{res.shortname || res.longname}</span>
                          </div>
                          <Plus className="w-3 h-3 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Time Range Selector */}
          <div className="px-5 py-2 shrink-0">
            <div className="flex items-center justify-between gap-1">
              {TIME_RANGES.map((r) => {
                const isActive = selectedRange === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      setSelectedRange(r.key);
                      setActivePurchaseTooltip(null);
                      setTwoFingerRange(null);
                      setZoomWindow(null);
                    }}
                    className={`flex-1 py-1 px-1.5 text-xs font-medium rounded-full transition-all cursor-pointer text-center ${
                      isActive
                        ? 'bg-sky-100 text-sky-700 font-semibold'
                        : 'text-slate-400 hover:text-slate-700 active:scale-95'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fundamental Metrics Grid */}
          <div className="px-5 mt-3 space-y-4">
            {(hasDayRange || has52wRange) && (
              <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-3.5 space-y-3">
                {hasDayRange && (
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-500">
                      <span>Máx / Mín Hoje</span>
                    </div>
                    <div className="text-xs font-black text-slate-800 tabular-nums">
                      {currencySymbol}{(isUsd ? (metrics?.dayLow ?? metrics?.dayLowEur) : metrics?.dayLowEur)?.toFixed(2)} - {currencySymbol}{(isUsd ? (metrics?.dayHigh ?? metrics?.dayHighEur) : metrics?.dayHighEur)?.toFixed(2)}
                    </div>
                  </div>
                )}

                {has52wRange && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
                      <span>Intervalo 52 Semanas</span>
                      <span className="text-[11px] font-black text-sky-600">
                        {metrics?.fiftyTwoWeekRangePercent != null
                          ? `${metrics.fiftyTwoWeekRangePercent.toFixed(0)}% da amplitude`
                          : ''}
                      </span>
                    </div>

                    <div className="relative w-full h-1.5 bg-slate-200 rounded-full overflow-hidden my-2">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full"
                        style={{
                          width: `${Math.max(4, Math.min(100, metrics?.fiftyTwoWeekRangePercent ?? 50))}%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] font-bold text-slate-400 tabular-nums">
                      <span>Mín: {currencySymbol}{(isUsd ? (metrics?.fiftyTwoWeekLow ?? metrics?.fiftyTwoWeekLowEur) : metrics?.fiftyTwoWeekLowEur)?.toFixed(2)}</span>
                      <span>Máx: {currencySymbol}{(isUsd ? (metrics?.fiftyTwoWeekHigh ?? metrics?.fiftyTwoWeekHighEur) : metrics?.fiftyTwoWeekHighEur)?.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Informational tip */}
            <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400">
              <span className="uppercase tracking-wider">Métricas & Fundamentais</span>
            </div>

            {hasEstimates && (
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-sky-600" />
                    <span>Wall Street & Analistas</span>
                  </div>
                  {metrics?.numberOfAnalystOpinions != null && (
                    <span className="text-[10px] font-bold text-slate-400">
                      {metrics.numberOfAnalystOpinions} analistas
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(isUsd ? (metrics?.targetPrice ?? metrics?.targetPriceEur) : metrics?.targetPriceEur) != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('targetPrice')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 col-span-2 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Preço-Alvo Médio</span>
                        {metrics?.targetUpsidePercent != null && (
                          <span
                            className={`text-xs font-black tabular-nums px-1.5 py-0.5 rounded-md ${
                              metrics.targetUpsidePercent >= 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {metrics.targetUpsidePercent >= 0 ? '+' : ''}
                            {metrics.targetUpsidePercent.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">
                        {currencySymbol}{(isUsd ? (metrics?.targetPrice ?? metrics?.targetPriceEur) : metrics?.targetPriceEur)?.toFixed(2)}
                      </div>
                      {(metrics?.targetLowEur != null || metrics?.targetHighEur != null) && (
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-2 pt-2 border-t border-slate-200/60 tabular-nums">
                          <span>Mín: {currencySymbol}{(isUsd ? (metrics?.targetLow ?? metrics?.targetLowEur) : metrics?.targetLowEur)?.toFixed(2)}</span>
                          <span>Med: {currencySymbol}{(isUsd ? (metrics?.targetMedian ?? metrics?.targetMedianEur) : metrics?.targetMedianEur)?.toFixed(2)}</span>
                          <span>Máx: {currencySymbol}{(isUsd ? (metrics?.targetHigh ?? metrics?.targetHighEur) : metrics?.targetHighEur)?.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {metrics?.recommendation != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('recommendation')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 col-span-2 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Consenso de Compra</span>
                        {metrics?.recommendationMean != null && (
                          <span className="text-[10px] font-bold text-slate-400">
                            Nota: {metrics.recommendationMean.toFixed(1)}/5.0
                          </span>
                        )}
                      </div>
                      <div className="text-base font-black text-emerald-700 mt-1 truncate">
                        {metrics.recommendation}
                      </div>

                      {metrics?.recommendationTrend && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                            {metrics.recommendationTrend.strongBuy > 0 && (
                              <div
                                style={{ flex: metrics.recommendationTrend.strongBuy }}
                                className="bg-emerald-600"
                                title={`Compra Forte: ${metrics.recommendationTrend.strongBuy}`}
                              />
                            )}
                            {metrics.recommendationTrend.buy > 0 && (
                              <div
                                style={{ flex: metrics.recommendationTrend.buy }}
                                className="bg-emerald-400"
                                title={`Compra: ${metrics.recommendationTrend.buy}`}
                              />
                            )}
                            {metrics.recommendationTrend.hold > 0 && (
                              <div
                                style={{ flex: metrics.recommendationTrend.hold }}
                                className="bg-amber-400"
                                title={`Manter: ${metrics.recommendationTrend.hold}`}
                              />
                            )}
                            {metrics.recommendationTrend.underperform > 0 && (
                              <div
                                style={{ flex: metrics.recommendationTrend.underperform }}
                                className="bg-rose-300"
                                title={`Abaixo da média: ${metrics.recommendationTrend.underperform}`}
                              />
                            )}
                            {metrics.recommendationTrend.sell > 0 && (
                              <div
                                style={{ flex: metrics.recommendationTrend.sell }}
                                className="bg-rose-600"
                                title={`Venda: ${metrics.recommendationTrend.sell}`}
                              />
                            )}
                          </div>
                          <div className="flex justify-between text-[9px] font-semibold text-slate-400 mt-1">
                            <span>{metrics.recommendationTrend.strongBuy + metrics.recommendationTrend.buy} Compra</span>
                            <span>{metrics.recommendationTrend.hold} Manter</span>
                            <span>{metrics.recommendationTrend.underperform + metrics.recommendationTrend.sell} Venda</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasValuation && (
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  <span>Múltiplos de Avaliação (Valuation)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {metrics?.pe != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('pe')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">P/E Atual</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.pe.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.forwardPE != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('forwardPE')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Forward P/E</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.forwardPE.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.pegRatio != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('pegRatio')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">PEG Ratio</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.pegRatio.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.pb != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('pb')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">P/B (Preço/Valor)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.pb.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.ps != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('ps')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">P/S (Preço/Vendas)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.ps.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.evEbitda != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('evEbitda')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">EV / EBITDA</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.evEbitda.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {(isUsd ? (metrics?.eps ?? metrics?.epsEur) : metrics?.epsEur) != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('eps')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">EPS Atual</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {currencySymbol}{(isUsd ? (metrics?.eps ?? metrics?.epsEur) : metrics?.epsEur)?.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {(isUsd ? (metrics?.forwardEps ?? metrics?.forwardEpsEur) : metrics?.forwardEpsEur) != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('forwardEps')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Forward EPS</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {currencySymbol}{(isUsd ? (metrics?.forwardEps ?? metrics?.forwardEpsEur) : metrics?.forwardEpsEur)?.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.beta != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('beta')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Beta (Risco)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.beta.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasProfitability && (
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Rentabilidade & Margens</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {metrics?.profitMargins != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('profitMargins')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Margem Líquida</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.profitMargins.toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {metrics?.operatingMargins != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('operatingMargins')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Margem Operacional</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.operatingMargins.toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {metrics?.grossMargins != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('grossMargins')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Margem Bruta</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.grossMargins.toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {metrics?.returnOnEquity != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('returnOnEquity')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">ROE (Cap. Próprio)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.returnOnEquity.toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {metrics?.returnOnAssets != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('returnOnAssets')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">ROA (Ativos)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.returnOnAssets.toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasBalanceSheet && (
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>Balanço, Caixa & Dívida</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(isUsd ? (metrics?.marketCap ?? metrics?.marketCapEur) : metrics?.marketCapEur) != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('marketCap')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Capitalização</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {formatLargeNum(isUsd ? (metrics?.marketCap ?? metrics?.marketCapEur) : metrics?.marketCapEur, currencySymbol)}
                      </div>
                    </div>
                  )}

                  {(isUsd ? (metrics?.totalCash ?? metrics?.totalCashEur) : metrics?.totalCashEur) != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('totalCash')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Caixa Total</span>
                      </div>
                      <div className="text-base font-black text-emerald-600 mt-1 tabular-nums">
                        {formatLargeNum(isUsd ? (metrics?.totalCash ?? metrics?.totalCashEur) : metrics?.totalCashEur, currencySymbol)}
                      </div>
                    </div>
                  )}

                  {(isUsd ? (metrics?.totalDebt ?? metrics?.totalDebtEur) : metrics?.totalDebtEur) != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('totalDebt')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Dívida Total</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {formatLargeNum(isUsd ? (metrics?.totalDebt ?? metrics?.totalDebtEur) : metrics?.totalDebtEur, currencySymbol)}
                      </div>
                    </div>
                  )}

                  {(isUsd ? (metrics?.freeCashflow ?? metrics?.freeCashflowEur) : metrics?.freeCashflowEur) != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('freeCashflow')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Free Cash Flow</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {formatLargeNum(isUsd ? (metrics?.freeCashflow ?? metrics?.freeCashflowEur) : metrics?.freeCashflowEur, currencySymbol)}
                      </div>
                    </div>
                  )}

                  {metrics?.currentRatio != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('currentRatio')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Current Ratio</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.currentRatio.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.debtToEquity != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('debtToEquity')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Dívida / Capital</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.debtToEquity.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasOwnership && (
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Detenção & Sentimento Institucional</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {metrics?.heldPercentInstitutions != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('heldPercentInstitutions')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Institucionais</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.heldPercentInstitutions.toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {metrics?.heldPercentInsiders != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('heldPercentInsiders')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Insiders</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.heldPercentInsiders.toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {metrics?.shortPercentOfFloat != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('shortPercentOfFloat')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Short Interest</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.shortPercentOfFloat.toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(hasDividends || hasEarnings) && (
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dividendos & Calendário</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {metrics?.dividendYield != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('dividendYield')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Dividend Yield</span>
                      </div>
                      <div className="text-base font-black text-emerald-600 mt-1 tabular-nums">
                        {metrics.dividendYield.toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {(isUsd ? (metrics?.dividendRate ?? metrics?.dividendRateEur) : metrics?.dividendRateEur) != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('dividendRate')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Dividendo Anual</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {currencySymbol}{(isUsd ? (metrics?.dividendRate ?? metrics?.dividendRateEur) : metrics?.dividendRateEur)?.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.payoutRatio != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('payoutRatio')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Payout Ratio</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.payoutRatio.toFixed(1)}%
                      </div>
                    </div>
                  )}

                  {metrics?.fiveYearAvgDividendYield != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('fiveYearAvgDividendYield')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Yield Méd. 5 Anos</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.fiveYearAvgDividendYield.toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {metrics?.exDividendDate != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('exDividendDate')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Data Ex-Dividendo</span>
                      </div>
                      <div className="text-xs font-black text-slate-800 mt-1.5 truncate">
                        {metrics.exDividendDate}
                      </div>
                    </div>
                  )}

                  {metrics?.earningsDate != null && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetricId('earningsDate')}
                      className="bg-slate-50/90 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-3 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700">Próx. Resultados</span>
                      </div>
                      <div className="text-xs font-black text-sky-700 mt-1.5 truncate">
                        {metrics.earningsDate}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Informativo / Bottom Sheet ao Clicar numa Métrica */}
        <AnimatePresence>
          {selectedMetricId && METRIC_EXPLANATIONS[selectedMetricId] && (
            <div
              className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setSelectedMetricId(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabeçalho Fixo */}
                <div className="p-5 sm:p-6 pb-3.5 border-b border-slate-100 flex items-start justify-between shrink-0 bg-white">
                  <div className="flex flex-col gap-1 pr-3">
                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-wider bg-sky-50 px-2.5 py-0.5 rounded-full w-fit">
                      {METRIC_EXPLANATIONS[selectedMetricId].category}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 leading-snug">
                      {METRIC_EXPLANATIONS[selectedMetricId].title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMetricId(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors shrink-0 -mr-1 -mt-1"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Conteúdo com Scroll Independente */}
                <div className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-3.5 text-sm overscroll-contain">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                      O que significa
                    </span>
                    <p className="text-slate-700 font-medium leading-relaxed">
                      {METRIC_EXPLANATIONS[selectedMetricId].definition}
                    </p>
                  </div>

                  {customComparison ? (
                    <>
                      <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5 shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                            No teu caso ({position.ticker})
                          </span>
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                            Dados Reais
                          </span>
                        </div>
                        <p className="text-emerald-950 font-semibold leading-relaxed">
                          {customComparison.userContext}
                        </p>
                      </div>

                      <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider">
                            Cenário Oposto (Para Comparar)
                          </span>
                          <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Contraste
                          </span>
                        </div>
                        <p className="text-amber-950 font-medium leading-relaxed">
                          {customComparison.oppositeExample}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5">
                      <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider block mb-1">
                        Exemplo Prático Teórico
                      </span>
                      <p className="text-amber-950 font-medium leading-relaxed">
                        {METRIC_EXPLANATIONS[selectedMetricId].example}
                      </p>
                    </div>
                  )}

                  <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-3.5">
                    <span className="text-[11px] font-black text-sky-700 uppercase tracking-wider block mb-1">
                      Como Interpretar
                    </span>
                    <p className="text-sky-950 font-medium leading-relaxed">
                      {METRIC_EXPLANATIONS[selectedMetricId].interpretation}
                    </p>
                  </div>
                </div>

                {/* Rodapé Fixo com Ação */}
                <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 shrink-0 bg-slate-50/60">
                  <button
                    type="button"
                    onClick={() => setSelectedMetricId(null)}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm transition-colors"
                  >
                    Entendido
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
