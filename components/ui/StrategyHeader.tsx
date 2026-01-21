'use client';

import { Target, Clock, ChevronRight, Truck } from 'lucide-react';

interface StrategyHeaderProps {
  actualArrivalTime: string;
  idealBefore: string;
  acceptableBefore: string;
  pushbackCount: number;
  maxPushbacks: number;
  onClick: () => void;
  className?: string;
}

export function StrategyHeader({
  actualArrivalTime,
  idealBefore,
  acceptableBefore,
  pushbackCount,
  maxPushbacks,
  onClick,
  className = '',
}: StrategyHeaderProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 transition-all group ${className}`}
    >
      <div className="flex items-center justify-between">
        {/* Left: Strategy Icon + Title */}
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-slate-300">Strategy</span>
        </div>

        {/* Center: Key Info Pills */}
        <div className="flex items-center gap-3">
          {/* Arrival Time */}
          <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-1">
            <Truck className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400">{actualArrivalTime}</span>
          </div>

          {/* Ideal Window */}
          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
            <Clock className="w-3 h-3 text-emerald-400" />
            <span className="text-xs text-emerald-400">
              Ideal: {idealBefore === actualArrivalTime ? '~' : '<'}{idealBefore}
            </span>
          </div>

          {/* Acceptable Deadline */}
          <div className="hidden md:flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1">
            <span className="text-xs text-blue-400">OK: &lt;{acceptableBefore}</span>
          </div>

          {/* Pushback Counter */}
          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-1">
            <span className="text-xs font-mono text-amber-400">
              {pushbackCount}/{maxPushbacks}
            </span>
          </div>
        </div>

        {/* Right: View Details */}
        <div className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
          <span className="hidden sm:inline">Details</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  );
}

export default StrategyHeader;
