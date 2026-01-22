'use client';

import {
  AlertTriangle,
  Phone,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import type {
  SetupParams,
} from '@/types/dispatch';
import { carbon } from '@/lib/themes/carbon';

interface SetupFormProps {
  params: SetupParams;
  onParamsChange: (params: Partial<SetupParams>) => void;
  onStart: () => void;
}

export function SetupForm({ params, onParamsChange, onStart }: SetupFormProps) {
  const { delayMinutes, originalAppointment, shipmentValue, communicationMode } = params;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-6 py-2 px-4 rounded-full w-fit mx-auto border" style={{
        backgroundColor: carbon.accentBg,
        borderColor: carbon.accentBorder
      }}>
        <Phone className="w-4 h-4" style={{ color: carbon.accent }} />
        <span className="text-sm" style={{ color: carbon.accent }}>AI-powered voice negotiation</span>
      </div>

      <div className="rounded-2xl p-6 border" style={{
        backgroundColor: `${carbon.bgSurface1}4d`,
        borderColor: carbon.border
      }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" style={{ color: carbon.warning }} />
            <h2 className="text-lg font-semibold" style={{ color: carbon.textPrimary }}>Report Delay</h2>
          </div>
          {/* Debug mode toggle - subtle */}
          <button
            onClick={() => onParamsChange({
              communicationMode: communicationMode === 'voice' ? 'text' : 'voice'
            })}
            className="text-[10px] flex items-center gap-1 transition-colors"
            title="Toggle debug text mode"
            style={{ color: carbon.textMuted }}
            onMouseEnter={(e) => e.currentTarget.style.color = carbon.textSecondary}
            onMouseLeave={(e) => e.currentTarget.style.color = carbon.textMuted}
          >
            <MessageSquare className="w-3 h-3" />
            {communicationMode === 'text' ? 'text mode' : ''}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Delay Slider */}
          <div className="sm:col-span-2">
            <div className="flex justify-between mb-2">
              <label className="text-sm" style={{ color: carbon.textSecondary }}>Delay</label>
              <span className="text-lg font-mono" style={{ color: carbon.warning }}>{delayMinutes}min</span>
            </div>
            <input
              type="range"
              min="15"
              max="360"
              value={delayMinutes}
              onChange={(e) => onParamsChange({ delayMinutes: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full"
              style={{
                backgroundColor: carbon.bgSurface2,
                accentColor: carbon.warning
              }}
            />
          </div>

          {/* Original Time */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: carbon.textTertiary }}>Original Time</label>
            <input
              type="time"
              value={originalAppointment}
              onChange={(e) => onParamsChange({ originalAppointment: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono border"
              style={{
                backgroundColor: carbon.input.background,
                borderColor: carbon.input.border,
                color: carbon.input.color
              }}
            />
          </div>

          {/* Shipment Value */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: carbon.textTertiary }}>Shipment Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: carbon.textTertiary }}>$</span>
              <input
                type="number"
                value={shipmentValue}
                onChange={(e) => onParamsChange({ shipmentValue: Number(e.target.value) })}
                className="w-full rounded-lg pl-7 pr-3 py-2 text-sm font-mono border"
                style={{
                  backgroundColor: carbon.input.background,
                  borderColor: carbon.input.border,
                  color: carbon.input.color
                }}
              />
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={onStart}
          className="w-full py-3 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
          style={
            communicationMode === 'voice'
              ? {
                  backgroundColor: carbon.accent,
                  color: 'white',
                  boxShadow: `0 4px 12px ${carbon.accentBg}`
                }
              : {
                  backgroundColor: carbon.textTertiary,
                  color: carbon.textPrimary,
                  boxShadow: `0 4px 12px rgba(0, 0, 0, 0.2)`
                }
          }
          onMouseEnter={(e) => {
            if (communicationMode === 'voice') {
              e.currentTarget.style.backgroundColor = carbon.accentLight;
            } else {
              e.currentTarget.style.backgroundColor = carbon.textSecondary;
            }
          }}
          onMouseLeave={(e) => {
            if (communicationMode === 'voice') {
              e.currentTarget.style.backgroundColor = carbon.accent;
            } else {
              e.currentTarget.style.backgroundColor = carbon.textTertiary;
            }
          }}
        >
          {communicationMode === 'voice' ? (
            <>
              <Phone className="w-4 h-4" />
              Start Voice Call
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Start Text Mode (Debug)
            </>
          )}
        </button>

        {/* Help Text */}
        <div className="mt-4 p-3 rounded-lg border" style={{
          backgroundColor: communicationMode === 'voice' ? carbon.accentBg : carbon.warningBg,
          borderColor: communicationMode === 'voice' ? carbon.accentBorder : carbon.warningBorder
        }}>
          {communicationMode === 'voice' ? (
            <>
              <p className="text-xs font-medium mb-1" style={{ color: carbon.accent }}>
                You&apos;ll speak as the warehouse manager
              </p>
              <p className="text-xs" style={{ color: carbon.textTertiary }}>
                Mike (AI dispatcher) will call to negotiate. Respond naturally like: &quot;This is Sarah, I can get you in at 4:15&quot;
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium mb-1" style={{ color: carbon.warning }}>
                Debug Mode: Text-based testing
              </p>
              <p className="text-xs" style={{ color: carbon.textTertiary }}>
                Type warehouse manager responses manually for testing
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
