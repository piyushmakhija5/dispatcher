'use client';

import {
  Calculator,
  FileText,
  Zap,
  Target,
  CheckCircle,
  AlertTriangle,
  Brain,
  ChevronDown,
  Loader,
} from 'lucide-react';
import type { ThinkingBlockProps, ThinkingBlockType } from '@/types/dispatch';

const ICONS: Record<ThinkingBlockType | 'default', typeof Brain> = {
  analysis: Calculator,
  info: FileText,
  action: Zap,
  decision: Target,
  success: CheckCircle,
  warning: AlertTriangle,
  default: Brain,
};

const COLORS: Record<ThinkingBlockType | 'default', string> = {
  analysis: 'text-blue-400',
  info: 'text-slate-400',
  action: 'text-amber-400',
  decision: 'text-purple-400',
  success: 'text-emerald-400',
  warning: 'text-orange-400',
  default: 'text-slate-400',
};

export function ThinkingBlock({
  type,
  title,
  content,
  isExpanded,
  onToggle,
  isActive,
}: ThinkingBlockProps) {
  const Icon = ICONS[type] || ICONS.default;
  const colorClass = COLORS[type] || COLORS.default;

  return (
    <div
      className={`bg-slate-900/30 border rounded-lg overflow-hidden transition-all ${
        isActive
          ? 'border-amber-500/50 shadow-lg shadow-amber-500/10'
          : 'border-slate-800/50'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5"
      >
        <Icon className={`w-3.5 h-3.5 ${colorClass} flex-shrink-0`} />
        <span className="text-xs font-medium flex-1 text-left">{title}</span>
        {isActive && <Loader className="w-3 h-3 text-amber-400 animate-spin" />}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isExpanded && (
        <div className="px-3 pb-2 text-xs text-slate-400 space-y-1 border-t border-white/5 pt-2">
          {Array.isArray(content) ? (
            content.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-slate-600 select-none">→</span>
                <span>{line}</span>
              </div>
            ))
          ) : (
            <p>{content}</p>
          )}
        </div>
      )}
    </div>
  );
}
