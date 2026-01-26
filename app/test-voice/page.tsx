'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Loader, UserCheck, AlertCircle } from 'lucide-react';
import type { DriverCallStatus } from '@/types/dispatch';
import { carbon } from '@/lib/themes/carbon';

// VAPI Configuration - same as dispatch page
const VAPI_DRIVER_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID || '';

export default function TestVoicePage() {
  // Driver call state - same as dispatch page
  const [driverCallStatus, setDriverCallStatus] = useState<DriverCallStatus>('idle');
  const driverCallStatusRef = useRef<DriverCallStatus>('idle');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverVapiClientRef = useRef<any>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Test parameters
  const [proposedTime, setProposedTime] = useState('15:30');
  const [proposedDock, setProposedDock] = useState('B5');
  const [warehouseName, setWarehouseName] = useState('Sarah');
  const [originalAppointment, setOriginalAppointment] = useState('14:00');

  // Logs for debugging
  const [logs, setLogs] = useState<string[]>([]);

  // Keep ref in sync - same pattern as dispatch page
  useEffect(() => {
    driverCallStatusRef.current = driverCallStatus;
  }, [driverCallStatus]);

  // Cleanup on unmount - same as dispatch page
  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
      if (driverVapiClientRef.current) {
        try {
          driverVapiClientRef.current.stop();
        } catch (e) {
          // Ignore
        }
        driverVapiClientRef.current = null;
      }
    };
  }, []);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${time}] ${message}`]);
    console.log(`[TestVoice] ${message}`);
  };

  /**
   * Start the driver confirmation VAPI call
   * This is the EXACT same code from dispatch/page.tsx
   */
  const startDriverConfirmationCall = async () => {
    try {
      addLog('[Phase12] Starting driver confirmation call');
      setDriverCallStatus('connecting');

      // Dynamically import Vapi SDK
      const VapiModule = await import('@vapi-ai/web');
      const VapiClass = VapiModule.default;

      const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error('VAPI public key not configured');
      }

      if (!VAPI_DRIVER_ASSISTANT_ID) {
        throw new Error('Driver VAPI assistant ID not configured');
      }

      const driverClient = new VapiClass(publicKey);
      driverVapiClientRef.current = driverClient;

      // Set up event listeners for driver call
      driverClient.on('call-start', () => {
        addLog('[Phase12] 🟢 Driver call started');
        setDriverCallStatus('active');
      });

      driverClient.on('call-end', () => {
        addLog('[Phase12] 🔴 Driver call ended');
        // Use ref to get current status (avoids React closure bug)
        const currentStatus = driverCallStatusRef.current;
        // If we haven't received explicit confirmation/rejection, treat as timeout
        if (currentStatus === 'active' || currentStatus === 'connecting') {
          handleDriverCallResult('timeout');
        }
      });

      driverClient.on('message', (message: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = message as any;
        addLog(`[Phase12] 📨 Driver Message: ${msg.type}`);

        // Handle transcript messages to detect confirmation/rejection
        if (msg.type === 'transcript' && msg.transcriptType === 'final') {
          const content = msg.transcript.toLowerCase();
          addLog(`[Phase12] Transcript: "${msg.transcript}"`);

          // Check for driver confirmation
          if (content.includes('confirm') || content.includes('yes') ||
              content.includes('sounds good') || content.includes('works for me') ||
              content.includes('i can make') || content.includes("i'll be there")) {
            addLog('[Phase12] ✅ Driver confirmed');
            handleDriverCallResult('confirmed');
          }
          // Check for driver rejection
          else if (content.includes('no') || content.includes("can't") ||
                   content.includes('cannot') || content.includes("won't") ||
                   content.includes('not going to') || content.includes('impossible')) {
            addLog('[Phase12] ❌ Driver rejected');
            handleDriverCallResult('rejected');
          }
        }
      });

      driverClient.on('error', (error: unknown) => {
        addLog(`[Phase12] ❌ Driver VAPI error: ${JSON.stringify(error)}`);
        handleDriverCallResult('failed');
      });

      // Prepare variables for driver assistant
      const { formatTimeForSpeech } = await import('@/lib/time-parser');
      const driverVariables = {
        proposed_time: formatTimeForSpeech(proposedTime),
        proposed_time_24h: proposedTime,
        proposed_dock: proposedDock,
        warehouse_name: warehouseName || 'the warehouse',
        original_appointment: formatTimeForSpeech(originalAppointment),
      };

      addLog(`[Phase12] 🚀 Starting driver VAPI call with variables: ${JSON.stringify(driverVariables)}`);

      await driverClient.start(VAPI_DRIVER_ASSISTANT_ID, {
        variableValues: driverVariables,
      });

      addLog('[Phase12] ✅ Driver call started successfully');

      // Start 60-second timeout
      holdTimeoutRef.current = setTimeout(() => {
        addLog('[Phase12] Hold timeout expired - driver did not respond');
        handleDriverCallResult('timeout');
      }, 60000);

    } catch (error) {
      addLog(`[Phase12] Failed to start driver call: ${error}`);
      handleDriverCallResult('failed');
    }
  };

  /**
   * Handle the result of the driver confirmation call
   * This is the EXACT same code from dispatch/page.tsx
   */
  const handleDriverCallResult = useCallback(async (result: 'confirmed' | 'rejected' | 'timeout' | 'failed') => {
    addLog(`[Phase12] Handling driver call result: ${result}`);

    // Clear hold timeout
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    // End driver call if still active
    if (driverVapiClientRef.current) {
      try {
        driverVapiClientRef.current.stop();
      } catch (e) {
        addLog(`[Phase12] Error stopping driver call: ${e}`);
      }
      driverVapiClientRef.current = null;
    }

    setDriverCallStatus(result);

    if (result === 'confirmed') {
      addLog('[Phase12] Driver confirmed - would finalize agreement');
    } else {
      addLog('[Phase12] Driver unavailable - would end with failure');
    }
  }, []);

  const endDriverCall = () => {
    if (driverVapiClientRef.current) {
      addLog('Manually ending driver call');
      driverVapiClientRef.current.stop();
    }
  };

  const resetState = () => {
    setDriverCallStatus('idle');
    driverCallStatusRef.current = 'idle';
    setLogs([]);
  };

  const isCallActive = driverCallStatus === 'connecting' || driverCallStatus === 'active';

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: carbon.bgBase, color: carbon.textPrimary }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold mb-2">Driver Call Test Page</h1>
        <p className="text-sm" style={{ color: carbon.textSecondary }}>
          Test the driver confirmation VAPI call in isolation. Uses the exact same code as the dispatch page.
        </p>

        {/* Configuration Status */}
        <div className="p-4 rounded-lg border" style={{ backgroundColor: carbon.bgSurface1, borderColor: carbon.border }}>
          <h2 className="font-semibold mb-2">Configuration</h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span style={{ color: carbon.textSecondary }}>VAPI Public Key:</span>
              <span style={{ color: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ? carbon.success : carbon.critical }}>
                {process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ? '✓ Configured' : '✗ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: carbon.textSecondary }}>Driver Assistant ID:</span>
              <span style={{ color: VAPI_DRIVER_ASSISTANT_ID ? carbon.success : carbon.critical }}>
                {VAPI_DRIVER_ASSISTANT_ID ? '✓ Configured' : '✗ Missing'}
              </span>
            </div>
          </div>
        </div>

        {/* Test Parameters */}
        <div className="p-4 rounded-lg border" style={{ backgroundColor: carbon.bgSurface1, borderColor: carbon.border }}>
          <h2 className="font-semibold mb-3">Test Parameters</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: carbon.textTertiary }}>Proposed Time</label>
              <input
                type="time"
                value={proposedTime}
                onChange={(e) => setProposedTime(e.target.value)}
                disabled={isCallActive}
                className="w-full rounded px-3 py-2 text-sm border"
                style={{ backgroundColor: carbon.input.background, borderColor: carbon.input.border, color: carbon.input.color }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: carbon.textTertiary }}>Proposed Dock</label>
              <input
                type="text"
                value={proposedDock}
                onChange={(e) => setProposedDock(e.target.value)}
                disabled={isCallActive}
                className="w-full rounded px-3 py-2 text-sm border"
                style={{ backgroundColor: carbon.input.background, borderColor: carbon.input.border, color: carbon.input.color }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: carbon.textTertiary }}>Warehouse Contact Name</label>
              <input
                type="text"
                value={warehouseName}
                onChange={(e) => setWarehouseName(e.target.value)}
                disabled={isCallActive}
                className="w-full rounded px-3 py-2 text-sm border"
                style={{ backgroundColor: carbon.input.background, borderColor: carbon.input.border, color: carbon.input.color }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: carbon.textTertiary }}>Original Appointment</label>
              <input
                type="time"
                value={originalAppointment}
                onChange={(e) => setOriginalAppointment(e.target.value)}
                disabled={isCallActive}
                className="w-full rounded px-3 py-2 text-sm border"
                style={{ backgroundColor: carbon.input.background, borderColor: carbon.input.border, color: carbon.input.color }}
              />
            </div>
          </div>
        </div>

        {/* Call Controls */}
        <div className="p-4 rounded-lg border" style={{ backgroundColor: carbon.bgSurface1, borderColor: carbon.border }}>
          <h2 className="font-semibold mb-3">Driver Call</h2>

          {/* Status Display - same UI as dispatch page */}
          {driverCallStatus !== 'idle' && (
            <div className="mb-4 p-4 rounded-lg border" style={{
              backgroundColor: driverCallStatus === 'confirmed' ? carbon.successBg
                : driverCallStatus === 'active' || driverCallStatus === 'connecting' ? carbon.warningBg
                : carbon.criticalBg,
              borderColor: driverCallStatus === 'confirmed' ? carbon.successBorder
                : driverCallStatus === 'active' || driverCallStatus === 'connecting' ? carbon.warningBorder
                : carbon.criticalBorder
            }}>
              <div className="flex items-center justify-center gap-3">
                {driverCallStatus === 'connecting' && <Loader className="w-5 h-5 animate-spin" style={{ color: carbon.warning }} />}
                {driverCallStatus === 'active' && <Phone className="w-5 h-5 animate-pulse" style={{ color: carbon.warning }} />}
                {driverCallStatus === 'confirmed' && <UserCheck className="w-5 h-5" style={{ color: carbon.success }} />}
                {(driverCallStatus === 'rejected' || driverCallStatus === 'timeout' || driverCallStatus === 'failed') &&
                  <AlertCircle className="w-5 h-5" style={{ color: carbon.critical }} />}
                <span className="font-semibold" style={{
                  color: driverCallStatus === 'confirmed' ? carbon.success
                    : driverCallStatus === 'active' || driverCallStatus === 'connecting' ? carbon.warning
                    : carbon.critical
                }}>
                  {driverCallStatus === 'connecting' ? 'Connecting to driver...'
                    : driverCallStatus === 'active' ? 'Speaking with driver...'
                    : driverCallStatus === 'confirmed' ? 'Driver Confirmed!'
                    : driverCallStatus === 'rejected' ? 'Driver Rejected'
                    : driverCallStatus === 'timeout' ? 'Driver Timed Out'
                    : 'Driver Call Failed'}
                </span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            {!isCallActive ? (
              <button
                onClick={startDriverConfirmationCall}
                disabled={!VAPI_DRIVER_ASSISTANT_ID}
                className="flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                style={{
                  backgroundColor: VAPI_DRIVER_ASSISTANT_ID ? carbon.success : carbon.textMuted,
                  color: 'white',
                  opacity: VAPI_DRIVER_ASSISTANT_ID ? 1 : 0.5,
                }}
              >
                <Phone className="w-5 h-5" />
                Start Driver Call
              </button>
            ) : (
              <button
                onClick={endDriverCall}
                className="flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                style={{ backgroundColor: carbon.critical, color: 'white' }}
              >
                <PhoneOff className="w-5 h-5" />
                End Call
              </button>
            )}
            <button
              onClick={resetState}
              disabled={isCallActive}
              className="px-4 py-3 rounded-lg font-semibold transition-colors"
              style={{
                backgroundColor: carbon.bgSurface2,
                color: carbon.textSecondary,
                opacity: isCallActive ? 0.5 : 1,
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Debug Logs */}
        <div className="p-4 rounded-lg border" style={{ backgroundColor: carbon.bgSurface1, borderColor: carbon.border }}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Debug Logs</h2>
            <button
              onClick={() => setLogs([])}
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: carbon.bgSurface2, color: carbon.textSecondary }}
            >
              Clear
            </button>
          </div>
          <div
            className="h-64 overflow-y-auto rounded p-3 font-mono text-xs space-y-1"
            style={{ backgroundColor: carbon.bgBase }}
          >
            {logs.length === 0 ? (
              <p style={{ color: carbon.textMuted }}>Logs will appear here when you start a call...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{
                  color: log.includes('✅') || log.includes('confirmed') ? carbon.success
                    : log.includes('❌') || log.includes('error') || log.includes('Failed') ? carbon.critical
                    : log.includes('🟢') || log.includes('🚀') ? carbon.accent
                    : log.includes('🔴') ? carbon.warning
                    : carbon.textSecondary
                }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 rounded-lg border" style={{ backgroundColor: carbon.bgSurface1, borderColor: carbon.border }}>
          <h2 className="font-semibold mb-2">How to Test</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm" style={{ color: carbon.textSecondary }}>
            <li>Make sure <code className="px-1 rounded" style={{ backgroundColor: carbon.bgSurface2 }}>NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID</code> is set in <code className="px-1 rounded" style={{ backgroundColor: carbon.bgSurface2 }}>.env.local</code></li>
            <li>Adjust test parameters if needed (proposed time, dock, etc.)</li>
            <li>Click "Start Driver Call"</li>
            <li>The driver assistant (Mike) will call and ask if you can make the proposed time</li>
            <li>Respond as the driver: say "yes" or "no"</li>
            <li>Watch the status and logs update</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
