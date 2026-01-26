'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { VapiClient } from '@/types/vapi';
import type {
  WarehouseHoldState,
  TentativeAgreement,
} from '@/types/dispatch';

/**
 * Default hold timeout in milliseconds (60 seconds)
 * If driver call takes longer than this, we return to warehouse with failure
 */
const DEFAULT_HOLD_TIMEOUT_MS = 60000;

/**
 * Initial warehouse hold state
 */
const INITIAL_HOLD_STATE: WarehouseHoldState = {
  isOnHold: false,
  holdStartedAt: null,
  tentativeAgreement: null,
};

export interface UseWarehouseHoldReturn {
  /** Current hold state */
  holdState: WarehouseHoldState;

  /** Put the warehouse call on hold (mute both sides) */
  putOnHold: (
    vapiClient: VapiClient,
    tentativeAgreement: TentativeAgreement
  ) => void;

  /** Resume from hold (unmute both sides) */
  resumeFromHold: (vapiClient: VapiClient) => void;

  /** Check if hold has timed out */
  isHoldTimedOut: () => boolean;

  /** Get remaining hold time in seconds */
  getRemainingHoldSeconds: () => number;

  /** Reset hold state */
  resetHoldState: () => void;

  /** Reference to hold state for use in callbacks */
  holdStateRef: React.MutableRefObject<WarehouseHoldState>;
}

/**
 * Hook for managing warehouse call hold state
 *
 * Simulates "hold" by muting both the user microphone and assistant audio.
 * VAPI doesn't support native hold, so we use mute controls.
 *
 * Flow:
 * 1. Reach tentative agreement with warehouse
 * 2. Call putOnHold() to mute warehouse call
 * 3. Start driver confirmation call
 * 4. When driver call completes, call resumeFromHold()
 * 5. Continue warehouse call with final confirmation or failure message
 */
export function useWarehouseHold(
  holdTimeoutMs: number = DEFAULT_HOLD_TIMEOUT_MS
): UseWarehouseHoldReturn {
  const [holdState, setHoldState] = useState<WarehouseHoldState>(INITIAL_HOLD_STATE);

  // Ref for accessing current state in callbacks
  const holdStateRef = useRef<WarehouseHoldState>(INITIAL_HOLD_STATE);

  // Keep ref in sync with state
  useEffect(() => {
    holdStateRef.current = holdState;
  }, [holdState]);

  /**
   * Put the warehouse call on hold
   * Mutes both user microphone and assistant audio
   */
  const putOnHold = useCallback((
    vapiClient: VapiClient,
    tentativeAgreement: TentativeAgreement
  ) => {
    console.log('[useWarehouseHold] Putting warehouse on hold', { tentativeAgreement });

    try {
      // Mute user microphone
      vapiClient.setMuted(true);
      console.log('[useWarehouseHold] User microphone muted');

      // Mute assistant audio output
      vapiClient.send({ type: 'control', control: 'mute-assistant' });
      console.log('[useWarehouseHold] Assistant audio muted');

      const newState: WarehouseHoldState = {
        isOnHold: true,
        holdStartedAt: new Date().toISOString(),
        tentativeAgreement,
      };

      setHoldState(newState);
      holdStateRef.current = newState;

      console.log('[useWarehouseHold] Warehouse now on hold');
    } catch (error) {
      console.error('[useWarehouseHold] Failed to put warehouse on hold:', error);
      throw error;
    }
  }, []);

  /**
   * Resume from hold
   * Unmutes both user microphone and assistant audio
   */
  const resumeFromHold = useCallback((vapiClient: VapiClient) => {
    console.log('[useWarehouseHold] Resuming warehouse from hold');

    try {
      // Unmute assistant audio output first
      vapiClient.send({ type: 'control', control: 'unmute-assistant' });
      console.log('[useWarehouseHold] Assistant audio unmuted');

      // Unmute user microphone
      vapiClient.setMuted(false);
      console.log('[useWarehouseHold] User microphone unmuted');

      // Keep tentative agreement in state for reference, just clear hold status
      setHoldState(prev => ({
        ...prev,
        isOnHold: false,
      }));

      holdStateRef.current = {
        ...holdStateRef.current,
        isOnHold: false,
      };

      console.log('[useWarehouseHold] Warehouse resumed from hold');
    } catch (error) {
      console.error('[useWarehouseHold] Failed to resume warehouse from hold:', error);
      throw error;
    }
  }, []);

  /**
   * Check if the hold has exceeded the timeout
   */
  const isHoldTimedOut = useCallback((): boolean => {
    const { isOnHold, holdStartedAt } = holdStateRef.current;

    if (!isOnHold || !holdStartedAt) {
      return false;
    }

    const holdDurationMs = Date.now() - new Date(holdStartedAt).getTime();
    return holdDurationMs >= holdTimeoutMs;
  }, [holdTimeoutMs]);

  /**
   * Get remaining hold time in seconds
   * Returns 0 if not on hold or timed out
   */
  const getRemainingHoldSeconds = useCallback((): number => {
    const { isOnHold, holdStartedAt } = holdStateRef.current;

    if (!isOnHold || !holdStartedAt) {
      return 0;
    }

    const holdDurationMs = Date.now() - new Date(holdStartedAt).getTime();
    const remainingMs = Math.max(0, holdTimeoutMs - holdDurationMs);

    return Math.ceil(remainingMs / 1000);
  }, [holdTimeoutMs]);

  /**
   * Reset hold state to initial values
   */
  const resetHoldState = useCallback(() => {
    console.log('[useWarehouseHold] Resetting hold state');
    setHoldState(INITIAL_HOLD_STATE);
    holdStateRef.current = INITIAL_HOLD_STATE;
  }, []);

  return {
    holdState,
    putOnHold,
    resumeFromHold,
    isHoldTimedOut,
    getRemainingHoldSeconds,
    resetHoldState,
    holdStateRef,
  };
}
