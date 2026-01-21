'use client';

import { useEffect, useCallback } from 'react';
import { X, Copy, Download, BarChart3, Target, FileCheck, ChevronLeft } from 'lucide-react';
import type { TotalCostImpactResult } from '@/types/cost';
import type { NegotiationState } from '@/types/dispatch';

export type ArtifactType = 'cost-breakdown' | 'strategy' | 'agreement';

/** Quality rating from offer evaluation */
type OfferQuality = 'IDEAL' | 'ACCEPTABLE' | 'SUBOPTIMAL' | 'UNACCEPTABLE' | 'UNKNOWN';

interface OfferEvaluation {
  quality: OfferQuality;
  shouldAccept: boolean;
  shouldPushback: boolean;
  reason: string;
}

interface StrategyThreshold {
  maxMinutes: number;
  description: string;
  costImpact: string;
}

interface StrategyDisplay {
  idealBefore: string;
  acceptableBefore: string;
  worstCaseArrival: string;
  actualArrivalTime: string;
}

interface NegotiationStrategy {
  thresholds: {
    ideal: StrategyThreshold;
    acceptable: StrategyThreshold;
    problematic: StrategyThreshold;
  };
  costThresholds: {
    ideal: number;
    acceptable: number;
    reluctant: number;
  };
  maxPushbackAttempts: number;
  display: StrategyDisplay;
}

interface CostBreakdownData {
  costAnalysis: TotalCostImpactResult;
  evaluation?: OfferEvaluation | null;
}

interface StrategyData {
  strategy: NegotiationStrategy;
  negotiationState: NegotiationState;
}

interface AgreementData {
  text: string;
  originalTime: string;
  newTime: string;
  dock: string;
  delayMinutes: number;
  totalCost: number;
}

type ArtifactData = CostBreakdownData | StrategyData | AgreementData;

interface ArtifactPanelProps {
  isOpen: boolean;
  onClose: () => void;
  type: ArtifactType | null;
  data: unknown;  // Accept unknown, will be validated/cast in render
  onExport?: () => void;
}

const QUALITY_COLORS: Record<OfferQuality, string> = {
  IDEAL: 'text-emerald-400',
  ACCEPTABLE: 'text-blue-400',
  SUBOPTIMAL: 'text-amber-400',
  UNACCEPTABLE: 'text-red-400',
  UNKNOWN: 'text-slate-400',
};

const artifactConfig: Record<ArtifactType, { icon: typeof BarChart3; title: string; color: string }> = {
  'cost-breakdown': { icon: BarChart3, title: 'Cost Breakdown', color: 'text-amber-400' },
  strategy: { icon: Target, title: 'Negotiation Strategy', color: 'text-purple-400' },
  agreement: { icon: FileCheck, title: 'Final Agreement', color: 'text-emerald-400' },
};

