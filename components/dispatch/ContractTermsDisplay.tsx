'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Users, Clock, DollarSign } from 'lucide-react';
import type { ExtractedContractTerms } from '@/types/contract';

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
      <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Loading contract terms...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !terms) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-xs text-red-400">Contract Error</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">{error}</p>
        <p className="text-xs text-slate-500 mt-1">Using default contract rules</p>
      </div>
    );
  }

  // No terms available
  if (!terms) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400">Using Default Rules</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">No contract document loaded</p>
      </div>
    );
  }

  // Get confidence color
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-emerald-400';
      case 'medium':
        return 'text-amber-400';
      case 'low':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const confidence = terms._meta?.confidence || 'unknown';
  const warnings = terms._meta?.warnings || [];
  const parties = Object.entries(terms.parties || {}).filter(([, v]) => v);

  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 mb-3">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-300">Contract Terms</span>
          {confidence === 'high' ? (
            <CheckCircle className="w-3 h-3 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${getConfidenceColor(confidence)}`}>
            {confidence.toUpperCase()}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* File name - Always visible */}
      {fileName && (
        <div className="mt-1 text-[10px] text-slate-500 truncate">
          {fileName}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Parties */}
          {parties.length > 0 && (
            <div className="bg-slate-800/30 rounded p-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-medium text-cyan-400">Parties</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {parties.map(([role, name]) => (
                  <div key={role} className="flex justify-between">
                    <span className="text-slate-500 capitalize">{role}:</span>
                    <span className="text-slate-300 truncate ml-1">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Windows */}
          {terms.complianceWindows && terms.complianceWindows.length > 0 && (
            <div className="bg-slate-800/30 rounded p-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-medium text-blue-400">Compliance Windows</span>
              </div>
              <div className="space-y-1 text-[10px]">
                {terms.complianceWindows.map((window, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-400">{window.name}:</span>
                    <span className="text-slate-300">±{window.windowMinutes} min</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delay Penalties */}
          {terms.delayPenalties && terms.delayPenalties.length > 0 && (
            <div className="bg-slate-800/30 rounded p-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-medium text-amber-400">Delay Penalties</span>
              </div>
              <div className="space-y-2 text-[10px]">
                {terms.delayPenalties.map((penalty, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-slate-300">
                      <span>{penalty.name}</span>
                      <span className="text-slate-500">
                        {penalty.freeTimeMinutes / 60}hr free
                      </span>
                    </div>
                    {penalty.tiers && penalty.tiers.length > 0 && (
                      <div className="pl-2 mt-0.5 space-y-0.5">
                        {penalty.tiers.slice(0, 3).map((tier, j) => (
                          <div key={j} className="flex justify-between text-slate-500">
                            <span>
                              {tier.fromMinutes / 60}-{tier.toMinutes ? tier.toMinutes / 60 : '∞'}hr
                            </span>
                            <span className="text-amber-400/70">${tier.ratePerHour}/hr</span>
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
            <div className="bg-slate-800/30 rounded p-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <DollarSign className="w-3 h-3 text-red-400" />
                <span className="text-[10px] font-medium text-red-400">
                  Party Penalties ({terms.partyPenalties.length})
                </span>
              </div>
              <div className="space-y-1 text-[10px]">
                {terms.partyPenalties.slice(0, 4).map((penalty, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-400 truncate">{penalty.penaltyType}</span>
                    <span className="text-red-400/70">
                      {penalty.flatFee && `$${penalty.flatFee}`}
                      {penalty.percentage && `${penalty.percentage}%`}
                      {penalty.perOccurrence && `$${penalty.perOccurrence}/ea`}
                    </span>
                  </div>
                ))}
                {terms.partyPenalties.length > 4 && (
                  <div className="text-slate-500 text-center">
                    +{terms.partyPenalties.length - 4} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-medium text-amber-400">
                  Warnings ({warnings.length})
                </span>
              </div>
              <div className="space-y-0.5 text-[10px] text-amber-400/70">
                {warnings.slice(0, 3).map((warning, i) => (
                  <div key={i} className="truncate">• {warning}</div>
                ))}
                {warnings.length > 3 && (
                  <div className="text-amber-500">+{warnings.length - 3} more</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
