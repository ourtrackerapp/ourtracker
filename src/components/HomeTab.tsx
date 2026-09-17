import React, { useState, useEffect, useMemo } from 'react';
import { HoldingDoc, PortfolioPosition } from '../types';
import {
  PeriodOption,
  HomeChartData,
  HomeChartPoint,
  fetchHomeChartData,
  fetchAllTimeTwrBaseline,
  formatCurrencyEur,
  formatPercentString,
  formatEuroChange,
} from '../services/homeChartService';
import { HomePerformanceChart } from './HomePerformanceChart';
import { fetchPortfolioMeta, getLastSuccessfulQuoteUpdate } from '../services/portfolioService';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { RouletteText } from './RouletteText';

const getDisplayName = (ticker: string, originalName: string) => {
  const t = ticker.toUpperCase();
  if (t.includes('SXR8')) return 'SP500';
  if (t.includes('VVSM')) return 'Semicondutores';
  if (t.includes('SPCX') || t.includes('SPACE')) return 'SpaceX';
  if (t.includes('ORCL')) return 'Oracle';
  if (t.includes('AMZN')) return 'Amazon';
  return originalName;
};

const CompanyLogo: React.FC<{ ticker: string; name: string }> = ({ ticker, name }) => {
  const [imgError, setImgError] = useState(false);
  
  const isEtf = name.toLowerCase().includes('ishares') || name.toLowerCase().includes('vanguard') || name.toLowerCase().includes('etf') || ticker.includes('.');

  const getLogoUrl = () => {
    const t = ticker.toUpperCase();
    
    // Explicit manual overrides for high-res logos where Google Favicons fails/returns low-res
    if (t === 'AMZN') return 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg';
    if (t === 'ORCL') return 'https://upload.wikimedia.org/wikipedia/commons/5/50/Oracle_logo.svg';
    if (t === 'SKHY') return 'https://upload.wikimedia.org/wikipedia/commons/2/24/SK_Hynix.svg';
    
    // Guess domain for Google Favicons
    const n = name.toLowerCase();
    const exactMatches: Record<string, string> = {
      'AAPL': 'apple.com',
      'MSFT': 'microsoft.com',
      'GOOGL': 'google.com',
      'GOOG': 'google.com',
      'TSLA': 'tesla.com',
      'META': 'meta.com',
      'LEU': 'centrusenergy.com',
      'NVDA': 'nvidia.com',
      'AMD': 'amd.com',
      'INTC': 'intel.com',
      'NFLX': 'netflix.com',
      'DIS': 'thewaltdisneycompany.com',
      'SPOT': 'spotify.com',
      'UBER': 'uber.com',
      'ABNB': 'airbnb.com',
      'SPACE': 'spacex.com',
      'SPACEX': 'spacex.com',
      'SPCX': 'spacex.com',
      'SKM': 'sk.com'
    };
    
    const domain = exactMatches[t] || `${n.replace(/[^a-z0-9 ]/g, '').split(' ')[0]}.com`;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
  };

  if (isEtf || ticker.toUpperCase() === 'SXR8' || ticker.toUpperCase() === 'VVSM') {
    return (
      <div className="w-[43px] h-[43px] rounded-full border border-slate-200 flex flex-shrink-0 items-center justify-center bg-slate-50 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <span className="text-[12px] font-bold text-slate-700 tracking-tighter truncate px-0.5">
          {ticker.split('.')[0].toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className="w-[43px] h-[43px] rounded-full border border-slate-100 flex flex-shrink-0 items-center justify-center bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-0.5">
      {!imgError ? (
        <img 
          src={getLogoUrl()} 
          alt={ticker} 
          className="w-full h-full object-contain rounded-full bg-white"
          onError={() => setImgError(true)}
        />
      ) : (
        <img 
          src={`https://ui-avatars.com/api/?name=${ticker.charAt(0)}&background=f1f5f9&color=0f172a&font-size=0.4&rounded=true&bold=true`}
          alt={ticker} 
          className="w-full h-full object-contain rounded-full"
        />
      )}
    </div>
  );
};

interface Props {
  holdings: HoldingDoc[];
  totalValue: number;
  positions: PortfolioPosition[];
}

const PERIODS: PeriodOption[] = ['1D', '1S', '1M', '3M', 'YTD', 'Tudo'];

export const HomeTab: React.FC<Props> = ({ holdings, totalValue, positions }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('1D');
  const [showSp500, setShowSp500] = useState<boolean>(false);

  const [chartData, setChartData] = useState<HomeChartData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<HomeChartPoint | null>(null);
  const [totalDeposited, setTotalDeposited] = useState<number>(0);
  const [depositsList, setDepositsList] = useState<any[]>([]);
  const [allTimeTwrBaseline, setAllTimeTwrBaseline] = useState<{
    baseIndex: number;
    baseCapital: number;
    lastTimestamp: number;
  } | null>(null);
  const [isApiFresh, setIsApiFresh] = useState<boolean>(true);
  const [pulseSync, setPulseSync] = useState<boolean>(false);
  const [, setTick] = useState<number>(0);

  // Micro-pulso visual sempre que as cotações em tempo real são recebidas
  useEffect(() => {
    setPulseSync(true);
    const timer = setTimeout(() => setPulseSync(false), 900);
    return () => clearTimeout(timer);
  }, [totalValue, positions]);

  // Check API freshness every second
  useEffect(() => {
    const checkFreshness = () => {
      const lastUpdate = getLastSuccessfulQuoteUpdate();
      const now = Date.now();
      const hasValidQuotes = positions.length > 0 && positions.some(p => !p.isError && p.currentPrice > 0);
      if ((lastUpdate > 0 && now - lastUpdate < 10 * 60 * 1000) || hasValidQuotes) {
        setIsApiFresh(true);
      } else {
        setIsApiFresh(false);
      }
      setTick((t) => t + 1);
    };
    checkFreshness();
    const interval = setInterval(checkFreshness, 1000);
    return () => clearInterval(interval);
  }, [positions]);

  // Fetch deposits and keep updated in real time
  useEffect(() => {
    let active = true;
    async function loadDeposited() {
      try {
        const meta = await fetchPortfolioMeta('main');
        const deps = Array.isArray(meta?.deposits) ? meta.deposits : [];
        const sumDeps = deps.reduce((acc: number, d: any) => acc + (Number(d.amount) || 0), 0);
        if (active) {
          setDepositsList(deps);
          if (sumDeps > 0) {
            setTotalDeposited(sumDeps);
          } else {
            const sumInv = positions.reduce((acc, p) => acc + (p.totalInvested || 0), 0);
            setTotalDeposited(sumInv);
          }
        }
      } catch {
        if (active) {
          const sumInv = positions.reduce((acc, p) => acc + (p.totalInvested || 0), 0);
          setTotalDeposited(sumInv);
        }
      }
    }
    loadDeposited();
    const interval = setInterval(loadDeposited, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [positions]);

  // Maintain baseline all-time TWR data
  useEffect(() => {
    let active = true;
    async function updateTwrBaseline() {
      if (holdings.length === 0) return;
      const baseline = await fetchAllTimeTwrBaseline(holdings, depositsList);
      if (active && baseline) {
        setAllTimeTwrBaseline(baseline);
      }
    }
    updateTwrBaseline();
    const interval = setInterval(updateTwrBaseline, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [holdings, depositsList]);

  // Fetch chart data on period, holdings or benchmarks toggles
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
        showSp500
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
  }, [holdings, selectedPeriod, showSp500]);

  // Point to display in top header (hovered point during drag or latest point)
  const activePoint = hoveredPoint || chartData?.latest;

  // Performance Calculation: Single sorted list of all valid positions
  const sortedPositions = useMemo(() => {
    // Filter out error positions and those with zero shares
    const validPositions = positions.filter(p => !p.isError && p.shares > 0);
    
    // Sort by 24h changePercent descending (best performance to worst)
    return [...validPositions].sort((a, b) => {
      const chgA = a.changePercent !== undefined && !isNaN(a.changePercent) ? a.changePercent : -999999;
      const chgB = b.changePercent !== undefined && !isNaN(b.changePercent) ? b.changePercent : -999999;
      return chgB - chgA;
    });
  }, [positions]);

  // Unidade de exibição global: '%' (percentagem) ou 'eur' (€)
  const [displayUnit, setDisplayUnit] = useState<'percent' | 'eur'>('percent');

  const totalInvested = useMemo(() => {
    return positions.reduce((acc, p) => acc + (p.isError ? 0 : (p.totalInvested || 0)), 0);
  }, [positions]);

  const totalProfit = totalValue - totalInvested;
  
  // Ajuste deduzido exclusivamente ao valor total do património (-1.74€)
  const UNRECORDED_ADJUSTMENT = 1.74;
  const topCardProfit = totalProfit;
  
  // Total Equity = Stocks + Cash (where Cash = totalDeposited - totalInvested)
  const cash = Math.max(0, totalDeposited - totalInvested);
  const totalEquity = totalValue + cash;
  const displayTotalEquity = Math.max(0, totalEquity - UNRECORDED_ADJUSTMENT);

  const parseDepositTimestamp = (dateInput: any): number => {
    if (!dateInput) return 0;
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
      if (typeof dateInput.toMillis === 'function') return dateInput.toMillis();
      if (typeof dateInput.toDate === 'function') return dateInput.toDate().getTime();
      if (typeof dateInput.seconds === 'number') return dateInput.seconds * 1000;
    }
    return 0;
  };

  // Cálculo da percentagem TWR real atualizada ao segundo para o cartão de resumo superior
  const topCardTwrPercent = useMemo(() => {
    if (!allTimeTwrBaseline || allTimeTwrBaseline.baseCapital <= 0) {
      if (totalInvested > 0) {
        return (topCardProfit / totalInvested) * 100;
      }
      return totalDeposited > 0 ? (topCardProfit / totalDeposited) * 100 : 0;
    }

    const { baseIndex, baseCapital, lastTimestamp } = allTimeTwrBaseline;

    let recentDeposits = 0;
    depositsList.forEach((d: any) => {
      const depTime = parseDepositTimestamp(d.date);
      if (depTime > lastTimestamp) {
        recentDeposits += Number(d.amount) || 0;
      }
    });

    const adjustedEquity = totalEquity - UNRECORDED_ADJUSTMENT;
    const subReturn = (adjustedEquity - recentDeposits - baseCapital) / baseCapital;
    const currentTwrIndex = baseIndex * (1 + subReturn);
    const twr = (currentTwrIndex - 1) * 100;
    return isNaN(twr) ? 0 : twr;
  }, [allTimeTwrBaseline, totalEquity, topCardProfit, totalInvested, totalDeposited, depositsList]);

  const toggleDisplayUnit = () => {
    setDisplayUnit((prev) => (prev === 'eur' ? 'percent' : 'eur'));
  };

  // Cálculo da variação em Euros a partir da percentagem de retorno e do valor atual da posição
  const calcEuroChange = (currentValueEur: number | undefined, percent: number | undefined): number | undefined => {
    if (percent === undefined || percent === null || isNaN(percent) || !currentValueEur || currentValueEur <= 0) {
      return undefined;
    }
    const ratio = 1 + percent / 100;
    if (ratio <= 0.0001) {
      return -currentValueEur;
    }
    return currentValueEur - (currentValueEur / ratio);
  };

  const formatEuroValue = (val: number | undefined): string => {
    if (val === undefined || isNaN(val)) return '-';
    const abs = Math.abs(val);
    if (abs < 0.005) return '0,00€';
    const prefix = val > 0 ? '+' : '-';
    const formattedNum = abs.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${prefix}${formattedNum}€`;
  };

  // Helper for text color based on return percentage or euro change
  const getReturnColorClass = (val: number | undefined) => {
    if (val === undefined || val === null || isNaN(val)) return 'text-slate-400';
    if (val > 0) return 'text-emerald-600';
    if (val < 0) return 'text-rose-600';
    return 'text-slate-500';
  };

  return (
    <div className="w-full h-full flex flex-col justify-start bg-white text-slate-900 px-4 pt-2 pb-2 select-none max-w-md mx-auto overflow-y-auto">
      {/* TOP SUMMARY - SEM BALÃO DE FUNDO, APENAS TOTAL E LUCRO CENTRADOS COM ROLETA 120Hz */}
      <div className="relative w-full pt-1 pb-3 mb-1 flex flex-col items-center justify-center text-center">
        {/* API status indicator discretely positioned in top right */}
        <div className="absolute top-1 right-1 flex items-center">
          <span
            className={`w-2 h-2 rounded-full inline-block transition-all duration-300 ${
              isApiFresh
                ? pulseSync
                  ? 'bg-emerald-400 scale-125 shadow-[0_0_10px_rgba(16,185,129,0.9)] ring-2 ring-emerald-300/40'
                  : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                : 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]'
            }`}
            title={isApiFresh ? 'Atualização ativa a cada 3s (Tempo Real)' : 'A usar valores em cache / Falha na API'}
          />
        </div>

        {/* Centered Main Equity Value com efeito roleta 120Hz e desfocagem */}
        <div className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1.5 flex items-center justify-center">
          <RouletteText text={formatCurrencyEur(displayTotalEquity)} />
        </div>

        {/* Centered Lucro & TWR com efeito roleta 120Hz e desfocagem */}
        <div
          className={`flex items-baseline justify-center gap-1.5 ${
            topCardTwrPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          <RouletteText
            text={formatEuroValue(topCardProfit)}
            className="text-sm font-black tracking-tight"
          />
          <RouletteText
            text={formatPercentString(topCardTwrPercent)}
            className="text-xs font-bold opacity-85"
          />
        </div>
      </div>

      {/* Linha separadora super minimalista */}
      <div className="w-full border-t border-slate-100/80 my-1.5" />

      {/* 1. TOP HEADER (CHART INTERACTIVE HEADER) */}
      {!showSp500 ? (
        <div className="w-full flex items-center justify-end min-h-[30px] mb-2">
          <div className="flex flex-col items-end text-right">
            <span
              className={`text-lg font-semibold tracking-tight ${getReturnColorClass(
                activePoint?.portfolio?.returnPercent
              )}`}
            >
              {activePoint && activePoint.portfolio
                ? formatPercentString(activePoint.portfolio.returnPercent)
                : '0,00%'}
            </span>
            <span
              className={`text-sm font-medium ${getReturnColorClass(
                activePoint?.portfolio?.euroChange
              )}`}
            >
              {activePoint && activePoint.portfolio
                ? formatEuroChange(activePoint.portfolio.euroChange)
                : '€0'}
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full grid grid-cols-2 gap-2 min-h-[50px] mb-4">
          {/* Portfolio Card */}
          <div className="flex flex-col justify-center bg-blue-50/40 border border-blue-100/50 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Portfólio</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">
              {activePoint && activePoint.portfolio
                ? formatCurrencyEur(activePoint.portfolio.capitalValue)
                : formatCurrencyEur(totalValue)}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-bold ${getReturnColorClass(
                  activePoint?.portfolio?.returnPercent
                )}`}
              >
                {activePoint && activePoint.portfolio
                  ? formatPercentString(activePoint.portfolio.returnPercent)
                  : '0,00%'}
              </span>
              <span
                className={`text-[10px] font-medium ${getReturnColorClass(
                  activePoint?.portfolio?.euroChange
                )}`}
              >
                {activePoint && activePoint.portfolio
                  ? formatEuroChange(activePoint.portfolio.euroChange)
                  : '€0'}
              </span>
            </div>
          </div>

          {/* S&P 500 Card */}
          <div className="flex flex-col justify-center bg-yellow-50/40 border border-yellow-100/50 rounded-2xl p-3 relative">
            <button 
              type="button"
              onClick={() => setShowSp500(false)}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-yellow-100/80 text-yellow-700 transition-colors"
            >
              ×
            </button>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">S&P 500</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">
              {activePoint?.sp500
                ? formatCurrencyEur(activePoint.sp500.capitalValue)
                : '€0,00'}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-bold ${getReturnColorClass(
                  activePoint?.sp500?.returnPercent
                )}`}
              >
                {activePoint?.sp500
                  ? formatPercentString(activePoint.sp500.returnPercent)
                  : '0,00%'}
              </span>
              <span
                className={`text-[10px] font-medium ${getReturnColorClass(
                  activePoint?.sp500?.euroChange
                )}`}
              >
                {activePoint?.sp500
                  ? formatEuroChange(activePoint.sp500.euroChange)
                  : '€0'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. CHART AREA */}
      <div className="w-full flex flex-col mt-3 mb-2 shrink-0">
        {isLoading ? (
          <div className="w-full h-[200px] shrink-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : chartData && chartData.points.length > 0 ? (
          <HomePerformanceChart
            points={chartData.points}
            period={selectedPeriod}
            showSp500={showSp500}
            onToggleSp500={() => setShowSp500(true)}
            onCloseBenchmarks={() => setShowSp500(false)}
            onPointHover={(pt) => setHoveredPoint(pt)}
          />
        ) : (
          <div className="w-full h-[200px] flex items-center justify-center text-sm text-slate-400">
            Sem dados disponíveis para este período
          </div>
        )}
      </div>

      {/* 3. PERIOD SELECTOR */}
      <div className="w-full flex items-center justify-between gap-1 pt-0.5 pb-2">
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

      {/* 4. PERFORMANCE LIST SECTION */}
      <div className="w-full mt-2">
        <div className="flex flex-col">
          {sortedPositions.length > 0 ? sortedPositions.map((p) => {
            const isEur = displayUnit === 'eur';
            const posValueEur = p.value ?? (p.shares > 0 && p.currentPrice ? p.shares * p.currentPrice : 0);

            const euro1Dia = p.changeEur !== undefined ? p.changeEur : calcEuroChange(posValueEur, p.changePercent);
            const euro1Sem = p.weekReturnEur !== undefined ? p.weekReturnEur : calcEuroChange(posValueEur, p.weekReturnPercent);
            const euro1Mes = p.monthReturnEur !== undefined ? p.monthReturnEur : calcEuroChange(posValueEur, p.monthReturnPercent);
            const euro3Mes = p.threeMonthReturnEur !== undefined ? p.threeMonthReturnEur : calcEuroChange(posValueEur, p.threeMonthReturnPercent);
            const euro1Compra = p.profitEur !== undefined
              ? p.profitEur
              : calcEuroChange(posValueEur, p.firstPurchaseReturnPercent ?? p.totalReturnPercent);

            return (
            <div 
              key={p.id} 
              onClick={toggleDisplayUnit}
              className="flex items-center gap-2.5 py-2 px-1.5 -mx-1.5 rounded-xl border-b border-slate-50 last:border-0 group cursor-pointer hover:bg-slate-50/80 active:scale-[0.99] transition-all select-none"
              title="Clique para alternar entre % e EUR para todas as ações"
            >
              <CompanyLogo ticker={p.ticker} name={p.name} />
              <div className="flex flex-col flex-1 min-w-0">
                {/* Ticker & Name */}
                <div className="flex items-baseline gap-1.5 leading-tight truncate mb-1">
                  <span className="text-[11.5px] font-bold text-slate-800 shrink-0 tracking-tight">{p.ticker}</span>
                  <span className="text-[10px] text-slate-400 truncate">{getDisplayName(p.ticker, p.name)}</span>
                </div>
                
                {/* 5 Performance intervals starting directly under the ticker */}
                <div className="grid grid-cols-5 gap-1 items-center w-full">
                  {/* 1 dia (debaixo do ticker) */}
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-wider">1 dia</span>
                    <span className={`text-[10px] font-bold mt-0.5 tabular-nums ${getReturnColorClass(isEur ? euro1Dia : p.changePercent)}`}>
                      {isEur ? formatEuroValue(euro1Dia) : formatPercentString(p.changePercent ?? 0)}
                    </span>
                  </div>

                  {/* 1 semana */}
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-wider">1 sem</span>
                    <span className={`text-[10px] font-bold mt-0.5 tabular-nums ${getReturnColorClass(isEur ? euro1Sem : p.weekReturnPercent)}`}>
                      {isEur 
                        ? formatEuroValue(euro1Sem) 
                        : (p.weekReturnPercent !== undefined ? formatPercentString(p.weekReturnPercent) : '-')}
                    </span>
                  </div>

                  {/* 1 mês */}
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-wider">1 mês</span>
                    <span className={`text-[10px] font-bold mt-0.5 tabular-nums ${getReturnColorClass(isEur ? euro1Mes : p.monthReturnPercent)}`}>
                      {isEur 
                        ? formatEuroValue(euro1Mes) 
                        : (p.monthReturnPercent !== undefined ? formatPercentString(p.monthReturnPercent) : '-')}
                    </span>
                  </div>

                  {/* 3 meses */}
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-wider">3 meses</span>
                    <span className={`text-[10px] font-bold mt-0.5 tabular-nums ${getReturnColorClass(isEur ? euro3Mes : p.threeMonthReturnPercent)}`}>
                      {isEur 
                        ? formatEuroValue(euro3Mes) 
                        : (p.threeMonthReturnPercent !== undefined ? formatPercentString(p.threeMonthReturnPercent) : '-')}
                    </span>
                  </div>

                  {/* TOTAL */}
                  <div className="flex flex-col items-end leading-none">
                    <span className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-wider">Total</span>
                    <span className={`text-[10px] font-bold mt-0.5 tabular-nums ${getReturnColorClass(isEur ? euro1Compra : (p.firstPurchaseReturnPercent ?? p.totalReturnPercent))}`}>
                      {isEur 
                        ? formatEuroValue(euro1Compra) 
                        : formatPercentString(p.firstPurchaseReturnPercent ?? p.totalReturnPercent ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}) : (
            <span className="text-[10px] text-slate-300 italic pt-1 px-1 text-center w-full block">Sem posições</span>
          )}
        </div>
      </div>
    </div>
  );
};
