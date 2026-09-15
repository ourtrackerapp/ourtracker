import React, { useRef, useEffect, useState, useCallback } from 'react';
import { HomeChartPoint, PeriodOption } from '../services/homeChartService';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  points: HomeChartPoint[];
  period: PeriodOption;
  showSp500: boolean;
  showNasdaq: boolean;
  showRussell: boolean;
  onToggleSp500: () => void;
  onToggleNasdaq: () => void;
  onToggleRussell: () => void;
  onCloseBenchmarks?: () => void;
  onPointHover: (point: HomeChartPoint | null) => void;
}

const COLOR_PORTFOLIO = '#2563EB'; // Blue
const COLOR_SP500 = '#EAB308'; // Yellow
const COLOR_NASDAQ = '#16A34A'; // Green
const COLOR_RUSSELL = '#9333EA'; // Purple 600

export const HomePerformanceChart: React.FC<Props> = ({
  points,
  period,
  showSp500,
  showNasdaq,
  showRussell,
  onToggleSp500,
  onToggleNasdaq,
  onToggleRussell,
  onCloseBenchmarks,
  onPointHover,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isBenchmarkExpanded, setIsBenchmarkExpanded] = useState<boolean>(false);
  const activeIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  // Redraw canvas smoothly
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Padding top & bottom for high/low points
    const paddingTop = 12;
    const paddingBottom = 4;
    const chartHeight = height - paddingTop - paddingBottom;

    // Collect min & max return percentages across visible series
    let minPct = Infinity;
    let maxPct = -Infinity;

    points.forEach((p) => {
      if (p.portfolio) {
        minPct = Math.min(minPct, p.portfolio.returnPercent);
        maxPct = Math.max(maxPct, p.portfolio.returnPercent);
      }
      if (showSp500 && p.sp500) {
        minPct = Math.min(minPct, p.sp500.returnPercent);
        maxPct = Math.max(maxPct, p.sp500.returnPercent);
      }
      if (showNasdaq && p.nasdaq) {
        minPct = Math.min(minPct, p.nasdaq.returnPercent);
        maxPct = Math.max(maxPct, p.nasdaq.returnPercent);
      }
      if (showRussell && p.russell) {
        minPct = Math.min(minPct, p.russell.returnPercent);
        maxPct = Math.max(maxPct, p.russell.returnPercent);
      }
    });

    if (minPct === Infinity || maxPct === -Infinity) {
      minPct = -1;
      maxPct = 1;
    }

    if (maxPct === minPct) {
      maxPct += 1;
      minPct -= 1;
    }

    // Add 5% margin to top/bottom
    const pctRange = maxPct - minPct;
    minPct -= pctRange * 0.05;
    maxPct += pctRange * 0.05;

    const getY = (returnPercent: number) => {
      const norm = (returnPercent - minPct) / (maxPct - minPct);
      return height - paddingBottom - norm * chartHeight;
    };

    const getX = (index: number, timestamp: number) => {
      if (points.length <= 1) return width / 2;
      
      if (period === '1D') {
        const date = new Date(timestamp);
        const startOfDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0);
        const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
        return ((timestamp - startOfDay) / (endOfDay - startOfDay)) * width;
      }
      
      return (index / (points.length - 1)) * width;
    };

    // Draw helper line for a series
    const drawSeries = (
      getVal: (pt: HomeChartPoint) => number | undefined,
      color: string,
      lineWidth: number
    ) => {
      if (points.length === 0) return;

      let lastX: number | null = null;
      let lastY: number | null = null;

      points.forEach((pt, i) => {
        const val = getVal(pt);
        if (val === undefined) return;

        // The line stops at current time
        if (period === '1D' && pt.timestamp > Date.now()) {
          return;
        }

        const x = getX(i, pt.timestamp);
        const y = getY(val);

        if (lastX === null || lastY === null) {
          lastX = x;
          lastY = y;
          return;
        }

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);

        // ALWAYS SOLID LINE as requested
        ctx.setLineDash([]);

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        lastX = x;
        lastY = y;
      });
    };

    // 1. Draw S&P 500 (Yellow) if active
    if (showSp500) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawSeries((p) => p.sp500?.returnPercent, COLOR_SP500, 1);
      ctx.restore();
    }

    // 2. Draw Nasdaq (Green) if active
    if (showNasdaq) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawSeries((p) => p.nasdaq?.returnPercent, COLOR_NASDAQ, 1);
      ctx.restore();
    }

    // 3. Draw Russell (Purple) if active
    if (showRussell) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawSeries((p) => p.russell?.returnPercent, COLOR_RUSSELL, 1);
      ctx.restore();
    }

    // 4. Draw Portfolio (Blue) - always main line, thick & opaque
    ctx.save();
    ctx.globalAlpha = 1.0;
    drawSeries((p) => p.portfolio?.returnPercent, COLOR_PORTFOLIO, 2.25);
    ctx.restore();

    // 5. Draw Crosshair / Active Point during drag
    const activeIdx = activeIndexRef.current;
    if (activeIdx !== null && activeIdx >= 0 && activeIdx < points.length) {
      const pt = points[activeIdx];
      const x = getX(activeIdx, pt.timestamp);

      // Draw thin vertical dashed line (full height)
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(x, 0); // Start at absolute top
      ctx.lineTo(x, height); // End at absolute bottom
      ctx.strokeStyle = '#94A3B8'; // Slate 400
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Draw date text statically at top left
      ctx.save();
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.fillStyle = '#64748B'; // Slate 500
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(pt.formattedDate, 5, 5); // Static position at top left
      ctx.restore();
    }

    ctx.restore();
  }, [points, showSp500, showNasdaq]);

  // Handle Resize & Points change
  useEffect(() => {
    renderCanvas();

    const handleResize = () => {
      renderCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [renderCanvas]);

  // Touch & Pointer interaction
  const updatePointerPosition = (clientX: number) => {
    const container = containerRef.current;
    if (!container || points.length === 0) return;

    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? x / rect.width : 0;
    const index = Math.round(ratio * (points.length - 1));
    const clampedIndex = Math.max(0, Math.min(index, points.length - 1));

    if (activeIndexRef.current !== clampedIndex) {
      activeIndexRef.current = clampedIndex;
      const hoveredPoint = points[clampedIndex];
      onPointHover(hoveredPoint);

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        renderCanvas();
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updatePointerPosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updatePointerPosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      activeIndexRef.current = null;
      onPointHover(null);
      renderCanvas();
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* 1. Canvas Interactive Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[150px] touch-none select-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* 2. Bottom Right Benchmark Bar */}
      <div className="w-full flex justify-end items-center px-4 pt-0 pb-1">
        <AnimatePresence mode="wait">
          {!isBenchmarkExpanded ? (
            <motion.button
              key="btn"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              type="button"
              onClick={() => setIsBenchmarkExpanded(true)}
              className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 focus:outline-none"
            >
              <span>+</span>
              <span>Benchmark</span>
            </motion.button>
          ) : (
            <motion.div
              key="menu"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              className="w-full flex items-center justify-between"
            >
              {/* Expanded Benchmark Selectors on Left */}
              <div className="flex items-center gap-3">
                {/* SP500 Button */}
                <button
                  type="button"
                  onClick={onToggleSp500}
                  className={`text-sm font-semibold transition-colors focus:outline-none px-2 py-1 rounded-full ${
                    showSp500 ? 'bg-yellow-50 text-yellow-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  SP500
                </button>

                {/* Nasdaq Button */}
                <button
                  type="button"
                  onClick={onToggleNasdaq}
                  className={`text-sm font-semibold transition-colors focus:outline-none px-2 py-1 rounded-full ${
                    showNasdaq ? 'bg-green-50 text-green-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  NASDAQ
                </button>

                {/* Russell Button */}
                <button
                  type="button"
                  onClick={onToggleRussell}
                  className={`text-sm font-semibold transition-colors focus:outline-none px-2 py-1 rounded-full ${
                    showRussell ? 'bg-purple-50 text-purple-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  RUSSELL
                </button>
              </div>

              {/* Plain Close Symbol × on Far Right */}
              <button
                type="button"
                onClick={() => {
                  onCloseBenchmarks?.();
                  setIsBenchmarkExpanded(false);
                }}
                className="text-base font-normal text-slate-500 hover:text-slate-800 focus:outline-none px-1"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
