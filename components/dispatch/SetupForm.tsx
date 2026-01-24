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

interface SetupFormProps {
  params: SetupParams;
  onParamsChange: (params: Partial<SetupParams>) => void;
  onStart: () => void;
}

export function SetupForm({ params, onParamsChange, onStart }: SetupFormProps) {
  const { delayMinutes, originalAppointment, shipmentValue, communicationMode, useCachedContract } = params;

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
