import { useState, useRef, useEffect } from 'react';
import type { VapiTranscriptData } from '@/types/vapi';
import type { SetupParams } from '@/types/dispatch';

const VAPI_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || 'fcbf6dc8-d661-4cdc-83c0-6965ca9163d3';
const SILENCE_DURATION_MS = 3000;

interface UseVapiIntegrationProps {
  setupParams: SetupParams;
  onTranscript: (data: VapiTranscriptData) => void;
  onCallEnd: () => void;
  onAssistantSpeechStart: () => void;
  onAssistantSpeechEnd: () => void;
}

/**
 * VAPI Voice Call Integration Hook
 * Handles SDK initialization, event management, and call lifecycle
 */
export function useVapiIntegration({
  setupParams,
  onTranscript,
  onCallEnd,
  onAssistantSpeechStart,
  onAssistantSpeechEnd,
}: UseVapiIntegrationProps) {
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');

  // VAPI client ref for direct SDK access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiClientRef = useRef<any>(null);

  // Track auto-end timer to allow cancellation if user speaks
  const autoEndTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track if we're waiting for assistant to finish speaking before starting silence timer
  const waitingForSpeechEndRef = useRef<boolean>(false);

  // Track if assistant is currently speaking
  const isAssistantSpeakingRef = useRef<boolean>(false);

  // Start VAPI call function
  const startVapiCall = async () => {
    try {
      setCallStatus('connecting');

      // Dynamically import Vapi SDK
      const VapiModule = await import('@vapi-ai/web');
      const VapiClass = VapiModule.default;

      const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error('VAPI public key not configured');
      }

      const client = new VapiClass(publicKey);
      vapiClientRef.current = client;

      // Set up event listeners
      client.on('call-start', () => {
        console.log('🟢 VAPI: Call started');
        setCallStatus('active');
      });

      client.on('call-end', () => {
        console.log('🔴 VAPI: Call ended');
        setCallStatus('ended');
        onCallEnd();
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
          console.log(`💬 Transcript (${role}):`, msg.transcript);
          onTranscript({
            role,
            content: msg.transcript,
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        // Track assistant speech via speech-update (if available)
        if (msg.type === 'speech-update') {
          console.log('🔊 Speech update:', msg);
          if (msg.role === 'assistant') {
            if (msg.status === 'started') {
              console.log('🔊 Assistant started speaking');
              handleAssistantSpeechStartInternal();
            } else if (msg.status === 'stopped') {
              console.log('🔇 Assistant stopped speaking');
              handleAssistantSpeechEndInternal();
            }
          }
        }

        // Track assistant speech via model-output (alternative)
        if (msg.type === 'model-output') {
          console.log('🤖 Model output detected');
          handleAssistantSpeechStartInternal();
        }

        // Track when assistant response ends
        if (msg.type === 'assistant-response' && msg.done === true) {
          console.log('✅ Assistant response complete');
          handleAssistantSpeechEndInternal();
        }
      });

      client.on('error', (error: unknown) => {
        console.error('❌ VAPI error:', error);
        setCallStatus('idle');
      });

      // Prepare variables for VAPI
      const { formatTimeForSpeech, addMinutesToTime } = await import('@/lib/time-parser');
      const { originalAppointment, delayMinutes, shipmentValue, retailer } = setupParams;

      const formattedAppointment = formatTimeForSpeech(originalAppointment);
      const actualArrivalTime24h = addMinutesToTime(originalAppointment, delayMinutes);
      const actualArrivalTimeSpeech = formatTimeForSpeech(actualArrivalTime24h);

      const OTIF_WINDOW_MINUTES = 30;
      const otifWindowStart24h = addMinutesToTime(originalAppointment, -OTIF_WINDOW_MINUTES);
      const otifWindowEnd24h = addMinutesToTime(originalAppointment, OTIF_WINDOW_MINUTES);
      const otifWindowStartSpeech = formatTimeForSpeech(otifWindowStart24h);
      const otifWindowEndSpeech = formatTimeForSpeech(otifWindowEnd24h);

      // Start the call
      const vapiVariables = {
        original_appointment: formattedAppointment,
        original_24h: originalAppointment,
        actual_arrival_time: actualArrivalTimeSpeech,
        actual_arrival_24h: actualArrivalTime24h,
        otif_window_start: otifWindowStartSpeech,
        otif_window_end: otifWindowEndSpeech,
        delay_minutes: delayMinutes.toString(),
        shipment_value: shipmentValue.toString(),
        retailer: retailer,
      };

      console.log('🚀 Starting VAPI call with variables:', vapiVariables);

      await client.start(VAPI_ASSISTANT_ID, {
        variableValues: vapiVariables,
      });

      console.log('✅ VAPI call started successfully');
    } catch (error) {
      console.error('Failed to start call:', error);
      setCallStatus('idle');
      alert('Failed to start call. Please check console for details.');
    }
  };

  // End VAPI call function
  const endVapiCall = () => {
    if (vapiClientRef.current) {
      vapiClientRef.current.stop();
    }
  };

  // Internal speech handlers that update refs and call parent callbacks
  function handleAssistantSpeechStartInternal() {
    isAssistantSpeakingRef.current = true;
    onAssistantSpeechStart();

    // If we were waiting for silence, cancel the timer since assistant is speaking
    if (autoEndTimerRef.current) {
      console.log('🔇 Cancelling silence timer - assistant is speaking');
      clearTimeout(autoEndTimerRef.current);
      autoEndTimerRef.current = null;
    }
  }

  function handleAssistantSpeechEndInternal() {
    isAssistantSpeakingRef.current = false;
    onAssistantSpeechEnd();

    // If we were waiting for assistant to finish before starting silence timer
    if (waitingForSpeechEndRef.current) {
      console.log('⏳ Assistant finished closing phrase - starting silence timer');
      waitingForSpeechEndRef.current = false;
      startSilenceTimer();
    }
  }

  function startSilenceTimer() {
    // Clear any existing timer
    if (autoEndTimerRef.current) {
      clearTimeout(autoEndTimerRef.current);
    }

    console.log(`⏰ Starting ${SILENCE_DURATION_MS / 1000} second silence timer`);

    autoEndTimerRef.current = setTimeout(() => {
      console.log('✅ Silence period complete - will trigger end via callback');
      // Callback to parent to check conditions and end if appropriate
      autoEndTimerRef.current = null;
    }, SILENCE_DURATION_MS);
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoEndTimerRef.current) {
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
    };
  }, []);

  return {
    callStatus,
    startVapiCall,
    endVapiCall,
    isAssistantSpeakingRef,
    waitingForSpeechEndRef,
    autoEndTimerRef,
    startSilenceTimer,
  };
}
