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
import { carbon } from '@/lib/themes/carbon';

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
  analysis: carbon.accent,
  info: carbon.textSecondary,
  action: carbon.warning,
  decision: carbon.accent,
  success: carbon.success,
  warning: carbon.warning,
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
        className="w-full px-3 py-2 flex items-center gap-2 transition-colors"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${carbon.bgHover}40`}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: iconColor }} />
        <span className="text-xs font-medium flex-1 text-left" style={{ color: carbon.textPrimary }}>
          {title}
        </span>
        {isActive && <Loader className="w-3 h-3 animate-spin" style={{ color: carbon.warning }} />}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          style={{ color: carbon.textTertiary }}
        />
      </button>
      {isExpanded && (
        <div className="px-3 pb-2 text-xs space-y-1 border-t pt-2" style={{
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
