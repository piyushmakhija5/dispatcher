'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Users, Clock, DollarSign } from 'lucide-react';
import type { ExtractedContractTerms } from '@/types/contract';
import { carbon } from '@/lib/themes/carbon';

interface ContractTermsDisplayProps {
  terms: ExtractedContractTerms | null;
  fileName: string | null;
  error: string | null;
  isLoading?: boolean;
}

export function ContractTermsDisplay({
  terms,
  fileName,
  error,
  isLoading = false,
}: ContractTermsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="border rounded-lg p-3 mb-3"
        style={{ backgroundColor: carbon.bgSurface2, borderColor: carbon.border }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: carbon.accent, borderTopColor: 'transparent' }}
          />
          <span className="text-xs" style={{ color: carbon.textSecondary }}>
            Loading contract terms...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !terms) {
    return (
      <div
        className="border rounded-lg p-3 mb-3"
        style={{ backgroundColor: carbon.criticalBg, borderColor: carbon.criticalBorder }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: carbon.critical }} />
          <span className="text-xs" style={{ color: carbon.critical }}>Contract Error</span>
        </div>
        <p className="text-xs mt-1" style={{ color: carbon.textSecondary }}>{error}</p>
        <p className="text-xs mt-1" style={{ color: carbon.textTertiary }}>Using default contract rules</p>
      </div>
    );
  }

  // No terms available
  if (!terms) {
    return (
      <div
        className="border rounded-lg p-3 mb-3"
        style={{ backgroundColor: carbon.warningBg, borderColor: carbon.warningBorder }}
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: carbon.warning }} />
          <span className="text-xs" style={{ color: carbon.warning }}>Using Default Rules</span>
        </div>
        <p className="text-xs mt-1" style={{ color: carbon.textSecondary }}>No contract document loaded</p>
      </div>
    );
  }

  // Get confidence color
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return carbon.success;
      case 'medium':
        return carbon.warning;
      case 'low':
        return carbon.critical;
      default:
        return carbon.textSecondary;
    }
  };

  const confidence = terms._meta?.confidence || 'unknown';
  const warnings = terms._meta?.warnings || [];
  const parties = Object.entries(terms.parties || {}).filter(([, v]) => v);

  return (
    <div
      className="border rounded-lg p-3 mb-3"
      style={{ backgroundColor: carbon.accentBg, borderColor: carbon.accentBorder }}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: carbon.accent }} />
          <span className="text-xs font-semibold" style={{ color: carbon.accent }}>
            Contract Terms
          </span>
          {confidence === 'high' ? (
            <CheckCircle className="w-3 h-3" style={{ color: carbon.success }} />
          ) : (
            <AlertTriangle className="w-3 h-3" style={{ color: carbon.warning }} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: getConfidenceColor(confidence) }}>
            {confidence.toUpperCase()}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" style={{ color: carbon.textSecondary }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: carbon.textSecondary }} />
          )}
        </div>
      </button>

      {/* File name - Always visible */}
      {fileName && (
        <div className="mt-1 text-[10px] truncate" style={{ color: carbon.textTertiary }}>
          {fileName}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Parties */}
          {parties.length > 0 && (
            <div
              className="rounded p-2"
              style={{ backgroundColor: carbon.bgSurface2 }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-3 h-3" style={{ color: carbon.accent }} />
                <span className="text-[10px] font-medium" style={{ color: carbon.accent }}>
                  Parties
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {parties.map(([role, name]) => (
                  <div key={role} className="flex justify-between">
                    <span className="capitalize" style={{ color: carbon.textTertiary }}>{role}:</span>
                    <span className="truncate ml-1" style={{ color: carbon.textPrimary }}>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Windows */}
          {terms.complianceWindows && terms.complianceWindows.length > 0 && (
            <div
              className="rounded p-2"
              style={{ backgroundColor: carbon.bgSurface2 }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3 h-3" style={{ color: carbon.accentLight }} />
                <span className="text-[10px] font-medium" style={{ color: carbon.accentLight }}>
                  Compliance Windows
                </span>
              </div>
              <div className="space-y-1 text-[10px]">
                {terms.complianceWindows.map((window, i) => (
                  <div key={i} className="flex justify-between">
                    <span style={{ color: carbon.textSecondary }}>{window.name}:</span>
                    <span style={{ color: carbon.textPrimary }}>±{window.windowMinutes} min</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delay Penalties */}
          {terms.delayPenalties && terms.delayPenalties.length > 0 && (
            <div
              className="rounded p-2"
              style={{ backgroundColor: carbon.bgSurface2 }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3 h-3" style={{ color: carbon.warning }} />
                <span className="text-[10px] font-medium" style={{ color: carbon.warning }}>
                  Delay Penalties
                </span>
              </div>
              <div className="space-y-2 text-[10px]">
                {terms.delayPenalties.map((penalty, i) => (
                  <div key={i}>
                    <div className="flex justify-between" style={{ color: carbon.textPrimary }}>
                      <span>{penalty.name}</span>
                      <span style={{ color: carbon.textTertiary }}>
                        {penalty.freeTimeMinutes / 60}hr free
                      </span>
                    </div>
                    {penalty.tiers && penalty.tiers.length > 0 && (
                      <div className="pl-2 mt-0.5 space-y-0.5">
                        {penalty.tiers.slice(0, 3).map((tier, j) => (
                          <div key={j} className="flex justify-between" style={{ color: carbon.textTertiary }}>
                            <span>
                              {tier.fromMinutes / 60}-{tier.toMinutes ? tier.toMinutes / 60 : '∞'}hr
                            </span>
                            <span style={{ color: carbon.warning }}>${tier.ratePerHour}/hr</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Party Penalties Summary */}
          {terms.partyPenalties && terms.partyPenalties.length > 0 && (
            <div
              className="rounded p-2"
              style={{ backgroundColor: carbon.bgSurface2 }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <DollarSign className="w-3 h-3" style={{ color: carbon.critical }} />
                <span className="text-[10px] font-medium" style={{ color: carbon.critical }}>
                  Party Penalties ({terms.partyPenalties.length})
                </span>
              </div>
              <div className="space-y-1 text-[10px]">
                {terms.partyPenalties.slice(0, 4).map((penalty, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="truncate" style={{ color: carbon.textSecondary }}>
                      {penalty.penaltyType}
                    </span>
                    <span style={{ color: carbon.critical }}>
                      {penalty.flatFee && `$${penalty.flatFee}`}
                      {penalty.percentage && `${penalty.percentage}%`}
                      {penalty.perOccurrence && `$${penalty.perOccurrence}/ea`}
                    </span>
                  </div>
                ))}
                {terms.partyPenalties.length > 4 && (
                  <div className="text-center" style={{ color: carbon.textTertiary }}>
                    +{terms.partyPenalties.length - 4} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div
              className="border rounded p-2"
              style={{ backgroundColor: carbon.warningBg, borderColor: carbon.warningBorder }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3 h-3" style={{ color: carbon.warning }} />
                <span className="text-[10px] font-medium" style={{ color: carbon.warning }}>
                  Warnings ({warnings.length})
                </span>
              </div>
              <div className="space-y-0.5 text-[10px]" style={{ color: carbon.warning }}>
                {warnings.slice(0, 3).map((warning, i) => (
                  <div key={i} className="truncate">• {warning}</div>
                ))}
                {warnings.length > 3 && (
                  <div style={{ color: carbon.warning }}>+{warnings.length - 3} more</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
