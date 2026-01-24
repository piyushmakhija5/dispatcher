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
import { HOS_PRESETS } from '@/types/hos';

interface SetupFormProps {
  params: SetupParams;
  onParamsChange: (params: Partial<SetupParams>) => void;
  onStart: () => void;
}

/**
 * Format minutes to human-readable string (e.g., 390 -> "6h 30m")
 */
function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
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
      <div className="flex items-center justify-center gap-2 mb-6 py-2 px-4 bg-purple-500/10 border border-purple-500/20 rounded-full w-fit mx-auto">
        <Phone className="w-4 h-4 text-purple-400" />
        <span className="text-sm text-purple-400">AI-powered voice negotiation</span>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Report Delay</h2>
          </div>
          {/* Debug mode toggle - subtle */}
          <button
            onClick={() => onParamsChange({
              communicationMode: communicationMode === 'voice' ? 'text' : 'voice'
            })}
            className="text-[10px] text-slate-600 hover:text-slate-400 flex items-center gap-1"
            title="Toggle debug text mode"
          >
            <MessageSquare className="w-3 h-3" />
            {communicationMode === 'text' ? 'text mode' : ''}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Delay Slider */}
          <div className="sm:col-span-2">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-slate-400">Delay</label>
              <span className="text-lg font-mono text-amber-400">{delayMinutes}min</span>
            </div>
            <input
              type="range"
              min="15"
              max="360"
              value={delayMinutes}
              onChange={(e) => onParamsChange({ delayMinutes: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-700 rounded-full accent-amber-500"
            />
          </div>

          {/* Original Time */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Original Time</label>
            <input
              type="time"
              value={originalAppointment}
              onChange={(e) => onParamsChange({ originalAppointment: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>

          {/* Shipment Value */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Shipment Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={shipmentValue}
                onChange={(e) => onParamsChange({ shipmentValue: Number(e.target.value) })}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* Cache Toggle */}
        <div className="mb-4 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useCachedContract}
              onChange={(e) => onParamsChange({ useCachedContract: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
            />
            <div className="flex-1">
              <span className="text-sm text-slate-300 font-medium">Use Cached Contract Analysis</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Reuse previous analysis to save ~30-40s and avoid API costs. Disable to fetch latest contract.
              </p>
            </div>
          </label>
        </div>

        {/* HOS Section */}
        <div className="mb-4 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
          {/* HOS Toggle Header */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={hosEnabled}
                onChange={(e) => onParamsChange({ hosEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
              />
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-slate-300 font-medium">Driver Hours of Service</span>
              </div>
            </label>
            {hosEnabled && (
              <button
                onClick={() => setHosExpanded(!hosExpanded)}
                className="text-slate-400 hover:text-slate-200 p-1"
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
            <p className="text-xs text-slate-500 mt-1 ml-7">
              Consider driver&apos;s legal driving hours when scheduling
            </p>
          )}

          {/* HOS Details (collapsed by default) */}
          {hosEnabled && hosExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-4">
              {/* Preset Selection */}
              <div>
                <label className="text-xs text-slate-500 mb-2 block">Quick Preset</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['fresh_shift', 'mid_shift', 'end_of_shift', 'custom'] as HOSPresetKey[]).map(
                    (preset) => (
                      <button
                        key={preset}
                        onClick={() => handlePresetChange(preset)}
                        className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                          hosPreset === preset
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {HOS_PRESETS[preset].label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Shift Status */}
              <div className="space-y-3">
                <h4 className="text-xs text-slate-400 font-medium">Current Shift Status</h4>

                {/* Remaining Drive Time */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-500">Remaining Drive Time</span>
                    <span className="text-xs font-mono text-amber-400">
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
                    className="w-full h-1 bg-slate-700 rounded-full accent-amber-500"
                  />
                </div>

                {/* Remaining Window Time */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-500">Remaining 14h Window</span>
                    <span className="text-xs font-mono text-amber-400">
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
                    className="w-full h-1 bg-slate-700 rounded-full accent-amber-500"
                  />
                </div>

                {/* Time Since Last Break */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-500">Time Since Last Break</span>
                    <span className="text-xs font-mono text-amber-400">
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
                    className="w-full h-1 bg-slate-700 rounded-full accent-amber-500"
                  />
                </div>
              </div>

              {/* Weekly Status */}
              <div className="space-y-3">
                <h4 className="text-xs text-slate-400 font-medium">Weekly Status</h4>

                <div className="grid grid-cols-2 gap-3">
                  {/* Week Rule */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Week Rule</label>
                    <select
                      value={driverHOS?.weekRule ?? '70_in_8'}
                      onChange={(e) => handleHOSChange('weekRule', e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-2 py-1.5 text-xs"
                    >
                      <option value="70_in_8">70h in 8 days</option>
                      <option value="60_in_7">60h in 7 days</option>
                    </select>
                  </div>

                  {/* Detention Rate */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Detention Rate</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                      <input
                        type="number"
                        value={driverDetentionRate}
                        onChange={(e) => onParamsChange({ driverDetentionRate: Number(e.target.value) })}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-5 pr-8 py-1.5 text-xs font-mono"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">/hr</span>
                    </div>
                  </div>
                </div>

                {/* Remaining Weekly Hours */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-500">Remaining Weekly Hours</span>
                    <span className="text-xs font-mono text-amber-400">
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
                    className="w-full h-1 bg-slate-700 rounded-full accent-amber-500"
                  />
                </div>

                {/* Short-haul Exempt */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={driverHOS?.shortHaulExempt ?? false}
                    onChange={(e) => handleHOSChange('shortHaulExempt', e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
                  />
                  <span className="text-xs text-slate-400">Short-haul exempt (no 30-min break required)</span>
                </label>
              </div>
            </div>
          )}

          {/* Collapsed HOS Summary */}
          {hosEnabled && !hosExpanded && driverHOS && (
            <div className="mt-2 ml-7 flex items-center gap-4 text-xs text-slate-500">
              <span className="px-2 py-0.5 bg-slate-800/50 rounded">
                <span className="text-amber-400">{formatMinutes(driverHOS.remainingDriveMinutes)}</span> drive
              </span>
              <span className="px-2 py-0.5 bg-slate-800/50 rounded">
                <span className="text-amber-400">{formatMinutes(driverHOS.remainingWindowMinutes)}</span> window
              </span>
              <span className="text-slate-600">({HOS_PRESETS[hosPreset].label})</span>
            </div>
          )}
        </div>

        {/* Start Button */}
        <button
          onClick={onStart}
          className={`w-full py-3 font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg ${
            communicationMode === 'voice'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-purple-500/20'
              : 'bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 text-white shadow-slate-500/20'
          }`}
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
        <div className="mt-4 p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
          {communicationMode === 'voice' ? (
            <>
              <p className="text-xs text-purple-300 font-medium mb-1">
                You&apos;ll speak as the warehouse manager
              </p>
              <p className="text-xs text-slate-500">
                Mike (AI dispatcher) will call to negotiate. Respond naturally like: &quot;This is Sarah, I can get you in at 4:15&quot;
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-amber-300 font-medium mb-1">
                Debug Mode: Text-based testing
              </p>
              <p className="text-xs text-slate-500">
                Type warehouse manager responses manually for testing
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
