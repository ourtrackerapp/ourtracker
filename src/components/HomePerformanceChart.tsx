import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { HomeChartPoint, PeriodOption } from '../services/homeChartService';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  points: HomeChartPoint[];
  period: PeriodOption;
  showSp500: boolean;
  onToggleSp500: () => void;
  onCloseBenchmarks?: () => void;
  onPointHover: (point: HomeChartPoint | null) => void;
}

const COLOR_PORTFOLIO = '#2563EB'; // Blue
const COLOR_SP500 = '#EAB308'; // Yellow

export const HomePerformanceChart: React.FC<Props> = ({
  points: rawPoints,
  period,
  showSp500,
  onToggleSp500,
  onCloseBenchmarks,
  onPointHover,
}) => {
  const points = useMemo(() => {
    return [...rawPoints].sort((a, b) => a.timestamp - b.timestamp);
  }, [rawPoints]);

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

    const getX = (index: number) => {
      if (points.length <= 1) return width / 2;
      if (period === '1D') {
        const pt = points[index];
        if (pt && pt.timestamp) {
          const d = new Date(pt.timestamp);
          const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
          const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
          const ratio = Math.max(0, Math.min(1, (pt.timestamp - startOfDay) / (endOfDay - startOfDay)));
          return ratio * width;
        }
      }
      return (index / (points.length - 1)) * width;
    };

    // Draw Baseline (0% return)
    const zeroY = getY(0);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.strokeStyle = '#CBD5E1'; // Slate 300
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); // Dashed line
    ctx.stroke();
    ctx.restore();

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

        const x = getX(i);
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
      ctx.globalAlpha = 1.0;
      drawSeries((p) => p.sp500?.returnPercent, COLOR_SP500, 1.8);
      ctx.restore();
    }

    // 4. Draw Portfolio (Blue) - always main line, thick & opaque
    ctx.save();
    ctx.globalAlpha = 1.0;
    drawSeries((p) => p.portfolio?.returnPercent, COLOR_PORTFOLIO, 2.0);
    ctx.restore();

    // 5. Draw Crosshair / Active Point during drag
    const activeIdx = activeIndexRef.current;
    if (activeIdx !== null && activeIdx >= 0 && activeIdx < points.length) {
      const pt = points[activeIdx];
      const x = getX(activeIdx);

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
  }, [points, period, showSp500]);

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
    let clampedIndex = 0;
    if (period === '1D' && points.length > 0) {
      const firstPt = points[0];
      const d = new Date(firstPt.timestamp || Date.now());
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
      const targetTime = startOfDay + ratio * (endOfDay - startOfDay);

      let minDiff = Infinity;
      points.forEach((p, idx) => {
        const diff = Math.abs(p.timestamp - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          clampedIndex = idx;
        }
      });
    } else {
      const index = Math.round(ratio * (points.length - 1));
      clampedIndex = Math.max(0, Math.min(index, points.length - 1));
    }

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
    <div className="w-full flex flex-col shrink-0">
      {/* 1. Canvas Interactive Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[200px] shrink-0 touch-none select-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* 2. Bottom Right Benchmark Bar */}
      {!showSp500 && (
        <div className="w-full flex justify-end items-center px-4 pt-0 pb-1">
          <button
            type="button"
            onClick={onToggleSp500}
            className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 focus:outline-none"
          >
            <span>+</span>
            <span>Benchmark</span>
          </button>
        </div>
      )}
    </div>
  );
};
