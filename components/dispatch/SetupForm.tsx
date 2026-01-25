'use client';

import {
  AlertTriangle,
  Phone,
  Sparkles,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import type {
  SetupParams,
  HOSPresetKey,
  DriverHOSInput,
} from '@/types/dispatch';
import { carbon } from '@/lib/themes/carbon';
import { HOS_PRESETS } from '@/types/hos';
import { formatMinutesToHuman as formatMinutes } from '@/lib/hos-engine';

interface SetupFormProps {
  params: SetupParams;
  onParamsChange: (params: Partial<SetupParams>) => void;
  onStart: () => void;
}

export function SetupForm({ params, onParamsChange, onStart }: SetupFormProps) {
  const {
    delayMinutes,
    originalAppointment,
    shipmentValue,
    communicationMode,
    useCachedContract,
    hosEnabled,
    hosPreset,
    driverHOS,
    driverDetentionRate,
  } = params;

  const [hosExpanded, setHosExpanded] = useState(false);

  // Apply HOS preset when changed
  const handlePresetChange = (presetKey: HOSPresetKey) => {
    const preset = HOS_PRESETS[presetKey];
    const newDriverHOS: DriverHOSInput = {
      remainingDriveMinutes: preset.remainingDriveMinutes,
      remainingWindowMinutes: preset.remainingWindowMinutes,
      remainingWeeklyMinutes: preset.remainingWeeklyMinutes,
      minutesSinceLastBreak: preset.minutesSinceLastBreak,
      weekRule: driverHOS?.weekRule ?? '70_in_8',
      shortHaulExempt: driverHOS?.shortHaulExempt ?? false,
    };
    onParamsChange({
      hosPreset: presetKey,
      driverHOS: newDriverHOS,
    });
  };

  // Update individual HOS field
  const handleHOSChange = (field: keyof DriverHOSInput, value: number | boolean | string) => {
    onParamsChange({
      hosPreset: 'custom' as HOSPresetKey,
      driverHOS: {
        ...(driverHOS ?? {
          remainingDriveMinutes: 660,
          remainingWindowMinutes: 840,
          remainingWeeklyMinutes: 4200,
          minutesSinceLastBreak: 0,
          weekRule: '70_in_8' as const,
          shortHaulExempt: false,
        }),
        [field]: value,
      },
    });
  };

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

        {/* Cache Toggle */}
        <div className="mb-4 p-3 rounded-lg border" style={{
          backgroundColor: carbon.input.background,
          borderColor: carbon.border
        }}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useCachedContract}
              onChange={(e) => onParamsChange({ useCachedContract: e.target.checked })}
              className="w-4 h-4 rounded"
              style={{
                accentColor: carbon.accent
              }}
            />
            <div className="flex-1">
              <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
                Use Cached Contract Analysis
              </span>
              <p className="text-xs mt-0.5" style={{ color: carbon.textTertiary }}>
                Reuse previous analysis to save ~30-40s and avoid API costs. Disable to fetch latest contract.
              </p>
            </div>
          </label>
        </div>

        {/* HOS Section */}
        <div className="mb-4 p-3 rounded-lg border" style={{
          backgroundColor: carbon.input.background,
          borderColor: carbon.border
        }}>
          {/* HOS Toggle Header */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={hosEnabled}
                onChange={(e) => onParamsChange({ hosEnabled: e.target.checked })}
                className="w-4 h-4 rounded"
                style={{ accentColor: carbon.warning }}
              />
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: carbon.warning }} />
                <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
                  Driver Hours of Service
                </span>
              </div>
            </label>
            {hosEnabled && (
              <button
                onClick={() => setHosExpanded(!hosExpanded)}
                className="p-1 transition-colors"
                style={{ color: carbon.textSecondary }}
              >
                {hosExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {hosEnabled && (
            <p className="text-xs mt-1 ml-7" style={{ color: carbon.textTertiary }}>
              Consider driver&apos;s legal driving hours when scheduling
            </p>
          )}

          {/* HOS Details (collapsed by default) */}
          {hosEnabled && hosExpanded && (
            <div className="mt-4 pt-4 space-y-4" style={{ borderTop: `1px solid ${carbon.border}` }}>
              {/* Preset Selection */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: carbon.textTertiary }}>Quick Preset</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['fresh_shift', 'mid_shift', 'end_of_shift', 'custom'] as HOSPresetKey[]).map(
                    (preset) => (
                      <button
                        key={preset}
                        onClick={() => handlePresetChange(preset)}
                        className="px-2 py-1.5 text-xs rounded-lg border transition-colors"
                        style={{
                          backgroundColor: hosPreset === preset ? carbon.warningBg : carbon.bgSurface2,
                          borderColor: hosPreset === preset ? carbon.warningBorder : carbon.border,
                          color: hosPreset === preset ? carbon.warning : carbon.textSecondary,
                        }}
                      >
                        {HOS_PRESETS[preset].label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Shift Status */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium" style={{ color: carbon.textSecondary }}>Current Shift Status</h4>

                {/* Remaining Drive Time */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Remaining Drive Time</span>
                    <span className="text-xs font-mono" style={{ color: carbon.warning }}>
                      {formatMinutes(driverHOS?.remainingDriveMinutes ?? 660)} / 11h
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="660"
                    step="15"
                    value={driverHOS?.remainingDriveMinutes ?? 660}
                    onChange={(e) => handleHOSChange('remainingDriveMinutes', Number(e.target.value))}
                    className="w-full h-1 rounded-full"
                    style={{ backgroundColor: carbon.bgSurface2, accentColor: carbon.warning }}
                  />
                </div>

                {/* Remaining Window Time */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Remaining 14h Window</span>
                    <span className="text-xs font-mono" style={{ color: carbon.warning }}>
                      {formatMinutes(driverHOS?.remainingWindowMinutes ?? 840)} / 14h
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="840"
                    step="15"
                    value={driverHOS?.remainingWindowMinutes ?? 840}
                    onChange={(e) => handleHOSChange('remainingWindowMinutes', Number(e.target.value))}
                    className="w-full h-1 rounded-full"
                    style={{ backgroundColor: carbon.bgSurface2, accentColor: carbon.warning }}
                  />
                </div>

                {/* Time Since Last Break */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Time Since Last Break</span>
                    <span className="text-xs font-mono" style={{ color: carbon.warning }}>
                      {formatMinutes(driverHOS?.minutesSinceLastBreak ?? 0)} / 8h
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="480"
                    step="15"
                    value={driverHOS?.minutesSinceLastBreak ?? 0}
                    onChange={(e) => handleHOSChange('minutesSinceLastBreak', Number(e.target.value))}
                    className="w-full h-1 rounded-full"
                    style={{ backgroundColor: carbon.bgSurface2, accentColor: carbon.warning }}
                  />
                </div>
              </div>

              {/* Weekly Status */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium" style={{ color: carbon.textSecondary }}>Weekly Status</h4>

                <div className="grid grid-cols-2 gap-3">
                  {/* Week Rule */}
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: carbon.textTertiary }}>Week Rule</label>
                    <select
                      value={driverHOS?.weekRule ?? '70_in_8'}
                      onChange={(e) => handleHOSChange('weekRule', e.target.value)}
                      className="w-full rounded-lg px-2 py-1.5 text-xs border"
                      style={{
                        backgroundColor: carbon.bgSurface2,
                        borderColor: carbon.border,
                        color: carbon.textPrimary,
                      }}
                    >
                      <option value="70_in_8">70h in 8 days</option>
                      <option value="60_in_7">60h in 7 days</option>
                    </select>
                  </div>

                  {/* Detention Rate */}
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: carbon.textTertiary }}>Detention Rate</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: carbon.textTertiary }}>$</span>
                      <input
                        type="number"
                        value={driverDetentionRate}
                        onChange={(e) => onParamsChange({ driverDetentionRate: Number(e.target.value) })}
                        className="w-full rounded-lg pl-5 pr-8 py-1.5 text-xs font-mono border"
                        style={{
                          backgroundColor: carbon.bgSurface2,
                          borderColor: carbon.border,
                          color: carbon.textPrimary,
                        }}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: carbon.textTertiary }}>/hr</span>
                    </div>
                  </div>
                </div>

                {/* Remaining Weekly Hours */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Remaining Weekly Hours</span>
                    <span className="text-xs font-mono" style={{ color: carbon.warning }}>
                      {formatMinutes(driverHOS?.remainingWeeklyMinutes ?? 4200)} /{' '}
                      {driverHOS?.weekRule === '60_in_7' ? '60h' : '70h'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={driverHOS?.weekRule === '60_in_7' ? 3600 : 4200}
                    step="30"
                    value={driverHOS?.remainingWeeklyMinutes ?? 4200}
                    onChange={(e) => handleHOSChange('remainingWeeklyMinutes', Number(e.target.value))}
                    className="w-full h-1 rounded-full"
                    style={{ backgroundColor: carbon.bgSurface2, accentColor: carbon.warning }}
                  />
                </div>

                {/* Short-haul Exempt */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={driverHOS?.shortHaulExempt ?? false}
                    onChange={(e) => handleHOSChange('shortHaulExempt', e.target.checked)}
                    className="w-3.5 h-3.5 rounded"
                    style={{ accentColor: carbon.warning }}
                  />
                  <span className="text-xs" style={{ color: carbon.textSecondary }}>Short-haul exempt (no 30-min break required)</span>
                </label>
              </div>
            </div>
          )}

          {/* Collapsed HOS Summary */}
          {hosEnabled && !hosExpanded && driverHOS && (
            <div className="mt-2 ml-7 flex items-center gap-4 text-xs" style={{ color: carbon.textTertiary }}>
              <span className="px-2 py-0.5 rounded" style={{ backgroundColor: carbon.bgSurface2 }}>
                <span style={{ color: carbon.warning }}>{formatMinutes(driverHOS.remainingDriveMinutes)}</span> drive
              </span>
              <span className="px-2 py-0.5 rounded" style={{ backgroundColor: carbon.bgSurface2 }}>
                <span style={{ color: carbon.warning }}>{formatMinutes(driverHOS.remainingWindowMinutes)}</span> window
              </span>
              <span style={{ color: carbon.textMuted }}>({HOS_PRESETS[hosPreset].label})</span>
            </div>
          )}
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
