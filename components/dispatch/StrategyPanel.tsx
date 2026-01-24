'use client';

import { Target, FileText, AlertTriangle, Clock } from 'lucide-react';
import type { NegotiationState } from '@/types/dispatch';
import type { OfferEvaluation } from './CostBreakdown';
import type { NegotiationStrategy } from '@/lib/negotiation-strategy';

// Re-export NegotiationStrategy for backward compatibility
export type { NegotiationStrategy };

/**
 * Format minutes to human-readable string (e.g., 390 -> "6h 30m")
 */
function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

interface StrategyPanelProps {
  strategy: NegotiationStrategy;
  negotiationState: NegotiationState;
  currentEvaluation: OfferEvaluation | null;
  /** Optional: Show whether using extracted contract or defaults */
  contractSource?: 'extracted' | 'defaults' | null;
  /** Optional: Party name from extracted contract */
  partyName?: string | null;
}

export function StrategyPanel({
  strategy,
  negotiationState,
  contractSource,
  partyName,
}: StrategyPanelProps) {
  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-300">Strategy</span>
        </div>
        {/* Contract source indicator */}
        {contractSource && (
          <div className="flex items-center gap-1">
            {contractSource === 'extracted' ? (
              <>
                <FileText className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">
                  {partyName || 'Contract'}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-400">Defaults</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actual Arrival Time + HOS Indicator */}
      <div className="flex gap-2 mb-2">
        {/* Arrival Time */}
        {strategy.display.actualArrivalTime && (
          <div className="flex-1 bg-slate-700/30 border border-slate-600/30 rounded p-2">
            <div className="text-[10px] text-slate-400 mb-0.5">Truck arrives at:</div>
            <div className="text-sm text-cyan-400 font-mono font-semibold">
              {strategy.display.actualArrivalTime}
            </div>
          </div>
        )}

        {/* HOS Status Indicator */}
        {strategy.hosConstraints && (
          <div className="flex-1 bg-amber-500/10 border border-amber-500/30 rounded p-2">
            <div className="flex items-center gap-1 text-[10px] text-amber-400 mb-0.5">
              <Clock className="w-3 h-3" />
              <span>HOS Limit</span>
            </div>
            <div className="text-sm text-amber-400 font-mono font-semibold">
              {strategy.hosConstraints.latestFeasibleTime}
            </div>
          </div>
        )}
      </div>

      {/* HOS Warning Banner */}
      {strategy.hosConstraints && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 mb-2 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-[10px]">
            <span className="text-amber-400 font-medium">Driver&apos;s {strategy.hosConstraints.bindingConstraint.replace('_', ' ')} constraint: </span>
            <span className="text-slate-400">
              {formatMinutes(strategy.hosConstraints.bindingConstraintRemainingMinutes)} remaining.
              {strategy.hosConstraints.requiresNextShift
                ? ` Next shift available at ${strategy.hosConstraints.nextShiftEarliestTime}.`
                : ` Must complete by ${strategy.hosConstraints.latestFeasibleTime}.`}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        {/* Ideal */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
          <div className="text-emerald-400 font-medium mb-1">IDEAL</div>
          <div className="text-slate-400 text-[10px] mb-1">
            {strategy.thresholds.ideal.description}
          </div>
          <div className="text-slate-500 text-[10px] mb-1">
            {strategy.display.idealBefore === strategy.display.actualArrivalTime
              ? `Around ${strategy.display.idealBefore}`
              : `Before ${strategy.display.idealBefore}`}
          </div>
          <div className="text-emerald-400 font-mono">
            {strategy.thresholds.ideal.costImpact}
          </div>
        </div>

        {/* Acceptable */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
          <div className="text-blue-400 font-medium mb-1">OK</div>
          <div className="text-slate-400 text-[10px] mb-1">
            {strategy.thresholds.acceptable.description}
          </div>
          <div className="text-slate-500 text-[10px] mb-1">
            Before {strategy.display.acceptableBefore}
          </div>
          <div className="text-blue-400 font-mono">
            {strategy.thresholds.acceptable.costImpact}
          </div>
        </div>

        {/* Bad */}
        <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
          <div className="text-red-400 font-medium mb-1">BAD</div>
          <div className="text-slate-400 text-[10px] mb-1">
            {strategy.thresholds.problematic.description}
          </div>
          <div className="text-slate-500 text-[10px] mb-1">
            After {strategy.display.acceptableBefore}
          </div>
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
