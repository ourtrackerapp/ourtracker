import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, BrainCircuit, CheckCircle2, TrendingUp, AlertCircle, Loader2, ArrowLeftRight } from 'lucide-react';
import { PortfolioPosition, PortfolioAnalysisResult } from '../types';

interface AiPortfolioAnalysisViewProps {
  positions: PortfolioPosition[];
  onApplyAllocation: (allocations: PortfolioAnalysisResult['allocations']) => void;
}

export const AiPortfolioAnalysisView: React.FC<AiPortfolioAnalysisViewProps> = ({
  positions,
  onApplyAllocation,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PortfolioAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Por favor, insira um montante válido para o aporte.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/ai/analyze-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAporte: numAmount,
          positions: positions.map(p => ({
            ticker: p.ticker,
            currentPrice: p.currentPrice,
            averagePrice: p.averagePrice,
            value: p.value,
            allocationPercent: p.allocationPercent
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Falha na resposta do servidor');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro ao processar a análise.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-md mx-auto px-4 py-6 overflow-y-auto pb-32">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Estrategista AI</h1>
        </div>
        <p className="text-slate-500 text-sm font-medium leading-relaxed">
          Otimiza o teu aporte mensal com base em fundamentos SEC, previsões de Wall Street e no equilíbrio da tua carteira.
        </p>
      </header>

      {!result && !isAnalyzing && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xl shadow-slate-200/50"
        >
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Quanto pretendes aportar?
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-xl font-bold text-slate-400">€</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 500"
                className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-2xl py-4 pl-10 pr-4 text-2xl font-black text-slate-900 outline-none transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleRunAnalysis}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Gerar Estratégia de Aporte</span>
          </button>
        </motion.div>
      )}

      {isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
            <Sparkles className="w-5 h-5 text-purple-300 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <p className="mt-6 text-slate-900 font-bold">O Estrategista está a trabalhar...</p>
          <p className="text-slate-400 text-xs mt-1">A analisar fundamentais e sentimento de mercado</p>
        </div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Investment Thesis Section */}
          <section className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-purple-500/20">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-purple-200" />
              <h2 className="text-lg font-black tracking-tight">{result.thesis.title}</h2>
            </div>
            <p className="text-purple-50 text-sm leading-relaxed mb-6 font-medium">
              {result.thesis.globalStrategy}
            </p>
            <div className="space-y-3">
              {result.thesis.keyPoints.map((point, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-white/10 rounded-xl p-3">
                  <CheckCircle2 className="w-4 h-4 text-purple-200 shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold leading-tight">{point}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Allocation Recommendations */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Alocação Sugerida</h3>
              <span className="text-xs font-bold text-slate-900">Total: {result.totalAporte.toLocaleString('pt-PT')} €</span>
            </div>
            
            <div className="space-y-3">
              {result.allocations.map((alloc, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">{alloc.ticker}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tighter ${
                        alloc.action === 'COMPRA' ? 'bg-emerald-50 text-emerald-600' : 
                        alloc.action === 'REDUZIR' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'
                      }`}>
                        {alloc.action}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-600">{alloc.amount.toLocaleString('pt-PT')} €</span>
                      <span className="block text-[10px] font-bold text-slate-400">{alloc.percentage}% do aporte</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic border-l-2 border-slate-100 pl-3">
                    "{alloc.reason}"
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              onClick={() => setResult(null)}
              className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Nova Simulação</span>
            </button>
            <button
              onClick={() => onApplyAllocation(result.allocations)}
              className="py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Aceitar Sugestão</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
