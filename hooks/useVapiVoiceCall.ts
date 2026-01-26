'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { SetupParams } from '@/types/dispatch';
import type { NegotiationStrategy } from '@/lib/negotiation-strategy';
import type { ExtractedContractTerms } from '@/types/contract';

/**
 * VAPI call status
 */
export type VapiCallStatus = 'idle' | 'connecting' | 'active' | 'ended';

/**
 * Transcript data from VAPI
 */
export interface VapiTranscriptData {
  role: 'dispatcher' | 'warehouse';
  content: string;
  timestamp: string;
}

/**
 * Callbacks for VAPI events
 */
export interface VapiCallbacks {
  onCallStart?: () => void;
  onCallEnd?: () => void;
  onTranscript?: (data: VapiTranscriptData) => void;
  onAssistantSpeechStart?: () => void;
  onAssistantSpeechEnd?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Configuration for VAPI call
 */
export interface VapiCallConfig {
  assistantId: string;
  publicKey?: string;
  setupParams: SetupParams;
  negotiationStrategy?: NegotiationStrategy | null;
  extractedTerms?: ExtractedContractTerms | null;
  partyName?: string | null;
}

/**
 * Return type for useVapiVoiceCall hook
 */
export interface UseVapiVoiceCallReturn {
  /** Current call status */
  callStatus: VapiCallStatus;

  /** Start a VAPI call */
  startCall: (config: VapiCallConfig) => Promise<void>;

  /** End the current call */
  endCall: () => void;

  /** Send a message to the VAPI assistant */
  sendMessage: (message: { type: string; [key: string]: unknown }) => void;

  /** Reference to the VAPI client for direct access */
  vapiClientRef: React.MutableRefObject<unknown>;

  /** Whether the assistant is currently speaking */
  isAssistantSpeaking: boolean;
}

/**
 * Format minutes to duration string (e.g., "6 hours 30 minutes")
 */
function formatMinutesToDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours === 0) return `${minutes} minutes`;
  if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
}

/**
 * Convert 24h time to speech format (e.g., "15:30" -> "3:30 PM")
 */
