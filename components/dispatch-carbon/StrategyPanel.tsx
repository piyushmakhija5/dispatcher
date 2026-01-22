'use client';

import { Target, FileText, AlertTriangle } from 'lucide-react';
import type { NegotiationState } from '@/types/dispatch';
import type { OfferEvaluation } from '../dispatch/CostBreakdown';
import { carbon } from '@/lib/themes/carbon';

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
  actualArrivalTime: string;
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
    <div className="border rounded-xl p-3 mb-3" style={{
      backgroundColor: carbon.accentBg,
      borderColor: carbon.accentBorder
    }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: carbon.accent }} />
          <span className="text-xs font-semibold" style={{ color: carbon.accent }}>Strategy</span>
        </div>
        {/* Contract source indicator */}
        {contractSource && (
          <div className="flex items-center gap-1">
            {contractSource === 'extracted' ? (
              <>
                <FileText className="w-3 h-3" style={{ color: carbon.success }} />
                <span className="text-[10px]" style={{ color: carbon.success }}>
                  {partyName || 'Contract'}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3" style={{ color: carbon.warning }} />
                <span className="text-[10px]" style={{ color: carbon.warning }}>Defaults</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actual Arrival Time */}
      {strategy.display.actualArrivalTime && (
        <div className="border rounded p-2 mb-2" style={{
          backgroundColor: carbon.bgSurface2,
          borderColor: carbon.border
        }}>
          <div className="text-[10px] mb-0.5" style={{ color: carbon.textSecondary }}>Truck arrives at:</div>
          <div className="text-sm font-mono font-semibold" style={{ color: carbon.accent }}>
            {strategy.display.actualArrivalTime}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        {/* Ideal */}
        <div className="border rounded p-2" style={{
          backgroundColor: carbon.successBg,
          borderColor: carbon.successBorder
        }}>
          <div className="font-medium mb-1" style={{ color: carbon.success }}>IDEAL</div>
          <div className="text-[10px] mb-1" style={{ color: carbon.textSecondary }}>
            {strategy.thresholds.ideal.description}
          </div>
          <div className="text-[10px] mb-1" style={{ color: carbon.textTertiary }}>
            {strategy.display.idealBefore === strategy.display.actualArrivalTime
              ? `Around ${strategy.display.idealBefore}`
              : `Before ${strategy.display.idealBefore}`}
          </div>
          <div className="font-mono" style={{ color: carbon.success }}>
            {strategy.thresholds.ideal.costImpact}
          </div>
        </div>

        {/* Acceptable */}
        <div className="border rounded p-2" style={{
          backgroundColor: carbon.accentBg,
          borderColor: carbon.accentBorder
        }}>
          <div className="font-medium mb-1" style={{ color: carbon.accent }}>OK</div>
          <div className="text-[10px] mb-1" style={{ color: carbon.textSecondary }}>
            {strategy.thresholds.acceptable.description}
          </div>
          <div className="text-[10px] mb-1" style={{ color: carbon.textTertiary }}>
            Before {strategy.display.acceptableBefore}
          </div>
          <div className="font-mono" style={{ color: carbon.accent }}>
            {strategy.thresholds.acceptable.costImpact}
          </div>
        </div>

        {/* Bad */}
        <div className="border rounded p-2" style={{
          backgroundColor: carbon.criticalBg,
          borderColor: carbon.criticalBorder
        }}>
          <div className="font-medium mb-1" style={{ color: carbon.critical }}>BAD</div>
          <div className="text-[10px] mb-1" style={{ color: carbon.textSecondary }}>
            {strategy.thresholds.problematic.description}
          </div>
          <div className="text-[10px] mb-1" style={{ color: carbon.textTertiary }}>
            After {strategy.display.acceptableBefore}
          </div>
          <div className="font-mono" style={{ color: carbon.critical }}>
            {strategy.thresholds.problematic.costImpact}
          </div>
        </div>
      </div>

      {/* Pushback Counter */}
      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span style={{ color: carbon.textTertiary }}>Pushbacks used:</span>
        <span className="font-mono" style={{ color: carbon.warning }}>
          {negotiationState?.pushbackCount || 0}/{strategy.maxPushbackAttempts}
        </span>
      </div>
    </div>
  );
}
