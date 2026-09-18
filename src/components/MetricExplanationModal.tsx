import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HelpCircle, Lightbulb, BookOpen } from 'lucide-react';
import { MetricExplanation } from '../data/metricExplanations';

interface MetricExplanationModalProps {
  explanation: MetricExplanation | null;
  currentValue?: string | number;
  onClose: () => void;
}

export const MetricExplanationModal: React.FC<MetricExplanationModalProps> = ({
  explanation,
  currentValue,
  onClose,
}) => {
  if (!explanation) return null;

  return (
    <AnimatePresence>
      <div
        id="metric-explanation-backdrop"
        className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-200">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {explanation.name}
                </h3>
                {currentValue !== undefined && currentValue !== null && currentValue !== '' && (
                  <div className="text-xs text-slate-300 font-medium">
                    Valor no Ativo: <strong className="text-white font-bold">{currentValue}</strong>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar explicação"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* O que significa em linguagem simples */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900">
                <HelpCircle className="w-4 h-4 text-slate-700" />
                <span>O que significa em linguagem simples</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {explanation.simpleMeaning}
              </p>
            </div>

            {/* Exemplo Prático */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                <span>Exemplo Prático</span>
              </div>
              <div className="text-xs sm:text-sm text-amber-950 leading-relaxed bg-amber-50/70 p-3 rounded-xl border border-amber-200/70 font-medium">
                {explanation.example}
              </div>
            </div>

            {/* Como Interpretar */}
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Como Interpretar (O que procurar)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {explanation.howToInterpret}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 active:bg-slate-950 transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
