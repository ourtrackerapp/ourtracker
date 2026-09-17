import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  X,
  DollarSign,
  Scale,
  Sparkles,
} from 'lucide-react';
import { PortfolioPosition, HoldingDoc, PurchaseRecord } from '../types';
import { getShortDescription } from '../utils/tickerHelper';

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
  pe?: number | null;
  pb?: number | null;
  ps?: number | null;
  eps?: number | null;
  epsEur?: number | null;
  beta?: number | null;
  targetPrice?: number | null;
  targetPriceEur?: number | null;
  recommendation?: string | null;
  dividendYield?: number | null;
  dividendRate?: number | null;
  dividendRateEur?: number | null;
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

    return () => {
      isMounted = false;
    };
  }, [isOpen, position?.ticker, selectedRange]);

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

  const rawPoints = chartData?.points || [];

  // Filter points based on zoom window
  const points = useMemo(() => {
    if (rawPoints.length === 0) return [];
    if (!zoomWindow) return rawPoints;
    const [start, end] = zoomWindow;
    return rawPoints.slice(Math.max(0, start), Math.min(rawPoints.length, end + 1));
  }, [rawPoints, zoomWindow]);

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

  // Calculate SVG curve coordinates, horizontal line, and purchase gradient area
  const {
    fullPathD,
    areaD,
    coordinates,
    horizontalLineY,
  } = useMemo(() => {
    if (points.length === 0) {
      return {
        fullPathD: '',
        areaD: '',
        coordinates: [],
        horizontalLineY: 130,
      };
    }

    const prices = points.map((p) => (isUsd ? (p.price ?? p.priceEur) : p.priceEur));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const paddingY = (max - min) * 0.12 || max * 0.05 || 1;
    const yMin = Math.max(0, min - paddingY);
    const yMax = max + paddingY;

    const w = svgDimensions.width || 360;
    const h = svgDimensions.height || 260;
    const marginX = 8;
    const usableWidth = w - marginX * 2;

    const coords = points.map((p, idx) => {
      const pVal = isUsd ? (p.price ?? p.priceEur) : p.priceEur;
      const x = marginX + (idx / Math.max(1, points.length - 1)) * usableWidth;
      const yRatio = (pVal - yMin) / (yMax - yMin || 1);
      const y = h - (yRatio * (h - 36) + 18);
      return { x, y, point: p, index: idx };
    });

    const refStartPrice = isUsd
      ? (chartData?.windowMetrics?.startPriceNative ?? points[0]?.price ?? points[0]?.priceEur)
      : (chartData?.windowMetrics?.startPriceEur ?? points[0]?.priceEur);
    const startYRatio = (refStartPrice - yMin) / (yMax - yMin || 1);
    const hLineY = h - (startYRatio * (h - 36) + 18);

    if (coords.length === 1) {
      return {
        fullPathD: `M 0,${coords[0].y} L ${w},${coords[0].y}`,
        areaD: `M 0,${coords[0].y} L ${w},${coords[0].y} L ${w},${h} L 0,${h} Z`,
        coordinates: coords,
        horizontalLineY: hLineY,
      };
    }

    // Base path (completely solid continuous Bezier curve)
    let fullD = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const c = coords[i];
      const n = coords[i + 1];
      const cpX = (c.x + n.x) / 2;
      fullD += ` C ${cpX.toFixed(1)},${c.y.toFixed(1)} ${cpX.toFixed(1)},${n.y.toFixed(1)} ${n.x.toFixed(1)},${n.y.toFixed(1)}`;
    }

    // Find coordinate corresponding to first purchase date
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

    // Gradient area starts STRICTLY from first purchase
    let areaPath = '';
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

    return {
      fullPathD: fullD,
      areaD: areaPath,
      coordinates: coords,
      horizontalLineY: hLineY,
    };
  }, [points, svgDimensions, earliestPurchaseTimestamp]);

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
    metrics?.pb != null ||
    metrics?.ps != null ||
    metrics?.epsEur != null ||
    metrics?.beta != null;
  const hasEstimates = metrics?.targetPriceEur != null || metrics?.recommendation != null;
  const hasDividends =
    metrics?.dividendYield != null ||
    metrics?.dividendRateEur != null ||
    metrics?.exDividendDate != null;
  const hasEarnings = metrics?.earningsDate != null;

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

              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`text-sm font-medium tabular-nums flex items-center gap-0.5 ${
                    isPositive ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  <span>{isPositive ? '↗' : '↘'}</span>
                  <span>{Math.abs(diffPercentFromStart).toFixed(2)}%</span>
                </span>

                <span
                  className={`text-sm font-medium tabular-nums ${
                    isPositive ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {isPositive ? '+' : '-'}{currencySymbol}
                  {Math.abs(diffFromStart).toLocaleString('pt-PT', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
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

                  {/* Solid Continuous Line */}
                  <path
                    d={fullPathD}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="1.2"
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
                        strokeWidth="0.9"
                        opacity="0.9"
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
                    className="absolute pointer-events-none transform -translate-x-1/2 top-0 text-[11px] font-semibold text-slate-500 bg-white/90 px-1.5 py-0.5 rounded shadow-xs backdrop-blur-xs z-10 flex items-center gap-1"
                    style={{
                      left: `${(activeCoord.x / (svgDimensions.width || 1)) * 100}%`,
                    }}
                  >
                    {new Date(activeCoord.point.timestamp).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: 'short',
                      year: selectedRange === '1y' || selectedRange === 'max' ? 'numeric' : undefined,
                      hour: selectedRange === '1d' || selectedRange === '1w' ? '2-digit' : undefined,
                      minute: selectedRange === '1d' || selectedRange === '1w' ? '2-digit' : undefined,
                    })}
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

            {hasValuation && (
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  <span>Indicadores Fundamentais</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {metrics?.pe != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>P/E (Preço/Lucro)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.pe.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.pb != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>P/B (Preço/Valor)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.pb.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.ps != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>P/S (Preço/Vendas)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.ps.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {(isUsd ? (metrics?.eps ?? metrics?.epsEur) : metrics?.epsEur) != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>EPS (Lucro/Ação)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {currencySymbol}{(isUsd ? (metrics?.eps ?? metrics?.epsEur) : metrics?.epsEur)?.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.beta != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>Beta (Volatilidade)</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {metrics.beta.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasEstimates && (
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Estimativas & Previsões</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(isUsd ? (metrics?.targetPrice ?? metrics?.targetPriceEur) : metrics?.targetPriceEur) != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>Preço-Alvo Médio</span>
                      </div>
                      <div className="text-base font-black text-sky-700 mt-1 tabular-nums">
                        {currencySymbol}{(isUsd ? (metrics?.targetPrice ?? metrics?.targetPriceEur) : metrics?.targetPriceEur)?.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.recommendation != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>Recomendação</span>
                      </div>
                      <div className="text-sm font-black text-emerald-700 mt-1.5 truncate">
                        {metrics.recommendation}
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
                <div className="grid grid-cols-2 gap-2">
                  {metrics?.dividendYield != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>Dividend Yield</span>
                      </div>
                      <div className="text-base font-black text-emerald-600 mt-1 tabular-nums">
                        {metrics.dividendYield.toFixed(2)}%
                      </div>
                    </div>
                  )}

                  {(isUsd ? (metrics?.dividendRate ?? metrics?.dividendRateEur) : metrics?.dividendRateEur) != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>Dividendo / Ação</span>
                      </div>
                      <div className="text-base font-black text-slate-900 mt-1 tabular-nums">
                        {currencySymbol}{(isUsd ? (metrics?.dividendRate ?? metrics?.dividendRateEur) : metrics?.dividendRateEur)?.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {metrics?.exDividendDate != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>Data Ex-Dividendo</span>
                      </div>
                      <div className="text-xs font-black text-slate-800 mt-1.5 truncate">
                        {metrics.exDividendDate}
                      </div>
                    </div>
                  )}

                  {metrics?.earningsDate != null && (
                    <div className="bg-slate-50/90 border border-slate-100 rounded-2xl p-3">
                      <div className="text-[11px] font-bold text-slate-400">
                        <span>Próx. Resultados</span>
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
      </motion.div>
    </AnimatePresence>
  );
};
