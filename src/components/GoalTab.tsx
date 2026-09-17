import React, { useState, useMemo, useEffect } from 'react';
import { Save, X, Settings } from 'lucide-react';
import { formatCurrencyEur } from '../services/homeChartService';
import { PortfolioPosition } from '../types';
import { GoalPerformanceChart } from './goal/GoalPerformanceChart';
import { fetchPortfolioMeta } from '../services/portfolioService';

interface GoalTabProps {
  totalValue: number;
  positions: PortfolioPosition[];
}

export const GoalTab: React.FC<GoalTabProps> = ({ totalValue, positions }) => {
  // Load settings from localStorage
  const [monthlyContribution, setMonthlyContribution] = useState<number>(() => {
    const saved = localStorage.getItem('goal_monthly_contribution');
    return saved ? Number(saved) : 300; // Default €300
  });

  const [expectedReturn, setExpectedReturn] = useState<number>(() => {
    const saved = localStorage.getItem('goal_expected_return');
    return saved ? Number(saved) : 8; // Default 8% target return
  });

  const [targetGoal, setTargetGoal] = useState<number>(() => {
    const saved = localStorage.getItem('goal_target_value');
    return saved ? Number(saved) : 100000; // Default €100,000 target golo
  });

  // State to hold actual deposits loaded from Firestore/Sync
  const [deposits, setDeposits] = useState<{ date: string; amount: number }[]>([]);

  // Fetch deposits dynamically on mount and poll periodically for real-time updates
  useEffect(() => {
    let active = true;
    async function loadMeta() {
      try {
        const meta = await fetchPortfolioMeta('main');
        if (active && meta && Array.isArray(meta.deposits)) {
          setDeposits(meta.deposits);
        }
      } catch (err) {
        console.warn('Error fetching meta in GoalTab:', err);
      }
    }
    loadMeta();

    const interval = setInterval(() => {
      loadMeta();
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Modal State for configuration - Use Strings to allow empty inputs while editing
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [tempContribution, setTempContribution] = useState<string>('');
  const [tempReturn, setTempReturn] = useState<string>('');
  const [tempTarget, setTempTarget] = useState<string>('');

  // Helper to format digits with dots as thousands separators
  const formatDots = (rawString: string) => {
    const clean = rawString.replace(/\D/g, '');
    if (!clean) return '';
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Open modal and load current settings pre-formatted with dots and commas
  const handleOpenModal = () => {
    setTempContribution(formatDots(monthlyContribution.toString()));
    setTempReturn(expectedReturn.toString().replace('.', ','));
    setTempTarget(formatDots(targetGoal.toString()));
    setIsConfigModalOpen(true);
  };

  // Save configurations to storage
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse values safely (remove dots for integers, replace commas for decimals)
    const rawContribution = tempContribution.replace(/\./g, '');
    const rawTarget = tempTarget.replace(/\./g, '');
    const rawReturn = tempReturn.replace(/,/g, '.');

    const contributionNum = rawContribution === '' ? 0 : Number(rawContribution);
    const targetNum = rawTarget === '' ? 0 : Number(rawTarget);
    const returnNum = rawReturn === '' ? 0 : Number(rawReturn);
    
    setMonthlyContribution(contributionNum);
    setExpectedReturn(returnNum);
    setTargetGoal(targetNum);
    
    localStorage.setItem('goal_monthly_contribution', contributionNum.toString());
    localStorage.setItem('goal_expected_return', returnNum.toString());
    localStorage.setItem('goal_target_value', targetNum.toString());
    
    setIsConfigModalOpen(false);
  };

  // Calculate actual historical portfolio performance
  const actualPortfolioReturnAnnualized = useMemo(() => {
    if (positions.length === 0 || totalValue <= 0) return 6.5; // reasonable default
    
    let oldestTimestamp = Date.now();
    let hasValidDate = false;
    
    positions.forEach(p => {
      if (p.firstPurchaseTimestamp && p.firstPurchaseTimestamp < oldestTimestamp) {
        oldestTimestamp = p.firstPurchaseTimestamp;
        hasValidDate = true;
      }
    });

    if (!hasValidDate) return expectedReturn;

    const yearsInvested = (Date.now() - oldestTimestamp) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsInvested < 0.1) return expectedReturn;

    const totalInvested = positions.reduce((sum, p) => sum + (p.totalInvested || 0), 0);
    if (totalInvested <= 0) return 0;
    
    const absoluteReturnPercent = ((totalValue - totalInvested) / totalInvested);
    const annualized = (Math.pow(1 + absoluteReturnPercent, 1 / yearsInvested) - 1) * 100;
    return isNaN(annualized) ? 0 : Math.max(0, annualized);
  }, [positions, totalValue, expectedReturn]);

  // Generate dynamic chart data based on real deposits from settings and portfolio totalValue
  const chartData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const points = [];

    // Parse real deposits from settings
    const parsedDeposits: { dateObj: Date; amount: number; year: number; month: number }[] = [];
    deposits.forEach(d => {
      const parts = d.date.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        if (!isNaN(dateObj.getTime())) {
          parsedDeposits.push({ dateObj, amount: Number(d.amount) || 0, year, month });
        }
      }
    });

    // Determine the start date from deposits or positions first purchase timestamp
    let firstDate: Date | null = null;
    parsedDeposits.forEach(pd => {
      if (!firstDate || pd.dateObj < firstDate) {
        firstDate = pd.dateObj;
      }
    });

    positions.forEach(p => {
      if (p.firstPurchaseTimestamp) {
        const dateObj = new Date(p.firstPurchaseTimestamp);
        if (!isNaN(dateObj.getTime())) {
          if (!firstDate || dateObj < firstDate) {
            firstDate = dateObj;
          }
        }
      }
    });

    if (!firstDate) {
      firstDate = new Date(currentYear, 0, 1);
    }

    const startYear = firstDate.getFullYear();
    const startMonth = firstDate.getMonth();
    const endYear = Math.max(currentYear, today.getFullYear());
    const endMonth = 11; // December

    const totalMonths = Math.max(1, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);
    const todayIndex = (today.getFullYear() - startYear) * 12 + (today.getMonth() - startMonth);

    const totalActualDeposits = parsedDeposits.reduce((sum, pd) => sum + pd.amount, 0);
    const growthMultiplier = totalActualDeposits > 0 && totalValue > 0 ? (totalValue / totalActualDeposits) : 1;

    const annualRate = expectedReturn > 0 ? expectedReturn / 100 : 0.08;
    const monthlyRate = annualRate / 12;

    let runningGoalValue = 0;
    let runningCumulativeDeposit = 0;
    const activeMonthlyContrib = monthlyContribution > 0 ? monthlyContribution : 300;

    for (let i = 0; i < totalMonths; i++) {
      const d = new Date(startYear, startMonth + i, 1);
      const mYear = d.getFullYear();
      const mMonth = d.getMonth();

      const monthDeps = parsedDeposits.filter(pd => pd.year === mYear && pd.month === mMonth);
      const monthDepositSum = monthDeps.reduce((sum, pd) => sum + pd.amount, 0);

      runningCumulativeDeposit += monthDepositSum;

      // Compounding goal value with expected annual return rate per month
      runningGoalValue = (runningGoalValue + activeMonthlyContrib) * (1 + monthlyRate);
      const gVal = runningGoalValue;

      const isPast = i <= todayIndex;
      const isToday = i === todayIndex;

      let pVal = 0;
      if (i <= todayIndex) {
        const baseDep = runningCumulativeDeposit > 0 ? runningCumulativeDeposit : (i + 1) * (totalValue / Math.max(1, todayIndex + 1));
        pVal = baseDep * (totalValue > 0 && totalActualDeposits > 0 ? growthMultiplier : 1);
        if (isToday) pVal = totalValue; // exact current wallet value
      } else {
        pVal = 0;
      }

      const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthLabel = MONTH_NAMES[d.getMonth()];
      const yearLabel = `'${d.getFullYear().toString().slice(-2)}`;
      const labelText = isToday ? `${monthLabel} ${yearLabel} (Atual)` : `${monthLabel} ${yearLabel}`;

      points.push({
        year: d.getFullYear(),
        portfolioValue: pVal,
        goalValue: gVal,
        monthDeposit: monthDepositSum, // Individual deposit for this specific month
        cumulativeDeposit: runningCumulativeDeposit,
        label: labelText,
        isPast: isPast
      });
    }

    return points;
  }, [deposits, positions, totalValue, monthlyContribution]);

  const currentYearGoal = useMemo(() => {
    const currentPoint = chartData.find(p => p.label.includes('Atual'));
    return currentPoint ? currentPoint.goalValue : 0;
  }, [chartData]);

  return (
    <div className="w-full h-full flex flex-col justify-start bg-white text-slate-900 px-4 pt-2 pb-2 select-none max-w-md mx-auto overflow-y-auto">
      
      {/* 1. DISCREET CONFIGURATION BUTTON (NO HEADER TEXT) */}
      <div className="w-full flex justify-end mb-1 pt-1 pr-1">
        <button 
          onClick={handleOpenModal}
          className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-xl transition-all cursor-pointer active:scale-95"
          title="Configurações de Objetivo"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* 2. MAIN CHARTS GRAPH VIEW (HEIGHT SET TO 280PX) */}
      <div className="w-full flex-1 min-h-[280px] mb-4">
        <GoalPerformanceChart 
          points={chartData} 
          timeframe="year" 
          targetGoal={targetGoal} 
          totalValue={totalValue}
          currentYearGoal={currentYearGoal}
          monthlyContribution={monthlyContribution}
        />
      </div>

      {/* 4. OVERLAY CONFIGURATION MODAL */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-100 p-6 flex flex-col gap-5 animate-scale-up">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-800 text-sm">Configuração de Objetivo</h3>
              </div>
              <button 
                onClick={() => setIsConfigModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveConfig} className="flex flex-col gap-4">
              {/* Input: Objetivo final */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Objetivo final</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-800 text-sm transition-colors"
                  placeholder="Ex: 100.000"
                  value={tempTarget}
                  onChange={(e) => {
                    const formatted = formatDots(e.target.value);
                    setTempTarget(formatted);
                  }}
                />
              </div>

              {/* Input: Aporte mensal */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aporte mensal</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-800 text-sm transition-colors"
                  placeholder="Ex: 300"
                  value={tempContribution}
                  onChange={(e) => {
                    const formatted = formatDots(e.target.value);
                    setTempContribution(formatted);
                  }}
                />
              </div>

              {/* Input: Rentabilidade anual */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rentabilidade anual</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-800 text-sm transition-colors"
                  placeholder="Ex: 8"
                  value={tempReturn}
                  onChange={(e) => {
                    // Allow digits and at most one decimal separator (comma or dot)
                    const val = e.target.value.replace(/[^0-9,.]/g, '');
                    setTempReturn(val);
                  }}
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" /> Guardar Objetivo e Parâmetros
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
