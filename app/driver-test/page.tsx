'use client';

import { useState, useCallback } from 'react';
import { Settings, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import { DriverVoiceInterface, type DriverCallConfig, type DriverCallResult } from '@/components/driver-call';

// =============================================================================
// CONFIGURATION
// =============================================================================

const VAPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '';
const VAPI_DRIVER_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID || '';

// =============================================================================
// MAIN PAGE - Uses same dark theme as dispatch page
// =============================================================================

export default function DriverTestPage() {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [config, setConfig] = useState<DriverCallConfig>({
    proposedTime: '15:30',
    proposedDock: 'B5',
    warehouseName: 'Sarah',
    originalAppointment: '14:00',
  });

  const [lastResult, setLastResult] = useState<DriverCallResult | null>(null);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const handleCallResult = useCallback((result: DriverCallResult) => {
    console.log('[DriverTest] Call result:', result);
    console.log('   └─ Status:', result.status);
    console.log('   └─ Accepted proposed time:', result.acceptedProposedTime);
    console.log('   └─ Confirmed time:', result.confirmedTime);
    if (result.counterProposedTime) {
      console.log('   └─ Counter-proposed time:', result.counterProposedTime);
    }
    setLastResult(result);
  }, []);

  const updateConfig = (field: keyof DriverCallConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  // ---------------------------------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------------------------------
  const formatTimeForDisplay = (time24h: string): string => {
    const [hoursStr, minutesStr] = time24h.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return minutes === 0 ? `${hour12} ${period}` : `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const isConfigured = !!VAPI_PUBLIC_KEY && !!VAPI_DRIVER_ASSISTANT_ID;

  // ---------------------------------------------------------------------------
  // RENDER - Uses same dark theme as dispatch page
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header - Same style as dispatch page */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              Driver Call Test
            </h1>
            <p className="text-sm text-slate-400">
              Test the driver confirmation voice interface
            </p>
          </div>

          {/* Configuration Status */}
          <div className="flex items-center gap-2">
            {isConfigured ? (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Ready
              </span>
            ) : (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Not Configured
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Configuration */}
          <div className="lg:col-span-1 space-y-4">
            {/* Configuration Status Card */}
            <div className="bg-slate-800/20 border border-slate-700/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-white">Configuration</h2>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
                  <span className="text-slate-400">VAPI Public Key</span>
                  {VAPI_PUBLIC_KEY ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      OK
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400">
                      <XCircle className="w-3 h-3" />
                      Missing
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-400">Driver Assistant ID</span>
                  {VAPI_DRIVER_ASSISTANT_ID ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      OK
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400">
                      <XCircle className="w-3 h-3" />
                      Missing
                    </span>
                  )}
                </div>
              </div>

              {!isConfigured && (
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                  <p className="font-medium text-amber-400 mb-1">Setup Required</p>
                  <p className="text-slate-400">
                    Add to <code className="px-1 py-0.5 rounded bg-slate-800">.env.local</code>:
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-slate-500">
                    <li>NEXT_PUBLIC_VAPI_PUBLIC_KEY</li>
                    <li>NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Test Parameters Card */}
            <div className="bg-slate-800/20 border border-slate-700/30 rounded-2xl p-4">
              <h2 className="font-semibold text-white mb-4">Test Parameters</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">
                      Proposed Time
                    </label>
                    <input
                      type="time"
                      value={config.proposedTime}
                      onChange={(e) => updateConfig('proposedTime', e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm bg-slate-900/50 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">
                      Dock Number
                    </label>
                    <input
                      type="text"
                      value={config.proposedDock}
                      onChange={(e) => updateConfig('proposedDock', e.target.value)}
                      placeholder="e.g., B5"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-slate-900/50 border border-slate-700 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">
                    Warehouse Contact Name
                  </label>
                  <input
                    type="text"
                    value={config.warehouseName || ''}
                    onChange={(e) => updateConfig('warehouseName', e.target.value)}
                    placeholder="e.g., Sarah"
                    className="w-full rounded-lg px-3 py-2 text-sm bg-slate-900/50 border border-slate-700 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">
                    Original Appointment
                  </label>
                  <input
                    type="time"
                    value={config.originalAppointment}
                    onChange={(e) => updateConfig('originalAppointment', e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-slate-900/50 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>

                {/* Summary */}
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-1">
                    The driver will be asked:
                  </p>
                  <p className="text-sm text-slate-300">
                    "Can you make <span className="text-white font-medium">{formatTimeForDisplay(config.proposedTime)}</span> at{' '}
                    <span className="text-white font-medium">Dock {config.proposedDock}</span>?"
                  </p>
                </div>
              </div>
            </div>

            {/* Last Result Card */}
            {lastResult && (
              <div className={`rounded-2xl p-4 border ${
                lastResult.status === 'confirmed'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : lastResult.status === 'counter_proposed'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <h3 className={`font-semibold mb-2 ${
                  lastResult.status === 'confirmed'
                    ? 'text-emerald-400'
                    : lastResult.status === 'counter_proposed'
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}>
                  Last Result
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className="text-slate-300 capitalize">{lastResult.status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Accepted Proposed</span>
                    <span className={lastResult.acceptedProposedTime ? 'text-emerald-400' : 'text-amber-400'}>
                      {lastResult.acceptedProposedTime ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Confirmed Time</span>
                    <span className="text-white font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lastResult.confirmedTime}
                    </span>
                  </div>
                  {lastResult.counterProposedTime && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-700/30">
                      <span className="text-slate-500">Counter-Proposed</span>
                      <span className="text-amber-400 font-medium flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {lastResult.counterProposedTime}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-slate-800/20 border border-slate-700/30 rounded-2xl p-4">
              <h2 className="font-semibold text-white mb-3">How to Test</h2>
              <ol className="space-y-2 text-sm text-slate-400">
                <li className="flex gap-2">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">1</span>
                  <span>Configure the test parameters</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">2</span>
                  <span>Click "Start Driver Call"</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">3</span>
                  <span>Mike will ask if you can make the time</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">4</span>
                  <span>Respond: "yes" or "no"</span>
                </li>
              </ol>
            </div>
          </div>

          {/* Right Column - Voice Interface */}
          <div className="lg:col-span-2">
            <DriverVoiceInterface
              config={config}
              onCallResult={handleCallResult}
              assistantId={VAPI_DRIVER_ASSISTANT_ID}
              publicKey={VAPI_PUBLIC_KEY}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
