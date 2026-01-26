'use client';

import {
  Calculator,
  FileText,
  Zap,
  Target,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Brain,
  ChevronDown,
  Loader,
} from 'lucide-react';
import type { ThinkingBlockProps, ThinkingBlockType } from '@/types/dispatch';
import { carbon } from '@/lib/themes/carbon';

const ICONS: Record<ThinkingBlockType | 'default', typeof Brain> = {
  analysis: Calculator,
  info: FileText,
  action: Zap,
  decision: Target,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  default: Brain,
};

const COLORS: Record<ThinkingBlockType | 'default', string> = {
  analysis: carbon.accent,
  info: carbon.textSecondary,
  action: carbon.warning,
  decision: carbon.accent,
  success: carbon.success,
  warning: carbon.warning,
  error: '#ef4444', // Red for errors
  default: carbon.textSecondary,
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
  const iconColor = COLORS[type] || COLORS.default;

  return (
    <div
      className="border rounded-lg overflow-hidden transition-all"
      style={{
        backgroundColor: `${carbon.bgSurface1}4d`,
        borderColor: isActive ? `${carbon.warning}80` : carbon.borderSubtle,
        boxShadow: isActive ? `0 0 12px ${carbon.warningBg}` : 'none'
      }}
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 transition-colors"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${carbon.bgHover}40`}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: iconColor }} />
        <span className="text-sm font-medium flex-1 text-left" style={{ color: carbon.textPrimary }}>
          {title}
        </span>
        {isActive && <Loader className="w-3.5 h-3.5 animate-spin" style={{ color: carbon.warning }} />}
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          style={{ color: carbon.textTertiary }}
        />
      </button>
      {isExpanded && (
        <div className="px-4 pb-3 text-sm space-y-1.5 border-t pt-2.5" style={{
          color: carbon.textSecondary,
          borderColor: carbon.borderSubtle
        }}>
          {Array.isArray(content) ? (
            content.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="select-none" style={{ color: carbon.textMuted }}>→</span>
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
