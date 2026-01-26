'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  VapiClient,
  VapiDriverVariableValues,
  DriverCallCallbacks,
} from '@/types/vapi';
import type {
  DriverCallStatus,
  DriverConfirmationState,
  DriverConfirmationResult,
  TentativeAgreement,
} from '@/types/dispatch';

/**
 * Default driver call timeout in milliseconds (60 seconds)
 */
const DEFAULT_DRIVER_TIMEOUT_MS = 60000;

/**
 * Interval for updating timeout countdown (1 second)
 */
const TIMEOUT_UPDATE_INTERVAL_MS = 1000;

/**
 * Initial driver confirmation state
 */
const INITIAL_DRIVER_STATE: DriverConfirmationState = {
  status: 'idle',
  isEnabled: true,
  result: null,
  error: null,
  callStartedAt: null,
  timeoutSecondsRemaining: null,
};

export interface UseDriverCallReturn {
  /** Current driver confirmation state */
  driverState: DriverConfirmationState;

  /** Start the driver confirmation call */
  startDriverCall: (
    vapiClient: VapiClient,
    assistantId: string,
    tentativeAgreement: TentativeAgreement,
    additionalVariables?: Partial<VapiDriverVariableValues>
  ) => Promise<void>;

  /** End the driver call (cleanup) */
  endDriverCall: (vapiClient: VapiClient) => void;

  /** Mark driver as confirmed */
  setDriverConfirmed: () => void;

  /** Mark driver as rejected */
  setDriverRejected: (reason?: string) => void;

  /** Reset driver state */
  resetDriverState: () => void;

  /** Reference to driver state for use in callbacks */
  driverStateRef: React.MutableRefObject<DriverConfirmationState>;

  /** Register callbacks for driver call events */
  registerCallbacks: (callbacks: Partial<DriverCallCallbacks>) => void;
}

/**
 * Convert 24h time to 12h format for speech
 * e.g., "15:30" -> "3:30 PM"
 */