function CostBreakdownContent({ data }: { data: CostBreakdownData }) {
  const { costAnalysis, evaluation } = data;
  const totalCost = costAnalysis.totalCost;
  const dwellBreakdown = costAnalysis.calculations?.dwellTime?.breakdown || [];
  const otifBreakdown = costAnalysis.calculations?.otif?.breakdown || [];

  const getCostColor = (cost: number) => {
    if (cost > 200) return 'text-red-400';
    if (cost > 100) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className="space-y-4">
      {/* Total Cost Header */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="text-sm text-slate-400 mb-1">Total Cost Impact</div>
        <div className={`text-3xl font-bold ${getCostColor(totalCost)}`}>
          ${totalCost.toLocaleString()}
        </div>
        {evaluation && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-500">Quality:</span>
            <span className={`text-sm font-medium ${QUALITY_COLORS[evaluation.quality]}`}>
              {evaluation.quality}
            </span>
          </div>
        )}
      </div>

      {/* Dwell Time Breakdown */}
      {dwellBreakdown.length > 0 && (
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
          <div className="text-sm font-medium text-slate-300 mb-2">Dwell Time Charges</div>
          <div className="space-y-2">
            {dwellBreakdown.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-slate-400">
                  {item.hours} hours @ ${item.rate}/hr
                </span>
                <span className="text-amber-400 font-mono">${item.cost}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OTIF Penalties Breakdown */}
      {otifBreakdown.length > 0 && (
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
          <div className="text-sm font-medium text-slate-300 mb-2">OTIF Penalties</div>
          <div className="space-y-2">
            {otifBreakdown.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-slate-400">{item.description}</span>
                <span className="text-red-400 font-mono">${item.cost}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation Reason */}
      {evaluation && evaluation.reason && (
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
          <div className="text-sm font-medium text-slate-300 mb-1">Decision Reasoning</div>
          <p className="text-sm text-slate-400">{evaluation.reason}</p>
        </div>
      )}
    </div>
  );
}

function StrategyContent({ data }: { data: StrategyData }) {
  const { strategy, negotiationState } = data;

  return (
    <div className="space-y-4">
      {/* Arrival Time */}
      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
        <div className="text-sm text-cyan-300 mb-1">Truck Arrival Time</div>
        <div className="text-2xl font-bold text-cyan-400 font-mono">
          {strategy.display.actualArrivalTime}
        </div>
      </div>

      {/* Thresholds */}
      <div className="space-y-3">
        {/* Ideal */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-emerald-400 font-medium">IDEAL</span>
            <span className="text-emerald-400 font-mono text-sm">
              {strategy.thresholds.ideal.costImpact}
            </span>
          </div>
          <p className="text-sm text-slate-400 mb-1">{strategy.thresholds.ideal.description}</p>
          <p className="text-xs text-slate-500">
            {strategy.display.idealBefore === strategy.display.actualArrivalTime
              ? `Around ${strategy.display.idealBefore}`
              : `Before ${strategy.display.idealBefore}`}
          </p>
        </div>

        {/* Acceptable */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-400 font-medium">ACCEPTABLE</span>
            <span className="text-blue-400 font-mono text-sm">
              {strategy.thresholds.acceptable.costImpact}
            </span>
          </div>
          <p className="text-sm text-slate-400 mb-1">{strategy.thresholds.acceptable.description}</p>
          <p className="text-xs text-slate-500">Before {strategy.display.acceptableBefore}</p>
        </div>

        {/* Problematic */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-400 font-medium">PROBLEMATIC</span>
            <span className="text-red-400 font-mono text-sm">
              {strategy.thresholds.problematic.costImpact}
            </span>
          </div>
          <p className="text-sm text-slate-400 mb-1">{strategy.thresholds.problematic.description}</p>
          <p className="text-xs text-slate-500">After {strategy.display.acceptableBefore}</p>
        </div>
      </div>

      {/* Pushback Counter */}
      <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Pushbacks Used</span>
          <span className="text-amber-400 font-mono font-medium">
            {negotiationState?.pushbackCount || 0} / {strategy.maxPushbackAttempts}
          </span>
        </div>
        <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{
              width: `${((negotiationState?.pushbackCount || 0) / strategy.maxPushbackAttempts) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function AgreementContent({ data, onExport }: { data: AgreementData; onExport?: () => void }) {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-500 mb-1">Original Time</div>
          <div className="text-sm font-mono text-slate-300">{data.originalTime}</div>
        </div>
        <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
          <div className="text-xs text-emerald-400 mb-1">New Time</div>
          <div className="text-sm font-mono text-emerald-300">{data.newTime}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-500 mb-1">Dock</div>
          <div className="text-sm font-mono text-slate-300">{data.dock}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-500 mb-1">Cost Impact</div>
          <div className="text-sm font-mono text-amber-400">${data.totalCost}</div>
        </div>
      </div>

      {/* Agreement Text */}
      <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
        <div className="text-sm font-medium text-slate-300 mb-2">Agreement Details</div>
        <pre className="text-sm text-slate-400 whitespace-pre-wrap font-sans">
          {data.text}
        </pre>
      </div>

      {/* Export Button */}
      {onExport && (
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2.5 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export as CSV
        </button>
      )}
    </div>
  );
}

export function ArtifactPanel({ isOpen, onClose, type, data, onExport }: ArtifactPanelProps) {
  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!type) return null;

  const config = artifactConfig[type];
  const Icon = config.icon;

  // Type guards for data
  const isAgreementData = (d: unknown): d is AgreementData =>
    typeof d === 'object' && d !== null && 'text' in d;

  const isCostBreakdownData = (d: unknown): d is CostBreakdownData =>
    typeof d === 'object' && d !== null && 'costAnalysis' in d;

  const isStrategyData = (d: unknown): d is StrategyData =>
    typeof d === 'object' && d !== null && 'strategy' in d;

  const handleCopy = () => {
    if (isAgreementData(data)) {
      navigator.clipboard.writeText(data.text);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[420px] bg-slate-900 border-l border-slate-700 z-50 flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 -ml-1 hover:bg-slate-800 rounded transition-colors sm:hidden"
            >
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            </button>
            <Icon className={`w-5 h-5 ${config.color}`} />
            <h2 className="font-semibold text-slate-200">{config.title}</h2>
          </div>
          <div className="flex items-center gap-1">
            {type === 'agreement' && (
              <button
                onClick={handleCopy}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Copy"
              >
                <Copy className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded transition-colors hidden sm:block"
              title="Close (Esc)"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {type === 'cost-breakdown' && isCostBreakdownData(data) && (
            <CostBreakdownContent data={data} />
          )}
          {type === 'strategy' && isStrategyData(data) && (
            <StrategyContent data={data} />
          )}
          {type === 'agreement' && isAgreementData(data) && (
            <AgreementContent data={data} onExport={onExport} />
          )}
        </div>
      </div>
    </>
  );
}

export default ArtifactPanel;
