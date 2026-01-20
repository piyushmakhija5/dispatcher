'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Loader,
  Mic,
  CheckCircle,
} from 'lucide-react';
import type {
  VapiCallStatus,
  VapiCallInterfaceProps,
  VapiTranscriptMessage,
} from '@/types/vapi';
import {
  formatTimeForSpeech,
  addMinutesToTime,
} from '@/lib/time-parser';

// Dynamically import Vapi to avoid SSR issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let VapiClass: any = null;

export function VoiceCallInterface({
  onTranscript,
  onCallEnd,
  onCallStatusChange,
  assistantId,
  isActive,
  originalAppointment,
  delayMinutes,
  shipmentValue,
  retailer,
  onAssistantSpeechStart,
  onAssistantSpeechEnd,
}: VapiCallInterfaceProps) {
  const [callStatus, setCallStatus] = useState<VapiCallStatus>('idle');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    };
  }, []);

  const speakMessage = useCallback((message: string) => {
    if (vapiRef.current && callStatus === 'active') {
      console.log('Dispatcher speaking:', message);
      vapiRef.current.say(message);
    }
  }, [callStatus]);

  const endCall = useCallback(() => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      setCallStatus('ended');
    }
  }, []);

  // Notify parent of status changes
  useEffect(() => {
    if (onCallStatusChange) {
      onCallStatusChange(callStatus, endCall, speakMessage);
    }
  }, [callStatus, endCall, speakMessage, onCallStatusChange]);

  const startCall = async () => {
    try {
      setCallStatus('connecting');

      // Dynamically import Vapi SDK
      if (!VapiClass) {
        const VapiModule = await import('@vapi-ai/web');
        VapiClass = VapiModule.default;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error('VAPI public key not configured');
      }

      const client = new VapiClass(publicKey);
      vapiRef.current = client;

      // Set up event listeners
      client.on('call-start', () => {
        console.log('Call started');
        setCallStatus('active');
      });

      client.on('call-end', () => {
        console.log('Call ended');
        setCallStatus('ended');
        onCallEnd();
      });

      client.on('speech-start', () => {
        console.log('User started speaking');
      });

      client.on('speech-end', () => {
        console.log('User stopped speaking');
      });

      // Track assistant speech state via speech-update event
      client.on('speech-update', (update: { status: string; role?: string }) => {
        console.log('Speech update:', update);
        // speech-update has status: 'started' | 'stopped' and role: 'assistant' | 'user'
        if (update.role === 'assistant') {
          if (update.status === 'started') {
            setIsAssistantSpeaking(true);
            onAssistantSpeechStart?.();
          } else if (update.status === 'stopped') {
            setIsAssistantSpeaking(false);
            onAssistantSpeechEnd?.();
          }
        }
      });

      client.on('message', (message: unknown) => {
        console.log('Message received:', message);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = message as any;

        // Handle transcript messages
        if (msg.type === 'transcript' && msg.transcriptType === 'final') {
          const role = msg.role === 'user' ? 'warehouse' : 'dispatcher';
          onTranscript({
            role,
            content: msg.transcript,
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        // Alternative way to track assistant speech via model-output messages
        // Some VAPI versions use this instead of speech-update
        if (msg.type === 'model-output') {
          console.log('Model output detected - assistant may be speaking');
        }

        // Track when assistant response ends via response-complete
        if (msg.type === 'assistant-response' && msg.done === true) {
          console.log('Assistant response complete');
          setIsAssistantSpeaking(false);
          onAssistantSpeechEnd?.();
        }
      });

      client.on('error', (error: unknown) => {
        console.error('VAPI error:', error);
        setCallStatus('idle');
      });

      // ========================================================================
      // Calculate all time-related variables
      // ========================================================================

      // Convert original appointment to conversational format (e.g., "14:00" → "2 PM")
      const formattedAppointment = formatTimeForSpeech(originalAppointment);

      // Calculate actual arrival time (original appointment + delay)
      const actualArrivalTime24h = addMinutesToTime(originalAppointment, delayMinutes);
      const actualArrivalTimeSpeech = formatTimeForSpeech(actualArrivalTime24h);

      // Calculate OTIF window (±30 minutes from original appointment)
      const OTIF_WINDOW_MINUTES = 30;
      const otifWindowStart24h = addMinutesToTime(originalAppointment, -OTIF_WINDOW_MINUTES);
      const otifWindowEnd24h = addMinutesToTime(originalAppointment, OTIF_WINDOW_MINUTES);
      const otifWindowStartSpeech = formatTimeForSpeech(otifWindowStart24h);
      const otifWindowEndSpeech = formatTimeForSpeech(otifWindowEnd24h);

      // ========================================================================
      // Start the call with dynamic variables
      // ========================================================================
      await client.start(assistantId, {
        variableValues: {
          // Original appointment
          original_appointment: formattedAppointment,
          original_24h: originalAppointment,

          // Actual truck arrival time (original + delay)
          actual_arrival_time: actualArrivalTimeSpeech,
          actual_arrival_24h: actualArrivalTime24h,

          // OTIF window (±30 mins from original)
          otif_window_start: otifWindowStartSpeech,
          otif_window_end: otifWindowEndSpeech,

          // Other parameters
          delay_minutes: delayMinutes.toString(),
          shipment_value: shipmentValue.toString(),
          retailer: retailer,
        },
      });

      console.log('VAPI call started with variables:', {
        original_appointment: formattedAppointment,
        original_24h: originalAppointment,
        actual_arrival_time: actualArrivalTimeSpeech,
        actual_arrival_24h: actualArrivalTime24h,
        otif_window_start: otifWindowStartSpeech,
        otif_window_end: otifWindowEndSpeech,
        delay_minutes: delayMinutes,
        shipment_value: shipmentValue,
        retailer: retailer,
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      setCallStatus('idle');
      alert('Failed to start call. Please check console for details.');
    }
  };

  if (!isActive) return null;

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-semibold text-purple-300">Voice Call</span>
        </div>
        {callStatus === 'active' && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* Idle State */}
      {callStatus === 'idle' && (
        <button
          onClick={startCall}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg"
        >
          <Phone className="w-5 h-5" />
          Start Voice Call
        </button>
      )}

      {/* Connecting State */}
      {callStatus === 'connecting' && (
        <div className="flex items-center justify-center gap-3 py-3">
          <Loader className="w-5 h-5 text-purple-400 animate-spin" />
          <span className="text-sm text-purple-300">Connecting to warehouse...</span>
        </div>
      )}

      {/* Active State */}
      {callStatus === 'active' && (
        <div className="bg-black/20 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Mic className="w-6 h-6 text-purple-400 animate-pulse" />
          </div>
          <p className="text-sm text-slate-300 mb-1">Call in progress</p>
          <p className="text-xs text-slate-500">
            Speak naturally with the warehouse manager
          </p>
        </div>
      )}

      {/* Ended State */}
      {callStatus === 'ended' && (
        <div className="text-center py-3">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-emerald-300">Call ended</p>
        </div>
      )}
    </div>
  );
}

interface VoiceCallControlsProps {
  callStatus: VapiCallStatus;
  conversationPhase: string;
  isProcessing: boolean;
  onEndCall: (() => void) | null;
  onFinalize: () => void;
}

export function VoiceCallControls({
  callStatus,
  conversationPhase,
  isProcessing,
  onEndCall,
  onFinalize,
}: VoiceCallControlsProps) {
  if (conversationPhase === 'done') {
    return (
      <button
        onClick={onFinalize}
        disabled={isProcessing}
        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium rounded-xl flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4" />
        )}
        Save Agreement
      </button>
    );
  }

  if (callStatus === 'active' && onEndCall) {
    return (
      <button
        onClick={onEndCall}
        className="w-full py-2.5 bg-red-500 hover:bg-red-400 text-white font-medium rounded-xl flex items-center justify-center gap-2"
      >
        <PhoneOff className="w-4 h-4" />
        End Call
      </button>
    );
  }

  if (callStatus === 'ended') {
    return (
      <div className="text-center py-2">
        <p className="text-sm text-slate-400">Call ended</p>
      </div>
    );
  }

  return null;
}
