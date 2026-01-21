'use client';

import { ChevronRight, Wrench, CheckCircle, XCircle, Loader2, Clock, ExternalLink, Calculator, Target, FileSearch } from 'lucide-react';

export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'error';
export type ToolName = 'check_slot_cost' | 'extract_slot' | 'evaluate_offer';

interface ToolCallBlockProps {
  id: string;
  toolName: ToolName;
  description: string;
  status: ToolCallStatus;
  result?: {
    summary: string;
    data?: unknown;
  };
  error?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onViewDetails?: () => void;
}

const toolConfig: Record<ToolName, { icon: typeof Wrench; label: string }> = {
  check_slot_cost: { icon: Calculator, label: 'Cost Analysis' },
  extract_slot: { icon: FileSearch, label: 'Extract Information' },
  evaluate_offer: { icon: Target, label: 'Evaluate Offer' },
};

const statusConfig: Record<ToolCallStatus, {
  icon: typeof Clock;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  spin?: boolean;
}> = {
  pending: {
    icon: Clock,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-600/50',
    label: 'Pending'
  },
  running: {
    icon: Loader2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Running',
    spin: true
  },
  completed: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    label: 'Completed'
  },
  error: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    label: 'Error'
  },
};

export function ToolCallBlock({
  id,
  toolName,
  description,
  status,
  result,
  error,
  isExpanded,
  onToggle,
  onViewDetails,
}: ToolCallBlockProps) {
  const tool = toolConfig[toolName];
  const statusCfg = statusConfig[status];
  const StatusIcon = statusCfg.icon;
  const ToolIcon = tool.icon;

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${statusCfg.bgColor} ${statusCfg.borderColor}`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors rounded-lg"
        aria-expanded={isExpanded}
        aria-controls={`tool-content-${id}`}
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />

        <StatusIcon
          className={`w-4 h-4 ${statusCfg.color} ${statusCfg.spin ? 'animate-spin' : ''}`}
        />

        <ToolIcon className="w-4 h-4 text-slate-400" />

        <div className="flex-1 min-w-0">
          <span className="text-sm text-slate-300 font-medium">
            {tool.label}
          </span>
          {status === 'completed' && result && (
            <span className="ml-2 text-xs text-slate-500 truncate">
              {result.summary}
            </span>
          )}
        </div>

        {status === 'running' && (
          <span className="text-xs text-blue-400 font-medium animate-pulse">
            Processing...
          </span>
        )}

        {status === 'completed' && onViewDetails && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            View <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div
          id={`tool-content-${id}`}
          className="px-3 pb-2.5 pt-0"
        >
          <div className="pl-6 space-y-2">
            {/* Description */}
            <p className="text-xs text-slate-400">{description}</p>

            {/* Result (if completed) */}
            {status === 'completed' && result && (
              <div className="mt-2 p-2 bg-slate-900/50 rounded border border-slate-700/50">
                <div className="text-xs text-slate-300 font-medium mb-1">Result:</div>
                <div className="text-xs text-slate-400">{result.summary}</div>
                {result.data !== undefined && result.data !== null && (
                  <pre className="mt-2 text-[10px] text-slate-500 overflow-x-auto max-h-24">
                    {typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {/* Error (if failed) */}
            {status === 'error' && error && (
              <div className="mt-2 p-2 bg-red-900/20 rounded border border-red-500/30">
                <div className="text-xs text-red-400 font-medium">Error:</div>
                <div className="text-xs text-red-300">{error}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolCallBlock;