function formatTimeForSpeech(time24h: string): string {
  const [hours, minutes] = time24h.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Hook for managing driver confirmation calls
 *
 * This hook manages:
 * - Starting a new VAPI call to the driver
 * - Tracking call status and timeout
 * - Handling confirmation/rejection results
 * - Cleanup when call ends
 *
 * Usage:
 * 1. After putting warehouse on hold, call startDriverCall()
 * 2. Listen for VAPI events to detect driver response
 * 3. Call setDriverConfirmed() or setDriverRejected() based on response
 * 4. Call endDriverCall() when done
 */
export function useDriverCall(
  timeoutMs: number = DEFAULT_DRIVER_TIMEOUT_MS
): UseDriverCallReturn {
  const [driverState, setDriverState] = useState<DriverConfirmationState>(INITIAL_DRIVER_STATE);

  // Ref for accessing current state in callbacks
  const driverStateRef = useRef<DriverConfirmationState>(INITIAL_DRIVER_STATE);

  // Timeout timer ref
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown interval ref
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Callbacks ref
  const callbacksRef = useRef<Partial<DriverCallCallbacks>>({});

  // Keep ref in sync with state
  useEffect(() => {
    driverStateRef.current = driverState;
  }, [driverState]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  /**
   * Register callbacks for driver call events
   */
  const registerCallbacks = useCallback((callbacks: Partial<DriverCallCallbacks>) => {
    callbacksRef.current = { ...callbacksRef.current, ...callbacks };
  }, []);

  /**
   * Clear all timers
   */
  const clearTimers = useCallback(() => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  /**
   * Start countdown timer for UI display
   */
  const startCountdown = useCallback(() => {
    const startTime = Date.now();
    const endTime = startTime + timeoutMs;

    // Update countdown every second
    countdownIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

      setDriverState(prev => ({
        ...prev,
        timeoutSecondsRemaining: remaining,
      }));

      if (remaining <= 0) {
        clearTimers();
      }
    }, TIMEOUT_UPDATE_INTERVAL_MS);
  }, [timeoutMs, clearTimers]);

  /**
   * Handle timeout expiration
   */
  const handleTimeout = useCallback(() => {
    console.log('[useDriverCall] Driver call timed out');

    clearTimers();

    const newState: DriverConfirmationState = {
      ...driverStateRef.current,
      status: 'timeout',
      result: 'timeout',
      timeoutSecondsRemaining: 0,
    };

    setDriverState(newState);
    driverStateRef.current = newState;

    // Invoke timeout callback
    callbacksRef.current.onTimeout?.();
  }, [clearTimers]);

  /**
   * Start the driver confirmation call
   */
  const startDriverCall = useCallback(async (
    vapiClient: VapiClient,
    assistantId: string,
    tentativeAgreement: TentativeAgreement,
    additionalVariables?: Partial<VapiDriverVariableValues>
  ) => {
    console.log('[useDriverCall] Starting driver confirmation call', {
      assistantId,
      tentativeAgreement,
    });

    // Clear any existing timers
    clearTimers();

    // Update state to connecting
    const connectingState: DriverConfirmationState = {
      status: 'connecting',
      isEnabled: true,
      result: null,
      error: null,
      callStartedAt: new Date().toISOString(),
      timeoutSecondsRemaining: Math.ceil(timeoutMs / 1000),
    };

    setDriverState(connectingState);
    driverStateRef.current = connectingState;

    try {
      // Prepare variables for driver assistant
      const variableValues: VapiDriverVariableValues = {
        proposed_time: formatTimeForSpeech(tentativeAgreement.time),
        proposed_time_24h: tentativeAgreement.time,
        proposed_dock: tentativeAgreement.dock,
        warehouse_name: tentativeAgreement.warehouseContact || 'the warehouse',
        original_appointment: '', // Will be filled by caller if needed
        ...additionalVariables,
      };

      console.log('[useDriverCall] Starting VAPI call with variables:', variableValues);

      // Start the VAPI call
      await vapiClient.start(assistantId, { variableValues });

      // Update state to active
      const activeState: DriverConfirmationState = {
        ...connectingState,
        status: 'active',
      };

      setDriverState(activeState);
      driverStateRef.current = activeState;

      // Start timeout timer
      timeoutTimerRef.current = setTimeout(handleTimeout, timeoutMs);

      // Start countdown for UI
      startCountdown();

      console.log('[useDriverCall] Driver call started successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start driver call';
      console.error('[useDriverCall] Failed to start driver call:', error);

      const errorState: DriverConfirmationState = {
        ...driverStateRef.current,
        status: 'failed',
        result: 'failed',
        error: errorMsg,
      };

      setDriverState(errorState);
      driverStateRef.current = errorState;

      // Invoke error callback
      callbacksRef.current.onError?.(errorMsg);

      throw error;
    }
  }, [timeoutMs, clearTimers, handleTimeout, startCountdown]);

  /**
   * End the driver call
   */
  const endDriverCall = useCallback((vapiClient: VapiClient) => {
    console.log('[useDriverCall] Ending driver call');

    clearTimers();

    try {
      vapiClient.stop();
      console.log('[useDriverCall] Driver call stopped');
    } catch (error) {
      console.error('[useDriverCall] Error stopping driver call:', error);
    }

    // Invoke call end callback
    callbacksRef.current.onCallEnd?.();
  }, [clearTimers]);

  /**
   * Mark driver as confirmed
   */
  const setDriverConfirmed = useCallback(() => {
    console.log('[useDriverCall] Driver confirmed');

    clearTimers();

    const confirmedState: DriverConfirmationState = {
      ...driverStateRef.current,
      status: 'confirmed',
      result: 'confirmed',
      timeoutSecondsRemaining: null,
    };

    setDriverState(confirmedState);
    driverStateRef.current = confirmedState;

    // Invoke confirm callback
    callbacksRef.current.onDriverConfirm?.();
  }, [clearTimers]);

  /**
   * Mark driver as rejected
   */
  const setDriverRejected = useCallback((reason?: string) => {
    console.log('[useDriverCall] Driver rejected', { reason });

    clearTimers();

    const rejectedState: DriverConfirmationState = {
      ...driverStateRef.current,
      status: 'rejected',
      result: 'rejected',
      error: reason || null,
      timeoutSecondsRemaining: null,
    };

    setDriverState(rejectedState);
    driverStateRef.current = rejectedState;

    // Invoke reject callback
    callbacksRef.current.onDriverReject?.(reason);
  }, [clearTimers]);

  /**
   * Reset driver state
   */
  const resetDriverState = useCallback(() => {
    console.log('[useDriverCall] Resetting driver state');

    clearTimers();
    setDriverState(INITIAL_DRIVER_STATE);
    driverStateRef.current = INITIAL_DRIVER_STATE;
    callbacksRef.current = {};
  }, [clearTimers]);

  return {
    driverState,
    startDriverCall,
    endDriverCall,
    setDriverConfirmed,
    setDriverRejected,
    resetDriverState,
    driverStateRef,
    registerCallbacks,
  };
}

/**
 * Helper to determine if driver confirmation flow should continue
 */
export function shouldContinueDriverFlow(status: DriverCallStatus): boolean {
  return status === 'connecting' || status === 'active';
}

/**
 * Helper to determine if driver confirmation completed (any result)
 */
export function isDriverFlowComplete(status: DriverCallStatus): boolean {
  return ['confirmed', 'rejected', 'timeout', 'failed'].includes(status);
}

/**
 * Helper to determine if driver confirmation was successful
 */
export function isDriverConfirmationSuccessful(result: DriverConfirmationResult | null): boolean {
  return result === 'confirmed';
}
