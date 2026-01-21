'use client';

import { DollarSign, ExternalLink } from 'lucide-react';

export type OfferQuality = 'IDEAL' | 'ACCEPTABLE' | 'SUBOPTIMAL' | 'UNACCEPTABLE' | 'UNKNOWN';

interface CostBadgeProps {
  totalCost: number;
  quality: OfferQuality;
  onClick?: () => void;
  showViewLink?: boolean;
  className?: string;
}

const qualityConfig: Record<OfferQuality, { bg: string; border: string; text: string; label: string }> = {
  IDEAL: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    label: 'Ideal',
  },
  ACCEPTABLE: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    label: 'OK',
  },
  SUBOPTIMAL: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    label: 'Suboptimal',
  },
  UNACCEPTABLE: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    label: 'Bad',
  },
  UNKNOWN: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    label: '—',
  },
};

export function CostBadge({
  totalCost,
  quality,
  onClick,
  showViewLink = true,
  className = '',
}: CostBadgeProps) {
  const config = qualityConfig[quality];

  const content = (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${config.bg} ${config.border} ${className}`}
    >
      <DollarSign className={`w-3.5 h-3.5 ${config.text}`} />
      <span className={`text-sm font-mono font-medium ${config.text}`}>
        ${totalCost.toLocaleString()}
      </span>
      <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.text}`}>
        {config.label}
      </span>
      {onClick && showViewLink && (
        <ExternalLink className="w-3 h-3 text-slate-500" />
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="hover:opacity-80 transition-opacity"
      >
        {content}
      </button>
    );
  }

  return content;
}

export default CostBadge;
