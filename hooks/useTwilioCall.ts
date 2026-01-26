/**
 * useTwilioCall Hook
 *
 * Manages outbound phone calls via VAPI + Twilio.
 * Used when voice transport is set to 'phone' mode.
 *
 * Key differences from WebRTC (useVapiIntegration):
 * - Calls are initiated server-side via API
 * - Status is polled (no client-side SDK events)
 * - User is a spectator (no browser audio)
 * - Transcripts are fetched via polling (from VAPI webhooks stored server-side)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TwilioCallState, TwilioCallStatus } from '@/types/vapi';
import type { OutboundCallResponse } from '@/app/api/call/outbound/route';
import type { CallStatusResponse } from '@/app/api/call/[callId]/route';

// Polling interval for call status (milliseconds)
const POLL_INTERVAL_MS = 2000;
// Polling interval for messages (faster for more responsive transcripts)
const MESSAGE_POLL_INTERVAL_MS = 750;

// Transcript message type
export interface TranscriptMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

// =============================================================================
// HOOK INTERFACE
// =============================================================================

export interface UseTwilioCallReturn {
  /** Current call state */
  callState: TwilioCallState;
  /** Transcript messages from the call */
  messages: TranscriptMessage[];
  /** Whether the last message is complete (speaker stopped) */
  lastMessageComplete: boolean;
  /** Start an outbound call with dynamic variables */
  startCall: (variableValues: Record<string, string>) => Promise<boolean>;
  /** End the current call */
  endCall: () => Promise<void>;
  /** Whether a call is currently active or connecting */
  isCallActive: boolean;
  /** Human-readable status for display */
  statusLabel: string;
  /** Reset the call state (for new calls) */
  resetCall: () => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialCallState: TwilioCallState = {
  callId: null,
  status: 'idle',
  phoneNumber: null,
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  endReason: null,
  error: null,
};

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useTwilioCall(): UseTwilioCallReturn {
  const [callState, setCallState] = useState<TwilioCallState>(initialCallState);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [lastMessageComplete, setLastMessageComplete] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagePollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Status Polling
  // ---------------------------------------------------------------------------

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (messagePollingIntervalRef.current) {
      clearInterval(messagePollingIntervalRef.current);
      messagePollingIntervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // ---------------------------------------------------------------------------
  // Message Polling
  // ---------------------------------------------------------------------------

  const pollMessages = useCallback(async (callId: string): Promise<void> => {
    try {
      const url = `/api/call/${callId}/messages`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        console.error('[useTwilioCall] Message poll error:', data.error);
        return;
      }

      // Server maintains authoritative state - just replace with latest
      if (data.messages) {
        setMessages(data.messages);
        lastMessageIdRef.current = data.lastMessageId;
      }

      // Track if last message is complete (speaker stopped)
      setLastMessageComplete(data.lastMessageComplete ?? false);
    } catch (error) {
      console.error('[useTwilioCall] Message poll error:', error);
    }
  }, []);

  const startMessagePolling = useCallback((callId: string) => {
    console.log(`[useTwilioCall] Starting message polling for call: ${callId}`);

    // Poll immediately
    pollMessages(callId);

    // Then poll at interval
    messagePollingIntervalRef.current = setInterval(() => {
      pollMessages(callId);
    }, MESSAGE_POLL_INTERVAL_MS);
  }, [pollMessages]);

  const pollStatus = useCallback(async (callId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/call/${callId}`);
      const data: CallStatusResponse = await response.json();

      if (!data.success) {
        console.error('[useTwilioCall] Poll error:', data.error);
        return;
      }

      setCallState(prev => {
        // Calculate duration if call is in progress
        let durationSeconds = prev.durationSeconds;
        if (data.startedAt && !data.endedAt) {
          const startTime = new Date(data.startedAt).getTime();
          durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        } else if (data.startedAt && data.endedAt) {
          const startTime = new Date(data.startedAt).getTime();
          const endTime = new Date(data.endedAt).getTime();
          durationSeconds = Math.floor((endTime - startTime) / 1000);
        }

        return {
          ...prev,
          status: data.status as TwilioCallStatus,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          endReason: data.endReason,
          durationSeconds,
        };
      });

      // Stop polling if call has ended
      if (data.status === 'ended') {
        console.log('[useTwilioCall] Call ended, doing final message polls then stopping');

        // Stop status polling immediately
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Do multiple final message polls to catch all remaining messages
        // Webhooks may still be processing, so poll a few more times
        const finalPollCount = 3;
        const finalPollDelay = 1000; // 1 second between final polls

        for (let i = 0; i < finalPollCount; i++) {
          setTimeout(() => {
            console.log(`[useTwilioCall] Final message poll ${i + 1}/${finalPollCount}`);
            pollMessages(callId);

            // Stop message polling after last final poll
            if (i === finalPollCount - 1) {
              if (messagePollingIntervalRef.current) {
                clearInterval(messagePollingIntervalRef.current);
                messagePollingIntervalRef.current = null;
              }
              isPollingRef.current = false;
              console.log('[useTwilioCall] All polling stopped');
            }
          }, (i + 1) * finalPollDelay);
        }
      }

    } catch (error) {
      console.error('[useTwilioCall] Poll error:', error);
    }
  }, [pollMessages]);

  const startPolling = useCallback((callId: string) => {
    if (isPollingRef.current) {
      console.log('[useTwilioCall] Already polling, skipping');
      return;
    }

    console.log(`[useTwilioCall] Starting status polling for call: ${callId}`);
    isPollingRef.current = true;

    // Poll immediately, then at interval
    pollStatus(callId);

    pollingIntervalRef.current = setInterval(() => {
      pollStatus(callId);
    }, POLL_INTERVAL_MS);

    // Also start message polling
    startMessagePolling(callId);
  }, [pollStatus, startMessagePolling]);

  // ---------------------------------------------------------------------------
  // Call Control
  // ---------------------------------------------------------------------------

  const startCall = useCallback(async (variableValues: Record<string, string>): Promise<boolean> => {
    console.log('[useTwilioCall] Starting outbound call');

    // Reset state
    setCallState({
      ...initialCallState,
      status: 'initiating',
    });

    try {
      const response = await fetch('/api/call/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variableValues }),
      });

      const data: OutboundCallResponse = await response.json();

      if (!data.success) {
        console.error('[useTwilioCall] Failed to start call:', data.error);
        setCallState(prev => ({
          ...prev,
          status: 'error',
          error: data.error,
        }));
        return false;
      }

      console.log(`[useTwilioCall] Call initiated: ${data.callId}`);

      // Update state with call info
      setCallState(prev => ({
        ...prev,
        callId: data.callId,
        status: data.status as TwilioCallStatus,
        phoneNumber: data.phoneNumber,
        error: null,
      }));

      // Start polling for status updates
      startPolling(data.callId);

      return true;

    } catch (error) {
      console.error('[useTwilioCall] Error starting call:', error);
      setCallState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return false;
    }
  }, [startPolling]);

  const endCall = useCallback(async (): Promise<void> => {
    const { callId } = callState;
    if (!callId) {
      console.log('[useTwilioCall] No active call to end');
      return;
    }

    console.log(`[useTwilioCall] Ending call: ${callId}`);
    stopPolling();

    try {
      const response = await fetch(`/api/call/${callId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        console.error('[useTwilioCall] Failed to end call:', data.error);
      }

      // Update state to ended
      setCallState(prev => ({
        ...prev,
        status: 'ended',
        endedAt: new Date().toISOString(),
      }));

    } catch (error) {
      console.error('[useTwilioCall] Error ending call:', error);
      // Still mark as ended locally
      setCallState(prev => ({
        ...prev,
        status: 'ended',
      }));
    }
  }, [callState.callId, stopPolling]);

  const resetCall = useCallback(() => {
    stopPolling();
    setCallState(initialCallState);
    setMessages([]);
    setLastMessageComplete(false);
    lastMessageIdRef.current = null;
  }, [stopPolling]);

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const isCallActive = ['initiating', 'queued', 'ringing', 'in-progress'].includes(callState.status);

  const statusLabel = getStatusLabel(callState.status);

  return {
    callState,
    messages,
    lastMessageComplete,
    startCall,
    endCall,
    isCallActive,
    statusLabel,
    resetCall,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusLabel(status: TwilioCallState['status']): string {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'initiating':
      return 'Initiating call...';
    case 'queued':
      return 'Call queued...';
    case 'ringing':
      return 'Ringing...';
    case 'in-progress':
      return 'Call in progress';
    case 'forwarding':
      return 'Forwarding...';
    case 'ended':
      return 'Call ended';
    case 'error':
      return 'Call failed';
    default:
      return 'Unknown';
  }
}

export default useTwilioCall;
