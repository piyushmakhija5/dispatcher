'use client';

import { Target, FileText, AlertTriangle, Clock } from 'lucide-react';
import type { NegotiationState } from '@/types/dispatch';
import type { OfferEvaluation } from '../dispatch/CostBreakdown';
import type { NegotiationStrategy } from '@/lib/negotiation-strategy';
import { carbon } from '@/lib/themes/carbon';

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

      {/* Actual Arrival Time + HOS Indicator */}
      <div className="flex gap-2 mb-2">
        {/* Arrival Time */}
        {strategy.display.actualArrivalTime && (
          <div className="flex-1 border rounded p-2" style={{
            backgroundColor: carbon.bgSurface2,
            borderColor: carbon.border
          }}>
            <div className="text-[10px] mb-0.5" style={{ color: carbon.textSecondary }}>Truck arrives at:</div>
            <div className="text-sm font-mono font-semibold" style={{ color: carbon.accent }}>
              {strategy.display.actualArrivalTime}
            </div>
          </div>
        )}

        {/* HOS Status Indicator */}
        {strategy.hosConstraints && (
          <div className="flex-1 border rounded p-2" style={{
            backgroundColor: carbon.warningBg,
            borderColor: carbon.warningBorder
          }}>
            <div className="flex items-center gap-1 text-[10px] mb-0.5" style={{ color: carbon.warning }}>
              <Clock className="w-3 h-3" />
              <span>HOS Limit</span>
            </div>
            <div className="text-sm font-mono font-semibold" style={{ color: carbon.warning }}>
              {strategy.hosConstraints.latestFeasibleTime}
            </div>
          </div>
        )}
      </div>

      {/* HOS Warning Banner */}
      {strategy.hosConstraints && (
        <div className="border rounded p-2 mb-2 flex items-start gap-2" style={{
          backgroundColor: carbon.warningBg,
          borderColor: carbon.warningBorder
        }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: carbon.warning }} />
          <div className="text-[10px]">
            <span className="font-medium" style={{ color: carbon.warning }}>
              Driver&apos;s {strategy.hosConstraints.bindingConstraint.replace('_', ' ')} constraint:{' '}
            </span>
            <span style={{ color: carbon.textSecondary }}>
              {formatMinutes(strategy.hosConstraints.remainingWindowMinutes)} remaining.
              {strategy.hosConstraints.requiresNextShift
                ? ` Next shift available at ${strategy.hosConstraints.nextShiftEarliestTime}.`
                : ` Must complete by ${strategy.hosConstraints.latestFeasibleTime}.`}
            </span>
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