function format24hToSpeech(time24h: string): string {
  const [hoursStr, minutesStr] = time24h.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return minutes === 0 ? `${hour12} ${period}` : `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Hook for managing VAPI WebRTC voice calls
 *
 * This hook encapsulates all VAPI SDK interactions:
 * - Dynamic import of VAPI SDK
 * - Starting/ending calls
 * - Event handling (transcripts, speech, errors)
 * - Building variable values for the assistant
 */
export function useVapiVoiceCall(callbacks: VapiCallbacks = {}): UseVapiVoiceCallReturn {
  const [callStatus, setCallStatus] = useState<VapiCallStatus>('idle');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiClientRef = useRef<any>(null);
  const callbacksRef = useRef<VapiCallbacks>(callbacks);

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  /**
   * Build VAPI variable values from config
   */
  const buildVariableValues = useCallback(async (config: VapiCallConfig) => {
    const { formatTimeForSpeech, addMinutesToTime, roundTimeToFiveMinutes, formatDelayForSpeech } = await import('@/lib/time-parser');
    const { originalAppointment, delayMinutes, shipmentValue, hosEnabled, driverHOS } = config.setupParams;

    // Basic time calculations
    const formattedAppointment = formatTimeForSpeech(originalAppointment);
    const actualArrivalTime24h = addMinutesToTime(originalAppointment, delayMinutes);
    const actualArrivalTimeSpeech = formatTimeForSpeech(actualArrivalTime24h);
    const actualArrivalRounded24h = roundTimeToFiveMinutes(actualArrivalTime24h);
    const actualArrivalRoundedSpeech = formatTimeForSpeech(actualArrivalRounded24h);
    const delayFriendly = formatDelayForSpeech(delayMinutes);

    // OTIF window
    const OTIF_WINDOW_MINUTES = 30;
    const otifWindowStart24h = addMinutesToTime(originalAppointment, -OTIF_WINDOW_MINUTES);
    const otifWindowEnd24h = addMinutesToTime(originalAppointment, OTIF_WINDOW_MINUTES);
    const otifWindowStartSpeech = formatTimeForSpeech(otifWindowStart24h);
    const otifWindowEndSpeech = formatTimeForSpeech(otifWindowEnd24h);

    // Serialize extracted contract terms
    const extractedTermsJson = config.extractedTerms
      ? JSON.stringify(config.extractedTerms)
      : '';

    // Serialize negotiation strategy
    const strategyJson = config.negotiationStrategy
      ? JSON.stringify({
          thresholds: config.negotiationStrategy.thresholds,
          costThresholds: config.negotiationStrategy.costThresholds,
          maxPushbackAttempts: config.negotiationStrategy.maxPushbackAttempts,
          display: config.negotiationStrategy.display,
        })
      : '';

    // Build HOS variables if enabled
    let hosVariables: Record<string, string> = {};
    const hosConstraints = config.negotiationStrategy?.hosConstraints;

    if (hosEnabled && driverHOS && hosConstraints) {
      const hosLatestDockTime = format24hToSpeech(hosConstraints.latestFeasibleTime);

      const bindingMap: Record<string, string> = {
        '14H_WINDOW': '14-hour window',
        '11H_DRIVE': '11-hour drive limit',
        '8H_BREAK': '8-hour break requirement',
        'WEEKLY': 'weekly hours limit',
      };
      const binding = bindingMap[hosConstraints.bindingConstraint || ''] || '14-hour window';

      hosVariables = {
        hos_enabled: 'true',
        hos_remaining_drive: formatMinutesToDuration(driverHOS.remainingDriveMinutes),
        hos_remaining_window: formatMinutesToDuration(driverHOS.remainingWindowMinutes),
        hos_latest_dock_time: hosLatestDockTime,
        hos_binding_constraint: binding,
        driver_hos_json: JSON.stringify(driverHOS),
      };
    }

    return {
      original_appointment: formattedAppointment,
      original_24h: originalAppointment,
      actual_arrival_time: actualArrivalTimeSpeech,
      actual_arrival_24h: actualArrivalTime24h,
      actual_arrival_rounded: actualArrivalRoundedSpeech,
      actual_arrival_rounded_24h: actualArrivalRounded24h,
      otif_window_start: otifWindowStartSpeech,
      otif_window_end: otifWindowEndSpeech,
      delay_friendly: delayFriendly,
      delay_minutes: delayMinutes.toString(),
      shipment_value: shipmentValue.toString(),
      retailer: config.partyName || 'Walmart',
      extracted_terms_json: extractedTermsJson,
      strategy_json: strategyJson,
      ...hosVariables,
    };
  }, []);

  /**
   * Start a VAPI voice call
   */
  const startCall = useCallback(async (config: VapiCallConfig) => {
    try {
      setCallStatus('connecting');

      // Dynamically import VAPI SDK
      const VapiModule = await import('@vapi-ai/web');
      const VapiClass = VapiModule.default;

      const publicKey = config.publicKey || process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error('VAPI public key not configured');
      }

      const client = new VapiClass(publicKey);
      vapiClientRef.current = client;

      // Set up event listeners
      client.on('call-start', () => {
        console.log('🟢 VAPI: Call started');
        setCallStatus('active');
        callbacksRef.current.onCallStart?.();
      });

      client.on('call-end', () => {
        console.log('🔴 VAPI: Call ended');
        setCallStatus('ended');
        callbacksRef.current.onCallEnd?.();
      });

      client.on('speech-start', () => {
        console.log('🎤 VAPI: User started speaking');
      });

      client.on('speech-end', () => {
        console.log('🎤 VAPI: User stopped speaking');
      });

      client.on('message', (message: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = message as any;
        console.log('📨 VAPI Message:', msg.type, msg);

        // Handle transcript messages
        if (msg.type === 'transcript' && msg.transcriptType === 'final') {
          const role = msg.role === 'user' ? 'warehouse' : 'dispatcher';
          callbacksRef.current.onTranscript?.({
            role,
            content: msg.transcript,
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        // Track assistant speech via speech-update
        if (msg.type === 'speech-update' && msg.role === 'assistant') {
          if (msg.status === 'started') {
            console.log('🔊 Assistant started speaking');
            setIsAssistantSpeaking(true);
            callbacksRef.current.onAssistantSpeechStart?.();
          } else if (msg.status === 'stopped') {
            console.log('🔇 Assistant stopped speaking');
            setIsAssistantSpeaking(false);
            callbacksRef.current.onAssistantSpeechEnd?.();
          }
        }

        // Track assistant speech via model-output (fallback)
        if (msg.type === 'model-output') {
          setIsAssistantSpeaking(true);
          callbacksRef.current.onAssistantSpeechStart?.();
        }

        // Track when assistant response ends
        if (msg.type === 'assistant-response' && msg.done === true) {
          setIsAssistantSpeaking(false);
          callbacksRef.current.onAssistantSpeechEnd?.();
        }
      });

      client.on('error', (error: unknown) => {
        console.error('❌ VAPI error:', error);
        setCallStatus('idle');
        callbacksRef.current.onError?.(error);
      });

      // Build and log variables
      const variableValues = await buildVariableValues(config);
      console.log('🚀 Starting VAPI call with variables:', variableValues);

      // Start the call
      await client.start(config.assistantId, {
        variableValues,
      });

      console.log('✅ VAPI call started successfully');
    } catch (error) {
      console.error('Failed to start call:', error);
      setCallStatus('idle');
      callbacksRef.current.onError?.(error);
      throw error;
    }
  }, [buildVariableValues]);

  /**
   * End the current VAPI call
   */
  const endCall = useCallback(() => {
    if (vapiClientRef.current) {
      try {
        vapiClientRef.current.stop();
        console.log('🛑 VAPI call stopped');
      } catch (error) {
        console.error('Error stopping VAPI call:', error);
      }
    }
  }, []);

  /**
   * Send a message to the VAPI assistant
   */
  const sendMessage = useCallback((message: { type: string; [key: string]: unknown }) => {
    if (vapiClientRef.current) {
      try {
        vapiClientRef.current.send(message);
      } catch (error) {
        console.error('Error sending message to VAPI:', error);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vapiClientRef.current) {
        try {
          vapiClientRef.current.stop();
        } catch {
          // Ignore errors during cleanup
        }
        vapiClientRef.current = null;
      }
    };
  }, []);

  return {
    callStatus,
    startCall,
    endCall,
    sendMessage,
    vapiClientRef,
    isAssistantSpeaking,
  };
}
