'use client';

import { ChevronRight, Brain, Loader2, Info, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

export type ThinkingBlockType = 'analysis' | 'info' | 'action' | 'decision' | 'success' | 'warning';

interface CollapsibleThinkingProps {
  id: string;
  title: string;
  content: string | string[];
  type: ThinkingBlockType;
  isExpanded: boolean;
  isActive?: boolean;
  onToggle: () => void;
}

const typeConfig: Record<ThinkingBlockType, { icon: typeof Brain; color: string; bgColor: string }> = {
  analysis: { icon: Brain, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  info: { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  action: { icon: Zap, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  decision: { icon: Brain, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  success: { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  warning: { icon: AlertTriangle, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
};

export function CollapsibleThinking({
  id,
  title,
  content,
  type,
  isExpanded,
  isActive = false,
  onToggle,
}: CollapsibleThinkingProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  const contentArray = Array.isArray(content) ? content : [content];

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        isActive
          ? 'border-amber-500/30 shadow-sm shadow-amber-500/10'
          : 'border-slate-700/50'
      } ${config.bgColor}`}
    >
      {/* Clickable Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors rounded-lg"
        aria-expanded={isExpanded}
        aria-controls={`thinking-content-${id}`}
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />

        {isActive ? (
          <Loader2 className={`w-4 h-4 ${config.color} animate-spin`} />
        ) : (
          <Icon className={`w-4 h-4 ${config.color}`} />
        )}

        <span className="flex-1 text-sm text-slate-300 font-medium truncate">
          {title}
        </span>

        {isActive && (
          <span className="flex gap-0.5">
            <span className="w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div
          id={`thinking-content-${id}`}
          className="px-3 pb-2.5 pt-0"
        >
          <div className="pl-6 space-y-1">
            {contentArray.map((line, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="text-slate-600 select-none mt-0.5">→</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CollapsibleThinking;
