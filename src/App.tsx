import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DonutChart } from './components/DonutChart';
import { QuickFilters } from './components/QuickFilters';
import { HoldingsSection } from './components/HoldingsSection';
import { PullToRefresh } from './components/PullToRefresh';
import { BottomTabBar } from './components/BottomTabBar';
import { HomeTab } from './components/HomeTab';
import { SettingsTab } from './components/SettingsTab';
import { ContributionCalculatorModal } from './components/ContributionCalculatorModal';
import { StockChartModal } from './components/StockChartModal';
import { HoldingDoc, PortfolioPosition, TabType } from './types';
import {
  subscribeUserHoldings,
  computePortfolio,
  fetchLiveQuotes,
  getLastSuccessfulQuoteUpdate,
  invalidateClientQuotesCache,
} from './services/portfolioService';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('allocation');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [selectedTickerForChart, setSelectedTickerForChart] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingDoc[]>([]);
  const [quotes, setQuotes] = useState<Record<string, any>>({});
  const [resetSettingsSignal, setResetSettingsSignal] = useState<number>(0);

  // Ref to always access latest holdings inside stable timer callbacks
  const holdingsRef = useRef<HoldingDoc[]>([]);
  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);

  // Firestore real-time listener for holdings
  useEffect(() => {
    const unsubscribe = subscribeUserHoldings(
      'main',
      (updatedHoldings) => {
        setHoldings(updatedHoldings);
      },
      (error) => {
        console.warn('Erro na subscrição de holdings:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Central quote fetcher
  const refreshQuotes = useCallback(async (force: boolean = false) => {
    const currentHoldings = holdingsRef.current;
    if (currentHoldings.length === 0) return;
    const tickers = currentHoldings.map((h) => h.ticker);
    const fetchedQuotes = await fetchLiveQuotes(tickers, force);
    setQuotes((prev) => ({ ...prev, ...fetchedQuotes }));
  }, []);

  // Initial quote fetch and fetch on holdings changes
  useEffect(() => {
    if (holdings.length > 0) {
      refreshQuotes(false);
    }
  }, [holdings, refreshQuotes]);

  // 1. Automatic 5-minute background refresh interval (300,000 ms)
  useEffect(() => {
    const timerId = setInterval(() => {
      // Force refresh every 5 minutes to fetch the latest market quotes
      refreshQuotes(true);
    }, FIVE_MINUTES_MS);

    return () => {
      clearInterval(timerId);
    };
  }, [refreshQuotes]);

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
            totalValue={portfolio.totalValue} 
            positions={portfolio.positions}
          />
        </PullToRefresh>
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
        onClose={() => setIsCalculatorOpen(false)}
        positions={portfolio.positions}
        totalValue={portfolio.totalValue}
      />

      {/* 6. Interactive Stock & ETF Chart Modal with Live Dynamic Position Updates */}
      <StockChartModal
        isOpen={liveSelectedPosition !== null}
        position={liveSelectedPosition}
        holding={
          liveSelectedPosition
            ? holdings.find(
                (h) => h.ticker.toUpperCase() === liveSelectedPosition.ticker.toUpperCase()
              )
            : null
        }
        onClose={() => setSelectedTickerForChart(null)}
      />
    </div>
  );
}
