import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DonutChart } from './components/DonutChart';
import { QuickFilters } from './components/QuickFilters';
import { HoldingsSection } from './components/HoldingsSection';
import { PullToRefresh } from './components/PullToRefresh';
import { BottomTabBar } from './components/BottomTabBar';
import { HomeTab } from './components/HomeTab';
import { GoalTab } from './components/GoalTab';
import { SettingsTab } from './components/SettingsTab';
import { AiPortfolioAnalysisView } from './components/AiPortfolioAnalysisView';
import { ContributionCalculatorModal, AllocationTarget } from './components/ContributionCalculatorModal';
import { StockChartModal } from './components/StockChartModal';
import { LoadingScreen } from './components/LoadingScreen';
import { HoldingDoc, PortfolioPosition, TabType } from './types';
import { PeriodOption } from './services/homeChartService';
import {
  subscribeUserHoldings,
  computePortfolio,
  fetchLiveQuotes,
  getLastSuccessfulQuoteUpdate,
  invalidateClientQuotesCache,
} from './services/portfolioService';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [selectedTickerForChart, setSelectedTickerForChart] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingDoc[]>([]);
  const [quotes, setQuotes] = useState<Record<string, any>>({});
  const [resetSettingsSignal, setResetSettingsSignal] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('1D');
  const [calculatorInitialTargets, setCalculatorInitialTargets] = useState<AllocationTarget[] | null>(null);
  const [calculatorInitialAmount, setCalculatorInitialAmount] = useState<string>('');

  // Ref to always access latest holdings inside stable timer callbacks
  const holdingsRef = useRef<HoldingDoc[]>([]);
  const lastSubscribedRef = useRef<string>('');
  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);

  // Firestore real-time listener for holdings
  useEffect(() => {
    const unsubscribe = subscribeUserHoldings(
      'main',
      (updatedHoldings) => {
        setHoldings(updatedHoldings);
        if (updatedHoldings.length === 0) {
          setIsInitializing(false);
        }
      },
      (error) => {
        console.warn('Erro na subscrição de holdings:', error);
        setIsInitializing(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Central quote fetcher
  const refreshQuotes = useCallback(async (force: boolean = false, retryCount: number = 0) => {
    const currentHoldings = holdingsRef.current;
    if (currentHoldings.length === 0) {
      setIsInitializing(false);
      return;
    }
    const tickers = currentHoldings.map((h) => h.ticker);

    try {
      const fetchedQuotes = await fetchLiveQuotes(tickers, force);
      
      // Check if any of the fetched quotes contain errors
      const hasErrors = tickers.some(ticker => fetchedQuotes[ticker] && fetchedQuotes[ticker].error);
      
      if (hasErrors && retryCount < 2) {
        console.warn(`Quote fetch failed, retrying immediately (attempt ${retryCount + 1})...`);
        setTimeout(() => refreshQuotes(force, retryCount + 1), 1000); // 1s retry delay
        return;
      }

      setQuotes((prev) => ({ ...prev, ...fetchedQuotes }));
      setIsInitializing(false);
    } catch (error) {
      if (retryCount < 2) {
        console.warn(`Quote fetch failed, retrying immediately (attempt ${retryCount + 1})...`);
        setTimeout(() => refreshQuotes(force, retryCount + 1), 1000); // 1s retry delay
      } else {
        setIsInitializing(false);
      }
    }
  }, []);

  // Initial quote fetch and fetch on holdings changes
  useEffect(() => {
    if (holdings.length > 0) {
      refreshQuotes(false);
    }
  }, [holdings, refreshQuotes]);

  // 1. Automatic background real-time refresh interval (3s for 1D, 60s for other periods)
  useEffect(() => {
    const intervalMs = selectedPeriod === '1D' ? 3000 : 60000;
    const timerId = setInterval(() => {
      refreshQuotes(true);
    }, intervalMs);

    return () => {
      clearInterval(timerId);
    };
  }, [refreshQuotes, selectedPeriod]);

  // 2. Visibility change & window focus detector: check if 5 minutes elapsed since last successful update
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const lastUpdate = getLastSuccessfulQuoteUpdate();
        const now = Date.now();
        if (now - lastUpdate >= FIVE_MINUTES_MS) {
          refreshQuotes(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [refreshQuotes]);

  // Pull to refresh handler (manual force refresh)
  const handleRefresh = useCallback(async () => {
    invalidateClientQuotesCache();
    await refreshQuotes(true);
  }, [refreshQuotes]);

  // Compute portfolio metrics dynamically with live quotes
  const portfolio = computePortfolio(holdings, quotes);

  // Selected position dynamically derived from the latest live computed portfolio
  const liveSelectedPosition = selectedTickerForChart
    ? portfolio.positions.find(
        (p) => p.ticker.toUpperCase() === selectedTickerForChart.toUpperCase()
      ) || null
    : null;

  // Handler for '+' quick action button -> Opens Contribution Calculator
  const handlePlusClick = () => {
    setIsCalculatorOpen(true);
  };

  // Handler for selecting a position item -> Opens Stock Details & Interactive Chart Modal
  const handleSelectPosition = (position: PortfolioPosition) => {
    setSelectedTickerForChart(position.ticker);
  };

  // Handler for tab change
  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
    if (tab === 'settings') {
      setResetSettingsSignal((prev) => prev + 1);
    }
    const lastUpdate = getLastSuccessfulQuoteUpdate();
    if (Date.now() - lastUpdate >= FIVE_MINUTES_MS) {
      refreshQuotes(true);
    }
  };

  const handleApplyAiAllocation = (allocations: any[]) => {
    const newTargets: AllocationTarget[] = allocations.map((a, idx) => ({
      id: `ai_${a.ticker}_${Date.now()}_${idx}`,
      ticker: a.ticker,
      name: a.ticker, // Could be improved with name lookups
      targetPercent: a.percentage
    }));
    
    // Sum of percentages must be 100
    const totalPct = newTargets.reduce((sum, t) => sum + t.targetPercent, 0);
    if (totalPct > 0 && totalPct < 100) {
      // Add a "Caixa" target if needed or redistribute? 
      // The AI is supposed to return 100%. 
    }

    setCalculatorInitialTargets(newTargets);
    // Also pre-fill the amount from the analysis
    const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
    setCalculatorInitialAmount(String(totalAmount));
    setIsCalculatorOpen(true);
  };

  if (isInitializing) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900 select-none pb-24">
      {/* Top Safe Area Spacing */}
      <div className="pt-[env(safe-area-inset-top,20px)]" />

      {/* Main Content Area */}
      {currentTab === 'allocation' && (
        <PullToRefresh onRefresh={handleRefresh} className="flex-1 w-full max-w-md mx-auto flex flex-col">
          {/* 1. Donut Chart Section */}
          <DonutChart
            totalValue={portfolio.totalValue}
            currencySymbol="€"
            positionsCount={portfolio.positions.length}
            positions={portfolio.positions}
          />

          {/* 2. Quick Filters / Action Row (+ opens Calculator) */}
          <QuickFilters onPlusClick={handlePlusClick} />

          {/* 3. Holdings Section (Clicking open stock chart details) */}
          <HoldingsSection
            positions={portfolio.positions}
            onSelectPosition={handleSelectPosition}
          />
        </PullToRefresh>
      )}

      {currentTab === 'home' && (
        <PullToRefresh onRefresh={handleRefresh} className="flex-1 w-full max-w-md mx-auto flex flex-col">
          <HomeTab 
            holdings={holdings} 
            totalValue={portfolio.liveTotalValue || portfolio.totalValue} 
            positions={portfolio.positions}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
        </PullToRefresh>
      )}

      {currentTab === 'goal' && (
        <PullToRefresh onRefresh={handleRefresh} className="flex-1 w-full max-w-md mx-auto flex flex-col">
          <GoalTab 
            totalValue={portfolio.totalValue} 
            positions={portfolio.positions}
          />
        </PullToRefresh>
      )}

      {currentTab === 'analysis' && (
        <AiPortfolioAnalysisView 
          positions={portfolio.positions}
          onApplyAllocation={handleApplyAiAllocation}
        />
      )}

      {currentTab === 'settings' && (
        <div className="flex-1 w-full max-w-md mx-auto flex flex-col">
          <SettingsTab
            positions={portfolio.positions}
            holdings={holdings}
            resetSignal={resetSettingsSignal}
            onSyncComplete={handleRefresh}
          />
        </div>
      )}

      {/* 4. Bottom Tab Bar */}
      <BottomTabBar currentTab={currentTab} onTabChange={handleTabChange} />

      {/* 5. Contribution & Rebalance Calculator Modal */}
      <ContributionCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => {
          setIsCalculatorOpen(false);
          setCalculatorInitialTargets(null);
          setCalculatorInitialAmount('');
        }}
        positions={portfolio.positions}
        totalValue={portfolio.totalValue}
        initialTargets={calculatorInitialTargets || undefined}
        initialAmount={calculatorInitialAmount || undefined}
        onNavigateToAnalysis={() => setCurrentTab('analysis')}
      />

      {/* 6. Interactive Stock & ETF Chart Modal with Live Dynamic Position Updates */}
      <StockChartModal
        isOpen={liveSelectedPosition !== null}
        position={liveSelectedPosition}
        holding={
          liveSelectedPosition
            ? holdings.find(
                (h) => {
                  const cleanH = h.ticker.toUpperCase().replace(/\.US$/i, '');
                  const cleanPos = liveSelectedPosition.ticker.toUpperCase().replace(/\.US$/i, '');
                  return cleanH === cleanPos;
                }
              )
            : null
        }
        onClose={() => setSelectedTickerForChart(null)}
      />
    </div>
  );
}
