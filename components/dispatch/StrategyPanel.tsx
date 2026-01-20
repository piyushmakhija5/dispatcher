'use client';

import { Target } from 'lucide-react';
import type { NegotiationState } from '@/types/dispatch';
import type { OfferEvaluation } from './CostBreakdown';

/** Strategy thresholds for negotiation */
interface StrategyThreshold {
  maxMinutes: number;
  description: string;
  costImpact: string;
}

/** Cost thresholds for evaluation */
interface CostThresholds {
  ideal: number;
  acceptable: number;
  reluctant: number;
}

/** Display-friendly time strings */
interface StrategyDisplay {
  idealBefore: string;
  acceptableBefore: string;
  worstCaseArrival: string;
}

/** Complete negotiation strategy */
export interface NegotiationStrategy {
  thresholds: {
    ideal: StrategyThreshold;
    acceptable: StrategyThreshold;
    problematic: StrategyThreshold;
  };
  costThresholds: CostThresholds;
  maxPushbackAttempts: number;
  display: StrategyDisplay;
}

interface StrategyPanelProps {
  strategy: NegotiationStrategy;
  negotiationState: NegotiationState;
  currentEvaluation: OfferEvaluation | null;
}

export function StrategyPanel({
  strategy,
  negotiationState,
}: StrategyPanelProps) {
  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-semibold text-purple-300">Strategy</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        {/* Ideal */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
          <div className="text-emerald-400 font-medium mb-1">IDEAL</div>
          <div className="text-slate-400">Before {strategy.display.idealBefore}</div>
          <div className="text-emerald-400 font-mono">
            {strategy.thresholds.ideal.costImpact}
          </div>
        </div>

        {/* Acceptable */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
          <div className="text-blue-400 font-medium mb-1">OK</div>
          <div className="text-slate-400">Before {strategy.display.acceptableBefore}</div>
          <div className="text-blue-400 font-mono">
            {strategy.thresholds.acceptable.costImpact}
          </div>
        </div>

        {/* Bad */}
        <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
          <div className="text-red-400 font-medium mb-1">BAD</div>
          <div className="text-slate-400">After {strategy.display.acceptableBefore}</div>
          <div className="text-red-400 font-mono">
            {strategy.thresholds.problematic.costImpact}
          </div>
        </div>
      </div>

      {/* Pushback Counter */}
      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-slate-500">Pushbacks used:</span>
        <span className="text-amber-400 font-mono">
          {negotiationState?.pushbackCount || 0}/{strategy.maxPushbackAttempts}
        </span>
      </div>
    </div>
  );
}
