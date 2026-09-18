import React, { useRef, useEffect, useState } from 'react';
import { formatCurrencyEur } from '../../services/homeChartService';

interface GoalChartPoint {
  year: number;
  portfolioValue: number;
  goalValue: number;
  label: string;
  rawDate?: Date;
  isPast?: boolean;
}

interface GoalPerformanceChartProps {
  points: GoalChartPoint[];
  timeframe: 'month' | 'year';
  targetGoal: number;
  totalValue: number;
  currentYearGoal: number;
  monthlyContribution: number;
}

export const GoalPerformanceChart: React.FC<GoalPerformanceChartProps> = ({ 
  points, 
  timeframe,
  targetGoal,
  totalValue,
  currentYearGoal,
  monthlyContribution
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set chart height to exactly 280px as requested
  const [dimensions, setDimensions] = useState({ width: 340, height: 280 });

  // Hover state for interactive tracking
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  // Resize observer to ensure 100% responsive fluid width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: Math.max(280, entry.contentRect.width),
          height: 280 // Fixed 280px height
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Geometry: PADDING_LEFT & PADDING_RIGHT are 0 to allow perfect edge-to-edge look!
  const PADDING_TOP = 10;
  const PADDING_BOTTOM = 28;
  const PADDING_LEFT = 0;
  const PADDING_RIGHT = 0;

  const drawWidth = dimensions.width - PADDING_LEFT - PADDING_RIGHT;
  const drawHeight = dimensions.height - PADDING_TOP - PADDING_BOTTOM;

  // Projection coordinate helpers based on index in points array for perfect even spacing
  const mapX = (index: number) => {
    return PADDING_LEFT + (index / (points.length - 1 || 1)) * drawWidth;
  };

  // Dynamic Y-axis: Starts from 0 and scales dynamically based on the max value in points
  const minVal = 0;
  const maxVal = (() => {
    const maxValInPoints = Math.max(...points.map(p => Math.max(p.portfolioValue, p.goalValue)));
    return maxValInPoints > 0 ? maxValInPoints * 1.12 : 1000;
  })();

  const mapY = (val: number) => {
    return PADDING_TOP + drawHeight - ((val - minVal) / (maxVal - minVal || 1)) * drawHeight;
  };

  // Render Canvas Chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Draw month labels along the bottom horizontal axis (prevent overlapping by only drawing on month transitions)
    let lastLabelDrawn = '';
    points.forEach((p, idx) => {
      const x = mapX(idx);
      if (x >= PADDING_LEFT && x <= dimensions.width - PADDING_RIGHT) {
        const monthShort = p.label.split(' ')[0]; // e.g. "Jan", "Fev"
        if (monthShort !== lastLabelDrawn) {
          ctx.fillStyle = '#94a3b8'; // slate-400
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(monthShort, x, dimensions.height - 8);
          lastLabelDrawn = monthShort;
        }
      }
    });

    // 4. Draw Goal Projection Line (Light Blue / Solid)
    ctx.beginPath();
    let hasStartedGoal = false;
    points.forEach((p, idx) => {
      const x = mapX(idx);
      const y = mapY(p.goalValue);
      if (!hasStartedGoal) {
        ctx.moveTo(x, y);
        hasStartedGoal = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = '#93c5fd'; // blue-300
    ctx.lineWidth = 1.5; // thinner line
    ctx.stroke();

    // 5. Draw Portfolio Line (Solid Royal Blue + Gradient fill) ONLY from 0 up to current month (Atual)
    const todayIdx = points.findIndex(p => p.label.includes('Atual'));
    const activePoints = todayIdx !== -1 ? points.slice(0, todayIdx + 1) : points;

    ctx.beginPath();
    let hasStartedPort = false;
    activePoints.forEach((p, idx) => {
      const x = mapX(idx);
      const y = mapY(p.portfolioValue);
      if (!hasStartedPort) {
        ctx.moveTo(x, y);
        hasStartedPort = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = '#2563eb'; // blue-600
    ctx.lineWidth = 1.5; // thinner line as requested
    ctx.stroke();

    // Fill under Portfolio
    if (activePoints.length > 1) {
      const fillPath = new Path2D();
      fillPath.moveTo(mapX(0), dimensions.height - PADDING_BOTTOM);
      
      activePoints.forEach((p, idx) => {
        fillPath.lineTo(mapX(idx), mapY(p.portfolioValue));
      });
      
      fillPath.lineTo(mapX(activePoints.length - 1), dimensions.height - PADDING_BOTTOM);
      fillPath.closePath();

      const gradient = ctx.createLinearGradient(0, PADDING_TOP, 0, dimensions.height - PADDING_BOTTOM);
      gradient.addColorStop(0, 'rgba(37, 99, 235, 0.12)'); // beautiful soft transparent blue
      gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');
      ctx.fillStyle = gradient;
      ctx.fill(fillPath);
    }

    // 6. Draw Active Pointer Hover Indicator
    if (hoveredIndex !== null && points[hoveredIndex]) {
      const hp = points[hoveredIndex];
      const hx = mapX(hoveredIndex);
      const isPastOrToday = todayIdx === -1 || hoveredIndex <= todayIdx;
      
      // Vertical indicator line
      ctx.beginPath();
      ctx.strokeStyle = '#cbd5e1'; // slate-300
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(hx, PADDING_TOP);
      ctx.lineTo(hx, dimensions.height - PADDING_BOTTOM);
      ctx.stroke();
      ctx.setLineDash([]);

      // Portfolio marker node - only show if it is past or today
      if (isPastOrToday) {
        ctx.beginPath();
        ctx.arc(hx, mapY(hp.portfolioValue), 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#2563eb';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }

      // Goal marker node
      ctx.beginPath();
      ctx.arc(hx, mapY(hp.goalValue), 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#93c5fd';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

  }, [points, minVal, maxVal, targetGoal, hoveredIndex, dimensions]);

  // Pointer position calculation
  const handlePointerMovePosition = (clientX: number) => {
    const container = containerRef.current;
    if (!container || points.length === 0) return;

    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? x / rect.width : 0;
    const index = Math.round(ratio * (points.length - 1));
    const clampedIndex = Math.max(0, Math.min(index, points.length - 1));

    if (hoveredIndex !== clampedIndex) {
      setHoveredIndex(clampedIndex);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMovePosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    handlePointerMovePosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setHoveredIndex(null);
    }
  };

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="w-full flex flex-col select-none">
      {/* Static Sub-Legend Bar */}
      <div className="flex items-center justify-between px-1 mb-4 min-h-[36px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Portfólio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-blue-300" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Objetivo</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 text-right">
          <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Portfolio: <span className="text-slate-800 font-extrabold normal-case ml-1">{formatCurrencyEur(totalValue)}</span>
          </div>
          <div className={`text-[11px] font-extrabold flex items-center gap-1 ${
            (totalValue - currentYearGoal) >= 0 ? 'text-emerald-600' : 'text-rose-500'
          }`}>
            <span>Objetivo:</span>
            <span>{(totalValue - currentYearGoal) >= 0 ? '+' : ''}{formatCurrencyEur(totalValue - currentYearGoal)}</span>
          </div>
        </div>
      </div>

      {/* Main 280px Heightened Canvas View Area */}
      <div 
        ref={containerRef} 
        className="w-full h-[280px] bg-white relative cursor-crosshair overflow-hidden touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Dynamic vertical-line anchored info panel - No background balloon, tiny size, discreet gray text */}
        {hoveredPoint && (
          <div 
            className="absolute pointer-events-none text-[8px] text-slate-400 font-normal select-none flex flex-col gap-0.5 transition-all duration-75 bg-transparent p-0 border-0 shadow-none leading-tight"
            style={{ 
              left: `${mapX(hoveredIndex)}px`, 
              top: '8px',
              transform: hoveredIndex > points.length / 2 ? 'translateX(-105%)' : 'translateX(6px)',
              whiteSpace: 'nowrap'
            }}
          >
            <table className="border-collapse text-left text-[8px] text-slate-400 font-normal">
              <thead>
                <tr className="text-[8px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">
                  <th className="pr-3 pb-0.5 font-bold">Portfolio</th>
                  <th className="pr-3 pb-0.5 font-bold">Objetivo</th>
                  <th className="pb-0.5 text-right font-bold">Diferença</th>
                </tr>
              </thead>
              <tbody className="text-[8px] text-slate-400">
                <tr>
                  <td className="pr-3 pt-0.5">Aporte: {formatCurrencyEur(hoveredPoint.monthDeposit)}</td>
                  <td className="pr-3 pt-0.5">Aporte: {formatCurrencyEur(monthlyContribution)}</td>
                  <td className="pt-0.5 text-right">
                    {(hoveredPoint.monthDeposit - monthlyContribution) >= 0 ? '+' : ''}
                    {formatCurrencyEur(hoveredPoint.monthDeposit - monthlyContribution)}
                  </td>
                </tr>
                <tr>
                  <td className="pr-3 pt-0.2">Total: {formatCurrencyEur(hoveredPoint.portfolioValue)}</td>
                  <td className="pr-3 pt-0.2">Total: {formatCurrencyEur(hoveredPoint.goalValue)}</td>
                  <td className="pt-0.2 text-right">
                    {(hoveredPoint.portfolioValue - hoveredPoint.goalValue) >= 0 ? '+' : ''}
                    {formatCurrencyEur(hoveredPoint.portfolioValue - hoveredPoint.goalValue)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
