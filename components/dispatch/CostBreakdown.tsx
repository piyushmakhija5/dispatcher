'use client';

import type { TotalCostImpactResult } from '@/types/cost';

/** Quality rating from offer evaluation */
type OfferQuality = 'IDEAL' | 'ACCEPTABLE' | 'SUBOPTIMAL' | 'UNACCEPTABLE' | 'UNKNOWN';

interface OfferEvaluation {
  quality: OfferQuality;
  shouldAccept: boolean;
  shouldPushback: boolean;
  reason: string;
}

interface CostBreakdownProps {
  costAnalysis: TotalCostImpactResult | null;
  evaluation: OfferEvaluation | null;
}

const QUALITY_COLORS: Record<OfferQuality, string> = {
  IDEAL: 'text-emerald-400',
  ACCEPTABLE: 'text-blue-400',
  SUBOPTIMAL: 'text-amber-400',
  UNACCEPTABLE: 'text-red-400',
  UNKNOWN: 'text-slate-400',
};

export function CostBreakdown({ costAnalysis, evaluation }: CostBreakdownProps) {
  if (!costAnalysis) return null;

  const totalCost = costAnalysis.totalCost;
  const dwellBreakdown = costAnalysis.calculations?.dwellTime?.breakdown || [];
  const otifBreakdown = costAnalysis.calculations?.otif?.breakdown || [];

  const getCostColor = (cost: number) => {
    if (cost > 200) return 'text-red-400';
    if (cost > 100) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">Live Cost Impact</span>
        <span className={`text-sm font-bold ${getCostColor(totalCost)}`}>
          ${totalCost}
        </span>
      </div>

      {/* Dwell Time Breakdown */}
      {dwellBreakdown.length > 0 && (
        <div className="text-xs text-slate-500 space-y-1">
          <div className="font-medium text-slate-400">Dwell Time:</div>
          {dwellBreakdown.map((item, i) => (
            <div key={i} className="flex justify-between pl-3">
              <span>
                {item.hours}h × ${item.rate}/hr
              </span>
              <span className="text-amber-400">${item.cost}</span>
            </div>
          ))}
        </div>
      )}

      {/* OTIF Penalties Breakdown */}
      {otifBreakdown.length > 0 && (
        <div className="text-xs text-slate-500 space-y-1 mt-2">
          <div className="font-medium text-slate-400">OTIF Penalties:</div>
          {otifBreakdown.map((item, i) => (
            <div key={i} className="flex justify-between pl-3">
              <span>{item.description}</span>
              <span className="text-red-400">${item.cost}</span>
            </div>
          ))}
        </div>
      )}

      {/* Evaluation */}
      {evaluation && (
        <div className="mt-2 pt-2 border-t border-slate-700/30 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Decision:</span>
            <span className={`font-medium ${QUALITY_COLORS[evaluation.quality]}`}>
              {evaluation.quality}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export type { OfferEvaluation, OfferQuality };
