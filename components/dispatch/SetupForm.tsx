'use client';

import {
  AlertTriangle,
  Target,
  MessageSquare,
  Phone,
  Sparkles,
} from 'lucide-react';
import type {
  CommunicationMode,
  Retailer,
  SetupParams,
} from '@/types/dispatch';

const RETAILERS: Retailer[] = ['Walmart', 'Target', 'Amazon', 'Costco', 'Kroger'];

interface SetupFormProps {
  params: SetupParams;
  onParamsChange: (params: Partial<SetupParams>) => void;
  onStart: () => void;
}

export function SetupForm({ params, onParamsChange, onStart }: SetupFormProps) {
  const { delayMinutes, originalAppointment, shipmentValue, retailer, communicationMode } = params;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-6 py-2 px-4 bg-purple-500/10 border border-purple-500/20 rounded-full w-fit mx-auto">
        <Target className="w-4 h-4 text-purple-400" />
        <span className="text-sm text-purple-400">Smart negotiation with voice & text</span>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold">Report Delay</h2>
        </div>

        {/* Communication Mode Toggle */}
        <div className="mb-6">
          <label className="text-xs text-slate-500 mb-2 block">Communication Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => onParamsChange({ communicationMode: 'text' })}
              className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                communicationMode === 'text'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Text Chat
            </button>
            <button
              onClick={() => onParamsChange({ communicationMode: 'voice' })}
              className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                communicationMode === 'voice'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Phone className="w-4 h-4" />
              Voice Call
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Delay Slider */}
          <div className="col-span-2">
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

          {/* Retailer Selection */}
          <div className="col-span-2">
            <label className="text-xs text-slate-500 mb-1 block">Retailer</label>
            <div className="flex gap-2 flex-wrap">
              {RETAILERS.map((r) => (
                <button
                  key={r}
                  onClick={() => onParamsChange({ retailer: r })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    retailer === r
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={onStart}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
        >
          <Sparkles className="w-4 h-4" />
          Start {communicationMode === 'voice' ? 'Voice Session' : 'Analysis'}
        </button>

        {/* Help Text */}
        <div className="mt-4 p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
          <p className="text-xs text-purple-300 font-medium mb-1">
            {communicationMode === 'voice'
              ? 'Voice mode: Speak naturally with warehouse manager'
              : 'Text mode: Type warehouse manager responses'}
          </p>
          <p className="text-xs text-slate-500">
            {communicationMode === 'voice'
              ? 'Try: "This is Sarah, I can get you in at 2:15" or "We\'re booked solid until 4pm"'
              : 'Example: "This is Sarah, I can fit you in at 10:15" (IDEAL) or "Best I can do is 3pm, dock 7" (BAD)'}
          </p>
        </div>
      </div>
    </div>
  );
}
