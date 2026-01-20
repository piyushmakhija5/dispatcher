'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  VapiCallStatus,
  VapiTranscriptData,
} from '@/types/vapi';

interface UseVapiCallReturn {
  /** Current call status */
  callStatus: VapiCallStatus;

  /** Function to end the call (available when call is active) */
  endCallFn: (() => void) | null;

  /** Function to make the assistant speak (available when call is active) */
  speakMessageFn: ((message: string) => void) | null;

  /** Handle status change from VoiceCallInterface */
  handleCallStatusChange: (
    status: VapiCallStatus,
    endCallFn: () => void,
    speakMessageFn: (message: string) => void
  ) => void;

  /** Handle transcript from VoiceCallInterface */
  handleTranscript: (data: VapiTranscriptData) => void;

  /** All transcripts received */
  transcripts: VapiTranscriptData[];

  /** Clear transcripts */
  clearTranscripts: () => void;

  /** Reset hook state */
  reset: () => void;
}

interface UseVapiCallOptions {
  /** Called when a new transcript is received */
  onTranscript?: (data: VapiTranscriptData) => void;

  /** Called when call ends */
  onCallEnd?: () => void;

  /** Called when call status changes */
  onStatusChange?: (status: VapiCallStatus) => void;
}

/**
 * Hook for managing VAPI voice call state
 * Works with VoiceCallInterface component
 */
export function useVapiCall(options: UseVapiCallOptions = {}): UseVapiCallReturn {
  const { onTranscript, onCallEnd, onStatusChange } = options;

  const [callStatus, setCallStatus] = useState<VapiCallStatus>('idle');
  const [endCallFn, setEndCallFn] = useState<(() => void) | null>(null);
  const [speakMessageFn, setSpeakMessageFn] = useState<((message: string) => void) | null>(null);
  const [transcripts, setTranscripts] = useState<VapiTranscriptData[]>([]);

  // Handle status change from VoiceCallInterface
  const handleCallStatusChange = useCallback(
    (
      status: VapiCallStatus,
      endFn: () => void,
      speakFn: (message: string) => void
    ) => {
      setCallStatus(status);

      if (endFn) {
        setEndCallFn(() => endFn);
      }

      if (speakFn) {
        setSpeakMessageFn(() => speakFn);
      }

      onStatusChange?.(status);

      // Call ended
      if (status === 'ended') {
        onCallEnd?.();
      }
    },
    [onStatusChange, onCallEnd]
  );

  // Handle transcript from VoiceCallInterface
  const handleTranscript = useCallback(
    (data: VapiTranscriptData) => {
      setTranscripts((prev) => [...prev, data]);
      onTranscript?.(data);
    },
    [onTranscript]
  );

  // Clear transcripts
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  // Reset hook state
  const reset = useCallback(() => {
    setCallStatus('idle');
    setEndCallFn(null);
    setSpeakMessageFn(null);
    setTranscripts([]);
  }, []);

  return {
    callStatus,
    endCallFn,
    speakMessageFn,
    handleCallStatusChange,
    handleTranscript,
    transcripts,
    clearTranscripts,
    reset,
  };
}

/**
 * Auto-end call after conversation is complete
 * Returns cleanup function
 */
export function useAutoEndCall(
  shouldEnd: boolean,
  callStatus: VapiCallStatus,
  endCallFn: (() => void) | null,
  delayMs: number = 2000
): void {
  useEffect(() => {
    if (shouldEnd && callStatus === 'active' && endCallFn) {
      const timer = setTimeout(() => {
        console.log('Auto-ending call - agreement reached and confirmed');
        endCallFn();
      }, delayMs);

      return () => clearTimeout(timer);
    }
  }, [shouldEnd, callStatus, endCallFn, delayMs]);
}

/**
 * Extract warehouse manager name from transcript
 */
export function extractWarehouseManagerName(content: string): string | null {
  const match = content.match(/(?:i'm|i am|this is)\s+(\w+)/i);
  return match ? match[1] : null;
}
