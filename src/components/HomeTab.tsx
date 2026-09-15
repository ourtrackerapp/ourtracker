import React, { useState, useEffect, useMemo } from 'react';
import { HoldingDoc, PortfolioPosition } from '../types';
import {
  PeriodOption,
  HomeChartData,
  HomeChartPoint,
  fetchHomeChartData,
  formatCurrencyEur,
  formatPercentString,
  formatEuroChange,
} from '../services/homeChartService';
import { HomePerformanceChart } from './HomePerformanceChart';
import { fetchPortfolioMeta } from '../services/portfolioService';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  holdings: HoldingDoc[];
  totalValue: number;
  positions: PortfolioPosition[];
}

const PERIODS: PeriodOption[] = ['1D', '1S', '1M', '3M', '6M', '1A', 'Tudo'];

export const HomeTab: React.FC<Props> = ({ holdings, totalValue, positions }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('1M');
  const [showSp500, setShowSp500] = useState<boolean>(false);
  const [showNasdaq, setShowNasdaq] = useState<boolean>(false);
  const [showRussell, setShowRussell] = useState<boolean>(false);

  const [chartData, setChartData] = useState<HomeChartData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<HomeChartPoint | null>(null);

  // Fetch chart data on period, holdings, or benchmark toggles
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);
      const meta = await fetchPortfolioMeta('main');
      const deposits = Array.isArray(meta?.deposits) ? meta.deposits : [];
      const data = await fetchHomeChartData(
        holdings,
        deposits,
        selectedPeriod,
        showSp500,
        showNasdaq,
        showRussell
      );
      if (!isCancelled) {
        setChartData(data);
        setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [holdings, selectedPeriod, showSp500, showNasdaq, showRussell]);

  // Point to display in top header (hovered point during drag or latest point)
  const activePoint = hoveredPoint || chartData?.latest;

  const isAnyBenchmarkActive = showSp500 || showNasdaq || showRussell;

  // Movers & Losers Calculation: Classified by 24h change (changePercent) with no overlap between tables
  const { topMovers, topLosers } = useMemo(() => {
    // Filter out error positions and those with zero shares
    const validPositions = positions.filter(p => !p.isError && p.shares > 0);
    
    // Sort by 24h changePercent descending
    const sorted = [...validPositions].sort((a, b) => {
      const chgA = a.changePercent !== undefined && !isNaN(a.changePercent) ? a.changePercent : -999999;
      const chgB = b.changePercent !== undefined && !isNaN(b.changePercent) ? b.changePercent : -999999;
      return chgB - chgA;
    });

    if (sorted.length === 0) {
      return { topMovers: [], topLosers: [] };
    }

    // Determine safe split so no stock ever appears in both tables
    const half = Math.ceil(sorted.length / 2);
    const maxMovers = Math.min(5, half);
    const movers = sorted.slice(0, maxMovers);
    const moverIds = new Set(movers.map(m => m.id));

    // Remaining positions for losers
    const remaining = sorted.filter(p => !moverIds.has(p.id));
    const losers = remaining.slice(-5).reverse();
    
    return {
      topMovers: movers,
      topLosers: losers,
    };
  }, [positions]);

  // Helper for text color based on return percentage
  const getReturnColorClass = (val: number | undefined) => {
    if (val === undefined || val === null || isNaN(val)) return 'text-slate-400';
    if (val > 0) return 'text-emerald-600';
    if (val < 0) return 'text-rose-600';
    return 'text-slate-500';
  };

  return (
    <div className="w-full h-full flex flex-col justify-start bg-white text-slate-900 px-4 pt-2 pb-2 select-none max-w-md mx-auto overflow-y-auto">
      {/* 1. TOP HEADER */}
      <div className="w-full flex flex-col justify-start min-h-[50px]">
        {!isAnyBenchmarkActive ? (
          /* STANDARD VIEW: NO BENCHMARK ACTIVE */
          <div className="w-full flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block flex-shrink-0" />
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {activePoint
                  ? formatCurrencyEur(activePoint.portfolio.capitalValue)
                  : formatCurrencyEur(totalValue)}
              </span>
            </div>

            <div className="flex flex-col items-end text-right">
              <span
                className={`text-lg font-semibold tracking-tight ${getReturnColorClass(
                  activePoint?.portfolio.returnPercent
                )}`}
              >
                {activePoint
                  ? formatPercentString(activePoint.portfolio.returnPercent)
                  : '0,00%'}
              </span>
              <span
                className={`text-sm font-medium ${getReturnColorClass(
                  activePoint?.portfolio.euroChange
                )}`}
              >
                {activePoint
                  ? formatEuroChange(activePoint.portfolio.euroChange)
                  : '€0'}
              </span>
            </div>
          </div>
        ) : (
          /* BENCHMARK ACTIVE VIEW: Ultra-compact flex layout to fit on one line */
          <div className="w-full flex flex-wrap gap-1 pt-0.5 pb-1">
            {/* Portfolio Chip */}
            <div className="flex items-center gap-1.5 bg-blue-50/80 px-2 py-0.5 rounded-full border border-blue-100 justify-between">
              <div className="flex items-center gap-1 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                <span className="font-bold text-blue-700 text-[9px] uppercase tracking-wider">Port</span>
              </div>
              <div className="flex items-center gap-1.5 text-right ml-1">
                <span className="font-bold text-slate-900 text-[10px]">
                  {activePoint
                    ? formatCurrencyEur(activePoint.portfolio.capitalValue)
                    : formatCurrencyEur(totalValue)}
                </span>
                <span
                  className={`font-bold text-[9px] ${getReturnColorClass(
                    activePoint?.portfolio.returnPercent
                  )}`}
                >
                  {activePoint
                    ? formatPercentString(activePoint.portfolio.returnPercent)
                    : '0,00%'}
                </span>
              </div>
            </div>

            {/* SP500 Chip */}
            {showSp500 && (
              <div className="flex items-center gap-1.5 bg-yellow-50/80 px-2 py-0.5 rounded-full border border-yellow-100 justify-between">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-600 flex-shrink-0" />
                  <span className="font-bold text-yellow-700 text-[9px] uppercase tracking-wider">SP5</span>
                </div>
                <div className="flex items-center gap-1.5 text-right ml-1">
                  <span className="font-bold text-slate-900 text-[10px]">
                    {activePoint?.sp500
                      ? formatCurrencyEur(activePoint.sp500.capitalValue)
                      : '€0'}
                  </span>
                  <span
                    className={`font-bold text-[9px] ${getReturnColorClass(
                      activePoint?.sp500?.returnPercent
                    )}`}
                  >
                    {activePoint?.sp500
                      ? formatPercentString(activePoint.sp500.returnPercent)
                      : '0%'}
                  </span>
                </div>
              </div>
            )}

            {/* NASDAQ Chip */}
            {showNasdaq && (
              <div className="flex items-center gap-1.5 bg-green-50/80 px-2 py-0.5 rounded-full border border-green-100 justify-between">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 flex-shrink-0" />
                  <span className="font-bold text-green-700 text-[9px] uppercase tracking-wider">NDQ</span>
                </div>
                <div className="flex items-center gap-1.5 text-right ml-1">
                  <span className="font-bold text-slate-900 text-[10px]">
                    {activePoint?.nasdaq
                      ? formatCurrencyEur(activePoint.nasdaq.capitalValue)
                      : '€0'}
                  </span>
                  <span
                    className={`font-bold text-[9px] ${getReturnColorClass(
                      activePoint?.nasdaq?.returnPercent
                    )}`}
                  >
                    {activePoint?.nasdaq
                      ? formatPercentString(activePoint.nasdaq.returnPercent)
                      : '0%'}
                  </span>
                </div>
              </div>
            )}

            {/* RUSSELL Chip */}
            {showRussell && (
              <div className="flex items-center gap-1.5 bg-purple-50/80 px-2 py-0.5 rounded-full border border-purple-100 justify-between">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0" />
                  <span className="font-bold text-purple-700 text-[9px] uppercase tracking-wider">RUSS</span>
                </div>
                <div className="flex items-center gap-1.5 text-right ml-1">
                  <span className="font-bold text-slate-900 text-[10px]">
                    {activePoint?.russell
                      ? formatCurrencyEur(activePoint.russell.capitalValue)
                      : '€0'}
                  </span>
                  <span
                    className={`font-bold text-[9px] ${getReturnColorClass(
                      activePoint?.russell?.returnPercent
                    )}`}
                  >
                    {activePoint?.russell
                      ? formatPercentString(activePoint.russell.returnPercent)
                      : '0%'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. CHART AREA */}
      <div className="w-full flex flex-col mt-1 mb-0">
        {isLoading && !chartData ? (
          <div className="w-full h-[150px] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : chartData && chartData.points.length > 0 ? (
          <HomePerformanceChart
            points={chartData.points}
            period={selectedPeriod}
            showSp500={showSp500}
            showNasdaq={showNasdaq}
            showRussell={showRussell}
            onToggleSp500={() => setShowSp500((prev) => !prev)}
            onToggleNasdaq={() => setShowNasdaq((prev) => !prev)}
            onToggleRussell={() => setShowRussell((prev) => !prev)}
            onCloseBenchmarks={() => {
              setShowSp500(false);
              setShowNasdaq(false);
              setShowRussell(false);
            }}
            onPointHover={(pt) => setHoveredPoint(pt)}
          />
        ) : (
          <div className="w-full h-[150px] flex items-center justify-center text-sm text-slate-400">
            Sem dados disponíveis para este período
          </div>
        )}
      </div>

      {/* 3. PERIOD SELECTOR */}
      <div className="w-full flex items-center justify-between gap-1 pt-0.5 pb-3">
        {PERIODS.map((period) => {
          const isSelected = selectedPeriod === period;
          return (
            <button
              key={period}
              type="button"
              onClick={() => {
                setSelectedPeriod(period);
                setHoveredPoint(null);
              }}
              className={`flex-1 py-1 px-1.5 text-[11px] font-bold rounded-full transition-all cursor-pointer text-center focus:outline-none ${
                isSelected
                  ? 'bg-sky-100 text-sky-700'
                  : 'text-slate-400 hover:text-slate-700 active:scale-95 bg-transparent'
              }`}
            >
              {period}
            </button>
          );
        })}
      </div>

      {/* 4. MOVERS & LOSERS SECTION */}
      <div className="w-full mt-2 border-t border-slate-100 pt-4">
        <div className="grid grid-cols-2 gap-6">
          {/* Top Movers Column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Movers</h3>
            </div>
            
            <div className="flex flex-col gap-2.5">
              {topMovers.length > 0 ? topMovers.map((p) => (
                <div key={p.id} className="flex items-center justify-between group">
                  <div className="flex flex-col min-w-0 pr-1">
                    <span className="text-[11px] font-bold text-slate-800 truncate">{p.ticker}</span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[65px]">{p.name}</span>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 text-right">
                    <span className={`text-[11px] font-bold ${getReturnColorClass(p.changePercent)}`}>
                      {formatPercentString(p.changePercent || 0)}
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      Tot: {formatPercentString(p.totalReturnPercent || 0)}
                    </span>
                  </div>
                </div>
              )) : (
                <span className="text-[10px] text-slate-300 italic pt-1">Sem posições</span>
              )}
            </div>
          </div>

          {/* Top Losers Column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
              <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Losers</h3>
            </div>
            
            <div className="flex flex-col gap-2.5">
              {topLosers.length > 0 ? topLosers.map((p) => (
                <div key={p.id} className="flex items-center justify-between group">
                  <div className="flex flex-col min-w-0 pr-1">
                    <span className="text-[11px] font-bold text-slate-800 truncate">{p.ticker}</span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[65px]">{p.name}</span>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 text-right">
                    <span className={`text-[11px] font-bold ${getReturnColorClass(p.changePercent)}`}>
                      {formatPercentString(p.changePercent || 0)}
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      Tot: {formatPercentString(p.totalReturnPercent || 0)}
                    </span>
                  </div>
                </div>
              )) : (
                <span className="text-[10px] text-slate-300 italic pt-1">Sem posições</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
