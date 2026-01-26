'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, Brain, Loader, CheckCircle, PhoneCall, UserCheck, Pause, Phone } from 'lucide-react';
import { useDispatchWorkflow } from '@/hooks/useDispatchWorkflow';
import { useAutoEndCall, extractWarehouseManagerName } from '@/hooks/useVapiCall';
import { useTwilioCall } from '@/hooks/useTwilioCall';
import { isPhoneTransportConfigured, getWarehousePhoneDisplay } from '@/lib/voice-transport';
import {
  SetupForm,
  ThinkingBlock,
  StrategyPanel,
  ChatInterface,
  FinalAgreement,
  generateAgreementText,
  ContractTermsDisplay,
} from '@/components/dispatch';
import { ArtifactPanel, type ArtifactType } from '@/components/ui';
import { TypewriterText } from '@/components/ui/TypewriterText';
import type { VapiTranscriptData } from '@/types/vapi';
import type { DriverCallStatus, AgreementStatus } from '@/types/dispatch';
import { carbon } from '@/lib/themes/carbon';
import { detectDateIndicator } from '@/lib/message-extractors';

// VAPI Configuration
const VAPI_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || 'fcbf6dc8-d661-4cdc-83c0-6965ca9163d3';
const VAPI_DRIVER_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID || '';

export default function DispatchPage() {
  const workflow = useDispatchWorkflow();
  const [userInput, setUserInput] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');
  const [saveStatus, setSaveStatus] = useState<{
    success: boolean;
    message: string;
    spreadsheetUrl?: string;
  } | null>(null);

  // Track progressive disclosure state (event-driven steps)
  const [showSummary, setShowSummary] = useState(false);
  const [summaryHeaderComplete, setSummaryHeaderComplete] = useState(false);
  const [summaryTypingComplete, setSummaryTypingComplete] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showVoiceSubagent, setShowVoiceSubagent] = useState(false);
  const [voiceSubagentHeaderComplete, setVoiceSubagentHeaderComplete] = useState(false);
  const [voiceSubagentTypingComplete, setVoiceSubagentTypingComplete] = useState(false);
  const [showCallButton, setShowCallButton] = useState(false);
  const [reasoningCollapsed, setReasoningCollapsed] = useState(false);

  // Loading states for transitions
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [loadingVoiceSubagent, setLoadingVoiceSubagent] = useState(false);
  const [loadingCallButton, setLoadingCallButton] = useState(false);

  // Finalized agreement section (shown after call ends)
  const [showFinalizedAgreement, setShowFinalizedAgreement] = useState(false);
  const [finalizedHeaderComplete, setFinalizedHeaderComplete] = useState(false);
  const [finalizedTypingComplete, setFinalizedTypingComplete] = useState(false);
  const [loadingFinalized, setLoadingFinalized] = useState(false);

  // Track pending accepted values (before full confirmation)
  // Use refs for synchronous updates (no stale closure issues)
  const pendingAcceptedTimeRef = useRef<string | null>(null);
  const pendingAcceptedCostRef = useRef<number>(0);
  const pendingAcceptedDayOffsetRef = useRef<number>(0);

  // Track auto-end timer to allow cancellation if user speaks
  const autoEndTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track if phone call is in auto-ending state (closing phrase detected, waiting for timer)
  // Once set, warehouse messages should NOT cancel the timer
  const phoneAutoEndingRef = useRef<boolean>(false);

  // Track if we're waiting for assistant to finish speaking before starting silence timer
  const waitingForSpeechEndRef = useRef<boolean>(false);

  // Track if assistant is currently speaking
  const isAssistantSpeakingRef = useRef<boolean>(false);

  // VAPI client ref for direct SDK access (warehouse call)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiClientRef = useRef<any>(null);

  // Phase 12: Second VAPI client ref for driver confirmation call
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverVapiClientRef = useRef<any>(null);

  // Phase 12: Driver call status tracking
  const [driverCallStatus, setDriverCallStatus] = useState<DriverCallStatus>('idle');
  // Phase 12: Driver call status ref for use in callbacks (avoids closure bug)
  const driverCallStatusRef = useRef<DriverCallStatus>('idle');

  // Phase 12: Hold timeout timer ref
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Phase 12: Progressive disclosure for driver confirmation UI
  const [showDriverConfirmation, setShowDriverConfirmation] = useState(false);
  const [driverConfirmHeaderComplete, setDriverConfirmHeaderComplete] = useState(false);
  const [driverConfirmTypingComplete, setDriverConfirmTypingComplete] = useState(false);
  const [loadingDriverConfirm, setLoadingDriverConfirm] = useState(false);

  // Phase 12: Keep driver call status ref in sync with state
  useEffect(() => {
    driverCallStatusRef.current = driverCallStatus;
  }, [driverCallStatus]);

  // ==========================================================================
  // TWILIO/PHONE TRANSPORT INTEGRATION
  // ==========================================================================

  // Twilio call hook for phone transport mode
  const twilioCall = useTwilioCall();

  // Check if phone transport is configured (server-side env vars present)
  // For client-side, we use an API endpoint or build-time flag
  const [phoneConfigured, setPhoneConfigured] = useState(false);
  const [warehousePhoneDisplay, setWarehousePhoneDisplay] = useState('Not configured');

  // Check phone configuration on mount
  useEffect(() => {
    // Check via API call to verify server-side config
    fetch('/api/call/outbound')
      .then(res => res.json())
      .then(data => {
        setPhoneConfigured(data.configured === true);
        // Get phone display from env (client-side fallback)
        const display = process.env.NEXT_PUBLIC_WAREHOUSE_PHONE_DISPLAY ||
                       process.env.WAREHOUSE_PHONE_NUMBER?.replace(/(\+\d{2})(\d{5})(\d+)/, '$1 $2 XXXXX') ||
                       'Not configured';
        setWarehousePhoneDisplay(display);
      })
      .catch(() => {
        setPhoneConfigured(false);
      });
  }, []);

  // Determine if current voice mode is phone (Twilio) or web (WebRTC)
  const isPhoneTransport = workflow.setupParams.voiceTransport === 'phone';

  // Unified call status that works for both transport modes
  const effectiveCallStatus = isPhoneTransport
    ? (twilioCall.callState.status === 'in-progress' ? 'active' :
       twilioCall.callState.status === 'ringing' ? 'connecting' :
       twilioCall.callState.status === 'queued' ? 'connecting' :
       twilioCall.callState.status === 'initiating' ? 'connecting' :
       twilioCall.callState.status === 'ended' ? 'ended' : 'idle')
    : callStatus;

  // Start VAPI call function (WebRTC)
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
        handleVapiCallEnd();
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
          handleVapiTranscript({
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
              handleAssistantSpeechStart();
            } else if (msg.status === 'stopped') {
              console.log('🔇 Assistant stopped speaking');
              handleAssistantSpeechEnd();
            }
          }
        }

        // Track assistant speech via model-output (alternative)
        if (msg.type === 'model-output') {
          console.log('🤖 Model output detected');
          handleAssistantSpeechStart();
        }

        // Track when assistant response ends
        if (msg.type === 'assistant-response' && msg.done === true) {
          console.log('✅ Assistant response complete');
          handleAssistantSpeechEnd();
        }
      });

      client.on('error', (error: unknown) => {
        console.error('❌ VAPI error:', error);
        setCallStatus('idle');
      });

      // Prepare variables for VAPI
      const { formatTimeForSpeech, addMinutesToTime } = await import('@/lib/time-parser');
      const { originalAppointment, delayMinutes, shipmentValue } = workflow.setupParams;

      const formattedAppointment = formatTimeForSpeech(originalAppointment);
      const actualArrivalTime24h = addMinutesToTime(originalAppointment, delayMinutes);
      const actualArrivalTimeSpeech = formatTimeForSpeech(actualArrivalTime24h);

      const OTIF_WINDOW_MINUTES = 30;
      const otifWindowStart24h = addMinutesToTime(originalAppointment, -OTIF_WINDOW_MINUTES);
      const otifWindowEnd24h = addMinutesToTime(originalAppointment, OTIF_WINDOW_MINUTES);
      const otifWindowStartSpeech = formatTimeForSpeech(otifWindowStart24h);
      const otifWindowEndSpeech = formatTimeForSpeech(otifWindowEnd24h);

      // Import time rounding for friendly arrival time
      const { roundTimeToFiveMinutes, formatDelayForSpeech } = await import('@/lib/time-parser');
      
      // Round arrival time to 5-minute intervals for natural speech
      const actualArrivalRounded24h = roundTimeToFiveMinutes(actualArrivalTime24h);
      const actualArrivalRoundedSpeech = formatTimeForSpeech(actualArrivalRounded24h);
      
      // Format delay in human-friendly terms
      const delayFriendly = formatDelayForSpeech(delayMinutes);

      // Serialize extracted contract terms for VAPI webhook (if available)
      // This ensures the webhook uses the same cost calculations as the UI
      const extractedTermsJson = workflow.extractedTerms
        ? JSON.stringify(workflow.extractedTerms)
        : '';

      // Serialize negotiation strategy for VAPI webhook
      // This ensures VAPI uses the EXACT same thresholds as the UI (no recalculation drift)
      const strategyJson = workflow.negotiationStrategy
        ? JSON.stringify({
            thresholds: workflow.negotiationStrategy.thresholds,
            costThresholds: workflow.negotiationStrategy.costThresholds,
            maxPushbackAttempts: workflow.negotiationStrategy.maxPushbackAttempts,
            display: workflow.negotiationStrategy.display,
          })
        : '';

      // Extract HOS settings from workflow
      const { hosEnabled, driverHOS } = workflow.setupParams;

      // Get HOS constraints from negotiation strategy (already correctly calculated)
      // The strategy computes latestFeasibleTime based on: arrival time + remaining HOS - dock duration
      const hosConstraints = workflow.negotiationStrategy?.hosConstraints;

      // Calculate HOS-related values for VAPI (if HOS is enabled)
      let hosVariables: Record<string, string> = {};
      if (hosEnabled && driverHOS && hosConstraints) {
        // Format duration for speech (e.g., "6 hours 30 minutes")
        const formatMinutesToDuration = (mins: number) => {
          const hours = Math.floor(mins / 60);
          const minutes = mins % 60;
          if (hours === 0) return `${minutes} minutes`;
          if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
          return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
        };

        // Convert 24h time (HH:MM) to speech format (e.g., "4:30 PM")
        const format24hToSpeech = (time24h: string) => {
          const [hoursStr, minutesStr] = time24h.split(':');
          const hours = parseInt(hoursStr, 10);
          const minutes = parseInt(minutesStr, 10);
          const period = hours >= 12 ? 'PM' : 'AM';
          const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
          return minutes === 0 ? `${hour12} ${period}` : `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
        };

        // Use the pre-computed latestFeasibleTime from the strategy (already in HH:MM format)
        const hosLatestDockTime = format24hToSpeech(hosConstraints.latestFeasibleTime);

        // Map binding constraint to human-readable format
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
          // JSON for tool webhook
          driver_hos_json: JSON.stringify(driverHOS),
        };

        console.log('🕐 HOS variables for VAPI:', hosVariables);
        console.log('🕐 HOS from strategy - latestFeasibleTime:', hosConstraints.latestFeasibleTime, '→', hosLatestDockTime);
      }

      // Start the call with all variables
      const vapiVariables = {
        original_appointment: formattedAppointment,
        original_24h: originalAppointment,
        actual_arrival_time: actualArrivalTimeSpeech,
        actual_arrival_24h: actualArrivalTime24h,
        // Rounded arrival time for natural speech (e.g., "around 5:55 PM" instead of "5:54 PM")
        actual_arrival_rounded: actualArrivalRoundedSpeech,
        actual_arrival_rounded_24h: actualArrivalRounded24h,
        otif_window_start: otifWindowStartSpeech,
        otif_window_end: otifWindowEndSpeech,
        // Delay in human-friendly format (e.g., "almost 4 hours" instead of "234 minutes")
        delay_friendly: delayFriendly,
        delay_minutes: delayMinutes.toString(),
        shipment_value: shipmentValue.toString(),
        retailer: workflow.partyName || 'Walmart', // Use extracted party name or fallback
        // Pass extracted contract terms to webhook for consistent cost calculations
        extracted_terms_json: extractedTermsJson,
        // Pass pre-computed strategy to ensure VAPI uses exact same thresholds as UI
        strategy_json: strategyJson,
        // HOS variables (only populated if HOS is enabled)
        ...hosVariables,
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

  // End VAPI call function (warehouse)
  const endVapiCall = () => {
    if (vapiClientRef.current) {
      vapiClientRef.current.stop();
    }
  };

  // Unified end call function that works for both WebRTC and Phone modes
  const endCurrentCall = useCallback(() => {
    if (isPhoneTransport) {
      console.log('📞 Auto-ending Twilio call');
      twilioCall.endCall();
    } else {
      console.log('🎙️ Auto-ending WebRTC call');
      endVapiCall();
    }
  }, [isPhoneTransport, twilioCall]);

  // ==========================================================================
  // TWILIO/PHONE CALL FUNCTIONS
  // ==========================================================================

  /**
   * Start outbound phone call via Twilio (phone transport mode)
   * Similar to startVapiCall but uses server-side API instead of client-side SDK
   */
  const startTwilioCall = async () => {
    try {
      console.log('📞 Starting Twilio outbound call');

      // Import time utilities
      const { formatTimeForSpeech, addMinutesToTime, roundTimeToFiveMinutes, formatDelayForSpeech } = await import('@/lib/time-parser');
      const { originalAppointment, delayMinutes, shipmentValue, hosEnabled, driverHOS } = workflow.setupParams;

      // Calculate time values
      const formattedAppointment = formatTimeForSpeech(originalAppointment);
      const actualArrivalTime24h = addMinutesToTime(originalAppointment, delayMinutes);
      const actualArrivalTimeSpeech = formatTimeForSpeech(actualArrivalTime24h);
      const actualArrivalRounded24h = roundTimeToFiveMinutes(actualArrivalTime24h);
      const actualArrivalRoundedSpeech = formatTimeForSpeech(actualArrivalRounded24h);
      const delayFriendly = formatDelayForSpeech(delayMinutes);

      const OTIF_WINDOW_MINUTES = 30;
      const otifWindowStart24h = addMinutesToTime(originalAppointment, -OTIF_WINDOW_MINUTES);
      const otifWindowEnd24h = addMinutesToTime(originalAppointment, OTIF_WINDOW_MINUTES);
      const otifWindowStartSpeech = formatTimeForSpeech(otifWindowStart24h);
      const otifWindowEndSpeech = formatTimeForSpeech(otifWindowEnd24h);

      // Serialize extracted contract terms for VAPI webhook
      const extractedTermsJson = workflow.extractedTerms
        ? JSON.stringify(workflow.extractedTerms)
        : '';

      // Serialize negotiation strategy for VAPI webhook
      const strategyJson = workflow.negotiationStrategy
        ? JSON.stringify({
            thresholds: workflow.negotiationStrategy.thresholds,
            costThresholds: workflow.negotiationStrategy.costThresholds,
            maxPushbackAttempts: workflow.negotiationStrategy.maxPushbackAttempts,
            display: workflow.negotiationStrategy.display,
          })
        : '';

      // Build HOS variables if enabled
      let hosVariables: Record<string, string> = {};
      const hosConstraints = workflow.negotiationStrategy?.hosConstraints;
      if (hosEnabled && driverHOS && hosConstraints) {
        const formatMinutesToDuration = (mins: number) => {
          const hours = Math.floor(mins / 60);
          const minutes = mins % 60;
          if (hours === 0) return `${minutes} minutes`;
          if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
          return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
        };

        const format24hToSpeech = (time24h: string) => {
          const [hoursStr, minutesStr] = time24h.split(':');
          const hours = parseInt(hoursStr, 10);
          const minutes = parseInt(minutesStr, 10);
          const period = hours >= 12 ? 'PM' : 'AM';
          const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
          return minutes === 0 ? `${hour12} ${period}` : `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
        };

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

      // Build variable values for VAPI assistant (same as WebRTC mode)
      const variableValues = {
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
        retailer: workflow.partyName || 'Walmart',
        extracted_terms_json: extractedTermsJson,
        strategy_json: strategyJson,
        ...hosVariables,
      };

      console.log('📞 Twilio call variables:', variableValues);

      // Start the call via Twilio hook
      const success = await twilioCall.startCall(variableValues);

      if (success) {
        console.log('✅ Twilio call initiated successfully');
      } else {
        console.error('❌ Failed to initiate Twilio call');
        alert('Failed to start phone call. Please check console for details.');
      }
    } catch (error) {
      console.error('Failed to start Twilio call:', error);
      alert('Failed to start phone call. Please check console for details.');
    }
  };

  /**
   * Start call based on current transport mode
   */
  const startCall = async () => {
    if (isPhoneTransport) {
      await startTwilioCall();
    } else {
      await startVapiCall();
    }
  };

  // ==========================================================================
  // PHASE 12: DRIVER CONFIRMATION CALL FUNCTIONS
  // ==========================================================================

  /**
   * Put the warehouse call on hold and start driver confirmation
   * Called when we reach tentative agreement and driver confirmation is enabled
   */
  // Phase 12: Store tentative agreement for use after warehouse call ends
  const pendingTentativeAgreementRef = useRef<{
    time: string;
    dock: string;
    costImpact: number;
    warehouseContact: string | null;
  } | null>(null);

  // Phase 12: Track if we're waiting for silence to end warehouse call
  const waitingForSilenceToEndCallRef = useRef<boolean>(false);
  const silenceTimerForEndCallRef = useRef<NodeJS.Timeout | null>(null);

  // Phase 12: Function to end warehouse call and start driver call
  const endWarehouseAndStartDriverCall = useCallback(() => {
    if (!vapiClientRef.current) return;

    console.log('[Phase12] Ending warehouse call after 2s silence');
    workflow.setConversationPhase('warehouse_on_hold');

    // Show driver confirmation UI
    setLoadingDriverConfirm(true);
    setTimeout(() => {
      setLoadingDriverConfirm(false);
      setShowDriverConfirmation(true);
    }, 500);

    // End warehouse call - browser can only have one active call
    try {
      vapiClientRef.current.stop();
    } catch (e) {
      console.error('[Phase12] Error stopping warehouse call:', e);
    }

    // Start 60-second timeout for driver confirmation
    holdTimeoutRef.current = setTimeout(() => {
      console.log('[Phase12] Hold timeout expired - driver did not respond');
      handleDriverCallResult('timeout');
    }, 60000);

    // Start driver call after short delay to ensure mic is released
    setTimeout(() => {
      if (pendingTentativeAgreementRef.current) {
        startDriverConfirmationCall(pendingTentativeAgreementRef.current);
      }
    }, 1500);

    // Reset the waiting flag
    waitingForSilenceToEndCallRef.current = false;
  }, [workflow]);

  const initiateDriverConfirmation = useCallback(async (overrides?: { time?: string; dock?: string }) => {
    if (!vapiClientRef.current) {
      console.error('[Phase12] No warehouse VAPI client - cannot initiate driver confirmation');
      return;
    }

    // Pass overrides to createTentativeAgreement in case refs haven't synced yet
    const tentativeAgreement = workflow.createTentativeAgreement(overrides);
    if (!tentativeAgreement) {
      console.error('[Phase12] Cannot create tentative agreement - missing time or dock');
      return;
    }

    console.log('[Phase12] Initiating driver confirmation flow', tentativeAgreement);

    // Store the tentative agreement for use after warehouse call ends
    pendingTentativeAgreementRef.current = tentativeAgreement;

    // Step 1: Set phase and inject system message telling Mike to say brief hold/callback message
    workflow.setConversationPhase('putting_on_hold');
    vapiClientRef.current.send({
      type: 'add-message',
      message: {
        role: 'system',
        content: `DRIVER CONFIRMATION REQUIRED: You need to quickly confirm with your driver before finalizing. Say something brief like "Perfect, let me just confirm real quick with my driver - one moment."`,
      },
    });
    console.log('[Phase12] Injected driver confirmation message');

    // Step 2: Set flag to wait for 2 seconds of silence after Mike finishes speaking
    waitingForSilenceToEndCallRef.current = true;
    console.log('[Phase12] Waiting for Mike to finish speaking + 2s silence...');

    // Fallback timeout in case speech events don't fire (10 seconds max)
    setTimeout(() => {
      if (waitingForSilenceToEndCallRef.current) {
        console.log('[Phase12] Fallback: ending call after 10s max wait');
        endWarehouseAndStartDriverCall();
      }
    }, 10000);
  }, [workflow, endWarehouseAndStartDriverCall]);

  /**
   * Start the driver confirmation VAPI call
   */
  const startDriverConfirmationCall = async (tentativeAgreement: { time: string; dock: string; costImpact: number; warehouseContact: string | null }) => {
    try {
      console.log('[Phase12] Starting driver confirmation call');
      setDriverCallStatus('connecting');
      workflow.setConversationPhase('driver_call_connecting');

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
        console.log('[Phase12] 🟢 Driver call started');
        setDriverCallStatus('active');
        workflow.setConversationPhase('driver_call_active');
      });

      driverClient.on('call-end', () => {
        console.log('[Phase12] 🔴 Driver call ended');
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
        console.log('[Phase12] 📨 Driver Message:', msg.type, msg);

        // Handle transcript messages to detect confirmation/rejection
        if (msg.type === 'transcript' && msg.transcriptType === 'final') {
          const content = msg.transcript.toLowerCase();

          // Check for driver confirmation
          if (content.includes('confirm') || content.includes('yes') ||
              content.includes('sounds good') || content.includes('works for me') ||
              content.includes('i can make') || content.includes("i'll be there")) {
            console.log('[Phase12] ✅ Driver confirmed');
            handleDriverCallResult('confirmed');
          }
          // Check for driver rejection
          else if (content.includes('no') || content.includes("can't") ||
                   content.includes('cannot') || content.includes("won't") ||
                   content.includes('not going to') || content.includes('impossible')) {
            console.log('[Phase12] ❌ Driver rejected');
            handleDriverCallResult('rejected');
          }
        }
      });

      driverClient.on('error', (error: unknown) => {
        console.error('[Phase12] ❌ Driver VAPI error:', error);
        handleDriverCallResult('failed');
      });

      // Prepare variables for driver assistant
      const { formatTimeForSpeech } = await import('@/lib/time-parser');
      const driverVariables = {
        proposed_time: formatTimeForSpeech(tentativeAgreement.time),
        proposed_time_24h: tentativeAgreement.time,
        proposed_dock: tentativeAgreement.dock,
        warehouse_name: tentativeAgreement.warehouseContact || 'the warehouse',
        original_appointment: formatTimeForSpeech(workflow.setupParams.originalAppointment),
      };

      console.log('[Phase12] 🚀 Starting driver VAPI call with variables:', driverVariables);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (driverClient as any).start(VAPI_DRIVER_ASSISTANT_ID, {
        variableValues: driverVariables,
      });

      console.log('[Phase12] ✅ Driver call started successfully');
    } catch (error) {
      console.error('[Phase12] Failed to start driver call:', error);
      handleDriverCallResult('failed');
    }
  };

  /**
   * Handle the result of the driver confirmation call
   * Note: The warehouse call has already ended - we show results in UI only
   */
  const handleDriverCallResult = useCallback(async (result: 'confirmed' | 'rejected' | 'timeout' | 'failed') => {
    console.log('[Phase12] Handling driver call result:', result);

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
        console.error('[Phase12] Error stopping driver call:', e);
      }
      driverVapiClientRef.current = null;
    }

    setDriverCallStatus(result);

    // Clear the pending tentative agreement
    pendingTentativeAgreementRef.current = null;

    if (result === 'confirmed') {
      // Driver confirmed - finalize the agreement
      console.log('[Phase12] Driver confirmed - finalizing agreement');
      workflow.setConversationPhase('final_confirmation');

      // Save to Google Sheets with DRIVER_CONFIRMED status
      await saveScheduleToSheets('DRIVER_CONFIRMED');

      // Set call status to ended and show finalized agreement UI
      setCallStatus('ended');

      // Trigger finalized agreement section after a short delay
      setLoadingFinalized(true);
      setTimeout(() => {
        setLoadingFinalized(false);
        setShowFinalizedAgreement(true);
        workflow.setConversationPhase('done');
      }, 500);
    } else {
      // Driver rejected/timeout/failed - end with failure
      console.log('[Phase12] Driver unavailable - ending with failure');
      workflow.setConversationPhase('driver_failed');

      // Save to Google Sheets with DRIVER_UNAVAILABLE status
      await saveScheduleToSheets('DRIVER_UNAVAILABLE');

      // Set call status to ended
      setCallStatus('ended');
      workflow.setConversationPhase('done');
    }
  }, [workflow]);

  /**
   * Save schedule to Google Sheets with specified status
   */
  const saveScheduleToSheets = async (status: AgreementStatus) => {
    const confirmedTime = workflow.confirmedTimeRef.current;
    const confirmedDock = workflow.confirmedDockRef.current;

    if (!confirmedTime || !confirmedDock) {
      console.warn('[Phase12] Cannot save to sheets - missing confirmed time or dock');
      return;
    }

    try {
      const scheduleData = {
        timestamp: new Date().toISOString(),
        originalAppointment: workflow.setupParams.originalAppointment,
        confirmedTime,
        confirmedDock,
        delayMinutes: workflow.setupParams.delayMinutes,
        shipmentValue: workflow.setupParams.shipmentValue,
        totalCost: workflow.currentCostAnalysis?.totalCost || 0,
        warehouseContact: workflow.warehouseManagerNameRef.current || undefined,
        partyName: workflow.partyName || undefined,
        contractFileName: workflow.contractFileName || undefined,
        status,
      };

      const response = await fetch('/api/schedule/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData),
      });

      const result = await response.json();

      if (result.success) {
        console.log('[Phase12] ✅ Schedule saved to Google Sheets:', result.spreadsheetUrl);
        setSaveStatus({
          success: true,
          message: `Schedule saved with status: ${status}`,
          spreadsheetUrl: result.spreadsheetUrl,
        });
      } else {
        console.error('[Phase12] ❌ Failed to save schedule:', result.error);
        setSaveStatus({
          success: false,
          message: `Failed to save: ${result.error}`,
        });
      }
    } catch (error) {
      console.error('[Phase12] ❌ Error saving schedule:', error);
      setSaveStatus({
        success: false,
        message: 'Error saving to Google Sheets',
      });
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoEndTimerRef.current) {
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
      // Phase 12: Cleanup hold timeout
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
      // Phase 12: Cleanup driver VAPI client
      if (driverVapiClientRef.current) {
        try {
          driverVapiClientRef.current.stop();
        } catch (e) {
          // Ignore errors during cleanup
        }
        driverVapiClientRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // EVENT-DRIVEN PROGRESSIVE DISCLOSURE WITH LOADING STATES
  // Each step triggers the next when it completes (with 1s loading spinner)
  // ============================================================================

  // Step 1: Analysis completes → Collapse reasoning panel
  useEffect(() => {
    if (workflow.workflowStage === 'negotiating' && !workflow.activeStepId && !reasoningCollapsed) {
      console.log('✅ Step 1: Analysis complete → Collapsing reasoning');
      setReasoningCollapsed(true);
    }
  }, [workflow.workflowStage, workflow.activeStepId, reasoningCollapsed]);

  // Step 2: Reasoning collapsed → Loading → Show summary
  useEffect(() => {
    if (reasoningCollapsed && !showSummary) {
      console.log('⏳ Step 2a: Loading summary...');
      setLoadingSummary(true);

      const timer = setTimeout(() => {
        console.log('✅ Step 2b: Showing summary');
        setLoadingSummary(false);
        setShowSummary(true);
      }, 1000);

      return () => {
        console.log('🧹 Cleaning up summary timer');
        clearTimeout(timer);
      };
    }
  }, [reasoningCollapsed, showSummary]);

  // Step 3: Summary typing complete → Loading → Show strategy panel
  useEffect(() => {
    if (summaryTypingComplete && !showStrategy) {
      console.log('⏳ Step 3a: Loading strategy...');
      setLoadingStrategy(true);

      const timer = setTimeout(() => {
        console.log('✅ Step 3b: Showing strategy');
        setLoadingStrategy(false);
        setShowStrategy(true);
      }, 1000);

      return () => {
        console.log('🧹 Cleaning up strategy timer');
        clearTimeout(timer);
      };
    }
  }, [summaryTypingComplete, showStrategy]);

  // Step 4: Strategy shown → Loading → Show voice subagent message (voice mode) or call button (text mode)
  useEffect(() => {
    const isVoiceMode = workflow.setupParams.communicationMode === 'voice';

    if (showStrategy && !showVoiceSubagent && !showCallButton) {
      if (isVoiceMode) {
        console.log('⏳ Step 4a: Loading voice subagent...');
        setLoadingVoiceSubagent(true);

        const timer = setTimeout(() => {
          console.log('✅ Step 4b: Showing voice subagent');
          setLoadingVoiceSubagent(false);
          setShowVoiceSubagent(true);
        }, 1000);

        return () => {
          console.log('🧹 Cleaning up voice subagent timer');
          clearTimeout(timer);
        };
      } else {
        console.log('⏳ Step 4a: Loading call button (text mode)...');
        setLoadingCallButton(true);

        const timer = setTimeout(() => {
          console.log('✅ Step 4b: Showing call button');
          setLoadingCallButton(false);
          setShowCallButton(true);
        }, 1000);

        return () => {
          console.log('🧹 Cleaning up call button timer (text mode)');
          clearTimeout(timer);
        };
      }
    }
  }, [showStrategy, showVoiceSubagent, showCallButton, workflow.setupParams.communicationMode]);

  // Step 5: Voice subagent typing complete → Loading → Show call button (voice mode only)
  useEffect(() => {
    if (voiceSubagentTypingComplete && !showCallButton) {
      console.log('⏳ Step 5a: Loading call button...');
      setLoadingCallButton(true);

      const timer = setTimeout(() => {
        console.log('✅ Step 5b: Showing call button');
        setLoadingCallButton(false);
        setShowCallButton(true);
      }, 1000);

      return () => {
        console.log('🧹 Cleaning up call button timer (voice mode)');
        clearTimeout(timer);
      };
    }
  }, [voiceSubagentTypingComplete, showCallButton]);

  // Step 5b: Auto-start phone call when in phone transport mode
  // Phone calls auto-dial; web calls wait for user to click button
  const phoneCallInitiatedRef = useRef(false);
  useEffect(() => {
    if (
      showCallButton &&
      isPhoneTransport &&
      effectiveCallStatus === 'idle' &&
      !phoneCallInitiatedRef.current
    ) {
      console.log('📞 Auto-starting phone call (phone transport mode)');
      phoneCallInitiatedRef.current = true;
      startCall();
    }
  }, [showCallButton, isPhoneTransport, effectiveCallStatus]);

  // Step 5c: Process Twilio messages and add them to the chat (phone transport mode)
  // Server sends complete message list on each update. Messages grow as speech continues.
  // We process a message when:
  // - A NEW message appears after it (meaning it's complete), OR
  // - The server signals lastMessageComplete=true (speech-update status=stopped)
  const lastProcessedIndexRef = useRef<number>(-1);
  const isProcessingMessagesRef = useRef<boolean>(false);
  useEffect(() => {
    if (!isPhoneTransport || twilioCall.messages.length === 0) return;
    if (isProcessingMessagesRef.current) return; // Prevent concurrent processing

    const messageCount = twilioCall.messages.length;
    const callEnded = twilioCall.callState.status === 'ended';

    // Determine how many messages to process:
    // - All but last (last may be in progress)
    // - Unless lastMessageComplete is true (speaker stopped)
    // - Or call ended (process everything)
    const canProcessLastMessage = callEnded || twilioCall.lastMessageComplete;
    const processUpTo = canProcessLastMessage ? messageCount : messageCount - 1;

    // Skip if nothing new to process
    if (lastProcessedIndexRef.current + 1 >= processUpTo) {
      return;
    }

    // CRITICAL: Set the lock SYNCHRONOUSLY before calling async function
    // This prevents race conditions where the effect runs again before processing starts
    isProcessingMessagesRef.current = true;

    // Process messages sequentially to ensure refs are set before checking them
    // CRITICAL: handleVapiTranscript is async (calls extraction API)
    // We must await each message before processing the next one
    const processMessages = async () => {
      try {
        for (let i = lastProcessedIndexRef.current + 1; i < processUpTo; i++) {
          const msg = twilioCall.messages[i];

          const role = msg.role === 'assistant' ? 'dispatcher' : 'warehouse';
          console.log(`📞 [Twilio] Processing ${role} message (index ${i}/${processUpTo - 1}):`, msg.content.substring(0, 50));

          await handleVapiTranscript({
            role: role as 'dispatcher' | 'warehouse',
            content: msg.content,
            timestamp: new Date(msg.timestamp).toLocaleTimeString(),
          });

          lastProcessedIndexRef.current = i;
        }
      } finally {
        isProcessingMessagesRef.current = false;
      }
    };

    processMessages();
  }, [isPhoneTransport, twilioCall.messages, twilioCall.callState.status, twilioCall.lastMessageComplete]);

  // Reset processed message tracking when workflow resets
  useEffect(() => {
    if (workflow.workflowStage === 'setup') {
      lastProcessedIndexRef.current = -1;
      phoneAutoEndingRef.current = false;
    }
  }, [workflow.workflowStage]);

  // Step 6: Call ends with confirmed details → Show finalized agreement section
  // IMPORTANT: Don't show finalized agreement if driver confirmation is in progress
  useEffect(() => {
    // Skip if driver confirmation flow is active - it handles showing finalized agreement
    const isDriverConfirmInProgress = showDriverConfirmation &&
      !['confirmed', 'rejected', 'timeout', 'failed'].includes(driverCallStatus);

    // Use effectiveCallStatus for both web and phone modes
    if (
      effectiveCallStatus === 'ended' &&
      workflow.confirmedTime &&
      workflow.confirmedDock &&
      !showFinalizedAgreement &&
      !isDriverConfirmInProgress
    ) {
      console.log('⏳ Step 6a: Loading finalized agreement...');
      setLoadingFinalized(true);

      const timer = setTimeout(() => {
        console.log('✅ Step 6b: Showing finalized agreement');
        setLoadingFinalized(false);
        setShowFinalizedAgreement(true);
      }, 1000);

      return () => {
        console.log('🧹 Cleaning up finalized timer');
        clearTimeout(timer);
      };
    }
  }, [effectiveCallStatus, workflow.confirmedTime, workflow.confirmedDock, showFinalizedAgreement, showDriverConfirmation, driverCallStatus]);

  // Reset progressive disclosure states when workflow is reset
  useEffect(() => {
    if (workflow.workflowStage === 'setup') {
      setShowSummary(false);
      setSummaryHeaderComplete(false);
      setSummaryTypingComplete(false);
      setShowStrategy(false);
      setShowVoiceSubagent(false);
      setVoiceSubagentHeaderComplete(false);
      setVoiceSubagentTypingComplete(false);
      setShowCallButton(false);
      setReasoningCollapsed(false);
      setLoadingSummary(false);
      setLoadingStrategy(false);
      setLoadingVoiceSubagent(false);
      setLoadingCallButton(false);
      setShowFinalizedAgreement(false);
      setFinalizedHeaderComplete(false);
      setFinalizedTypingComplete(false);
      setLoadingFinalized(false);
      // Phase 12: Reset driver confirmation state
      setDriverCallStatus('idle');
      driverCallStatusRef.current = 'idle';
      setShowDriverConfirmation(false);
      setDriverConfirmHeaderComplete(false);
      setDriverConfirmTypingComplete(false);
      setLoadingDriverConfirm(false);
      // Reset phone call initiated flag
      phoneCallInitiatedRef.current = false;
      // Reset Twilio call state
      twilioCall.resetCall();
    }
  }, [workflow.workflowStage, twilioCall.resetCall]);

  const isVoiceMode = workflow.setupParams.communicationMode === 'voice';
  const isNegotiating = workflow.workflowStage === 'negotiating';
  const isComplete = workflow.workflowStage === 'complete';

  // Smooth scroll to top when entering split view
  useEffect(() => {
    const isChatActive = showCallButton || workflow.chatMessages.length > 0 || callStatus !== 'idle';
    const shouldSplit = isChatActive && !isComplete;

    if (shouldSplit) {
      // Delay scroll slightly to allow layout transition
      const timer = setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [showCallButton, workflow.chatMessages.length, callStatus, isComplete]);

  // Debug logging for strategy panel visibility
  useEffect(() => {
    console.log('🎯 Strategy Panel Visibility Check:', {
      showStrategy,
      hasNegotiationStrategy: !!workflow.negotiationStrategy,
      isNegotiating: workflow.workflowStage === 'negotiating',
      shouldShow: showStrategy && workflow.negotiationStrategy && (workflow.workflowStage === 'negotiating')
    });
  }, [showStrategy, workflow.negotiationStrategy, workflow.workflowStage]);

  // Auto-end call when conversation is done
  // For voice mode: Only use this as a fallback when phase is 'done' (set by our speech detection)
  // The primary ending mechanism is speech detection + silence timer
  // Use effectiveCallStatus to work with both WebRTC and Phone/Twilio modes
  useAutoEndCall(
    workflow.conversationPhase === 'done',
    effectiveCallStatus,
    endCurrentCall,
    isVoiceMode ? 1000 : 2000  // Shorter delay for voice since silence already elapsed
  );

  // Silence duration before auto-ending call (in milliseconds)
  const SILENCE_DURATION_MS = 2000;

  // =========================================================================
  // ASSISTANT SPEECH STATE HANDLERS
  // =========================================================================

  function handleAssistantSpeechStart() {
    console.log('🔊 Assistant started speaking');
    isAssistantSpeakingRef.current = true;

    // If we were waiting for silence, cancel the timer since assistant is speaking
    if (autoEndTimerRef.current) {
      console.log('🔇 Cancelling silence timer - assistant is speaking');
      clearTimeout(autoEndTimerRef.current);
      autoEndTimerRef.current = null;
    }

    // Phase 12: Cancel driver confirmation silence timer if assistant speaks again
    if (silenceTimerForEndCallRef.current) {
      console.log('[Phase12] 🔇 Cancelling driver confirmation silence timer - assistant is speaking');
      clearTimeout(silenceTimerForEndCallRef.current);
      silenceTimerForEndCallRef.current = null;
    }
  }

  function handleAssistantSpeechEnd() {
    console.log('🔇 Assistant finished speaking');
    isAssistantSpeakingRef.current = false;

    // Phase 12: If waiting for silence to end warehouse call for driver confirmation
    if (waitingForSilenceToEndCallRef.current) {
      console.log('[Phase12] ⏳ Mike finished speaking - starting 2s silence timer before ending warehouse call');

      // Clear any existing timer
      if (silenceTimerForEndCallRef.current) {
        clearTimeout(silenceTimerForEndCallRef.current);
      }

      // Start 2-second silence timer
      silenceTimerForEndCallRef.current = setTimeout(() => {
        if (waitingForSilenceToEndCallRef.current) {
          console.log('[Phase12] ✅ 2s silence complete - ending warehouse call');
          endWarehouseAndStartDriverCall();
        }
      }, 2000);
      return;
    }

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
      // Double-check we still have confirmed time/dock before ending
      if (workflow.confirmedTimeRef.current && workflow.confirmedDockRef.current) {
        console.log('✅ Silence period complete - ending call');
        workflow.setConversationPhase('done');
      } else {
        console.log('⚠️ Timer fired but missing confirmed time/dock - not ending');
      }
      autoEndTimerRef.current = null;
    }, SILENCE_DURATION_MS);
  }

  // Handle VAPI transcript
  async function handleVapiTranscript(data: VapiTranscriptData) {
    console.log(`➕ Adding chat message: [${data.role}] "${data.content}"`);
    workflow.addChatMessage(data.role, data.content);

    // =========================================================================
    // DISPATCHER MESSAGE AFTER CONFIRMATION = END CALL
    // =========================================================================
    // Simple logic: If we have confirmed time + dock, and dispatcher speaks,
    // that's the closing confirmation message. No pattern matching needed.
    if (data.role === 'dispatcher') {
      const hasConfirmedDeal = workflow.confirmedTimeRef.current && workflow.confirmedDockRef.current;

      console.log(`🔍 Dispatcher spoke: hasConfirmedDeal=${hasConfirmedDeal}, confirmedTime=${workflow.confirmedTimeRef.current}, confirmedDock=${workflow.confirmedDockRef.current}`);

      if (hasConfirmedDeal) {
        console.log('🔔 Deal confirmed + dispatcher spoke - triggering end call flow');

        // Generate agreement if not already done
        if (!workflow.finalAgreement) {
          const currentCost = workflow.currentCostAnalysis?.totalCost || 0;
          const agreementText = generateAgreementText({
            originalTime: workflow.setupParams.originalAppointment,
            newTime: workflow.confirmedTimeRef.current!, // Already checked in hasConfirmedDeal
            dock: workflow.confirmedDockRef.current!,    // Already checked in hasConfirmedDeal
            delayMinutes: workflow.setupParams.delayMinutes,
            costImpact: currentCost,
            warehouseContact: workflow.warehouseManagerName,
            dayOffset: workflow.confirmedDayOffsetRef.current ?? 0,
          });
          workflow.setFinalAgreement(agreementText);
        }

        // Clear any existing timer
        if (autoEndTimerRef.current) {
          clearTimeout(autoEndTimerRef.current);
          autoEndTimerRef.current = null;
        }

        // For PHONE mode: We don't have speech events, so just end after a delay
        if (isPhoneTransport) {
          console.log('📞 [Phone] Deal confirmed + dispatcher spoke - ending call after 3s delay');
          // Set flag to prevent warehouse messages from cancelling the timer
          phoneAutoEndingRef.current = true;
          autoEndTimerRef.current = setTimeout(() => {
            console.log('📞 [Phone] Auto-ending call now');
            phoneAutoEndingRef.current = false;
            twilioCall.endCall();
          }, 2000); // 2 second delay to allow conversation to naturally end
          return;
        }

        // For WEB mode: Use speech events for graceful ending
        // If assistant is currently speaking, wait for speech to end before starting timer
        if (isAssistantSpeakingRef.current) {
          console.log('🔊 Assistant still speaking - will start silence timer when done');
          waitingForSpeechEndRef.current = true;
        } else {
          // Assistant already finished speaking (or speech state unknown), start timer now
          // Add a small delay to account for any speech-to-text latency
          console.log('🔇 Assistant not speaking - starting silence timer after short delay');
          setTimeout(() => {
            // Only start timer if assistant hasn't started speaking again
            if (!isAssistantSpeakingRef.current) {
              startSilenceTimer();
            } else {
              waitingForSpeechEndRef.current = true;
            }
          }, 500);
        }
      }

      // =========================================================================
      // EXTRACT DOCK FROM MIKE'S CONFIRMATIONS (FALLBACK)
      // =========================================================================
      // If we're waiting for a dock (have pending time but no confirmed dock)
      if (pendingAcceptedTimeRef.current && !workflow.confirmedDockRef.current) {
        console.log('🔍 Mike spoke, checking for dock in his confirmation:', data.content);

        // Try to extract dock from Mike's confirmation
        const dockMatch = data.content.match(/(?:dock|door|bay)\s+(\d+|[a-z]\d*)/i);
        if (dockMatch) {
          const extractedDock = dockMatch[1];
          console.log('✅ Extracted dock from Mike\'s confirmation:', extractedDock);

          // Complete the negotiation with pending time + extracted dock
          finishNegotiation(
            pendingAcceptedTimeRef.current,
            extractedDock,
            pendingAcceptedCostRef.current,
            false,
            pendingAcceptedDayOffsetRef.current
          );
          pendingAcceptedTimeRef.current = null;
          pendingAcceptedDayOffsetRef.current = 0;
        }
      }

      return;
    }

    // =========================================================================
    // WAREHOUSE MANAGER SPOKE - CANCEL AUTO-END TIMER & CONTINUE CONVERSATION
    // =========================================================================
    if (data.role === 'warehouse') {
      // For PHONE mode: If we're in the auto-ending state (closing phrase detected),
      // don't cancel the timer - we're just processing historical messages
      if (phoneAutoEndingRef.current) {
        console.log('📞 [Phone] Warehouse message received but auto-end in progress - not cancelling timer');
      } else {
        // Cancel any pending silence timer
        if (autoEndTimerRef.current) {
          console.log('🗣️ Warehouse manager spoke - cancelling auto-end timer');
          clearTimeout(autoEndTimerRef.current);
          autoEndTimerRef.current = null;
        }

        // Also cancel waiting for speech end - we're continuing the conversation
        if (waitingForSpeechEndRef.current) {
          console.log('🗣️ Warehouse manager spoke - cancelling wait for speech end');
          waitingForSpeechEndRef.current = false;
        }
      }

      // The conversation will continue naturally:
      // 1. VAPI will process the user's message
      // 2. Mike will respond to their query/concern
      // 3. If Mike says another closing phrase, the cycle restarts
      // 4. We only end the call after silence following a closing phrase
    }

    if (data.role !== 'warehouse') return;

    // Extract warehouse manager name
    const name = extractWarehouseManagerName(data.content);
    console.log(`👤 Extracted name: ${name}, current name: ${workflow.warehouseManagerName}`);
    if (name && !workflow.warehouseManagerName) {
      console.log(`✅ Setting warehouse manager name: ${name}`);
      workflow.setWarehouseManagerName(name);
      // Mark contact task as completed, negotiation as starting
      workflow.updateTaskStatus('contact', 'completed');
      workflow.updateTaskStatus('negotiate', 'in_progress');
    }

    // Use backend API to extract slot information
    console.log(`🔍 Calling /api/extract for: "${data.content}"`);
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: data.content }),
      });

      if (!response.ok) throw new Error('Extraction failed');

      const extracted = await response.json();
      console.log(`📊 Extraction result:`, extracted);

      if (extracted.confidence === 'low') {
        console.log('⚠️ Low confidence extraction');
        // Check if we already have both values from refs
        const currentTime = workflow.confirmedTimeRef.current;
        const currentDock = workflow.confirmedDockRef.current;

        if (currentTime && currentDock) {
          // We have both, check if we should accept (using stored day offset)
          const currentDayOffset = workflow.confirmedDayOffsetRef.current ?? 0;
          const { costAnalysis, evaluation } = workflow.evaluateTimeOffer(currentTime, currentDayOffset);

          if (evaluation.shouldAccept) {
            finishNegotiation(currentTime, currentDock, costAnalysis.totalCost, false, currentDayOffset);
            return;
          }
        }
        return;
      }

      // Extract offered values (but don't set as confirmed yet!)
      // Only set confirmed time/dock when we actually accept the offer
      const offeredTime = extracted.time;
      const offeredDock = extracted.dock;
      const offeredDayOffset = extracted.dayOffset ?? 0;
      const dateIndicator = extracted.dateIndicator;

      console.log('Extraction result:', { offeredTime, offeredDock, offeredDayOffset, dateIndicator, confidence: extracted.confidence });

      // Determine current values from multiple sources
      const currentTime = offeredTime || pendingAcceptedTimeRef.current || workflow.confirmedTimeRef.current;
      const currentDock = offeredDock || workflow.confirmedDockRef.current;

      // Case 1: We got a time offer (with or without dock)
      if (offeredTime) {
        const { costAnalysis, evaluation } = workflow.evaluateTimeOffer(offeredTime, offeredDayOffset);

        // Attach cost analysis to the warehouse message that triggered this evaluation
        // (This shows the evaluation inline with the chat message - no need to add to Reasoning block)
        workflow.attachCostAnalysisToLastMessage(costAnalysis, evaluation);

        if (offeredTime && currentDock) {
          // We have both - finalize now
          if (evaluation.shouldAccept) {
            finishNegotiation(offeredTime, currentDock, costAnalysis.totalCost, false, offeredDayOffset);
            pendingAcceptedTimeRef.current = null; // Clear pending
            pendingAcceptedDayOffsetRef.current = 0;
          } else if (evaluation.shouldPushback && workflow.negotiationState.pushbackCount < 2) {
            // Strategic pushback
            workflow.incrementPushback();
            // VAPI handles pushback via its prompt - it will negotiate for a better time
            // We just increment the counter and let VAPI continue the conversation
            // Note: VAPI's cost analysis webhook gives it the same evaluation we have
          } else {
            // Force accept - out of pushback attempts
            finishNegotiation(offeredTime, currentDock, costAnalysis.totalCost, true, offeredDayOffset);
            pendingAcceptedTimeRef.current = null; // Clear pending
            pendingAcceptedDayOffsetRef.current = 0;
          }
        } else if (offeredTime && !currentDock) {
          // Time offered, waiting for dock
          // IMPORTANT: Always store pending time because VAPI makes its own acceptance decision
          // based on the cost analysis. Even if our evaluation says shouldAccept=false,
          // VAPI might accept and ask for a dock - we need the time stored for that case.
          console.log('Time offered but no dock yet. Evaluation:', evaluation);
          console.log('Storing pending time:', offeredTime, 'with cost:', costAnalysis.totalCost, 'dayOffset:', offeredDayOffset, '(VAPI will decide acceptance)');
          pendingAcceptedTimeRef.current = offeredTime;
          pendingAcceptedCostRef.current = costAnalysis.totalCost;
          pendingAcceptedDayOffsetRef.current = offeredDayOffset;
          // VAPI prompt has logic to either accept and ask for dock, or pushback
        }
      }
      // Case 2: We got ONLY a dock (time was accepted previously)
      else if (offeredDock && pendingAcceptedTimeRef.current) {
        // Complete the negotiation with pending time + new dock
        console.log('✅ Completing negotiation with pending time:', pendingAcceptedTimeRef.current, 'and dock:', offeredDock);
        finishNegotiation(pendingAcceptedTimeRef.current, offeredDock, pendingAcceptedCostRef.current, false, pendingAcceptedDayOffsetRef.current);
        pendingAcceptedTimeRef.current = null; // Clear pending
        pendingAcceptedDayOffsetRef.current = 0;
      } else if (offeredDock && !pendingAcceptedTimeRef.current) {
        console.log('⚠️ Got dock but no pending time! offeredDock:', offeredDock, 'pendingAcceptedTime:', pendingAcceptedTimeRef.current);
      }
    } catch (error) {
      console.error('Error processing transcript:', error);
    }
  }

  // Finish negotiation with confirmation
  function finishNegotiation(
    time: string,
    dock: string,
    cost: number,
    isReluctant: boolean,
    dayOffset: number = 0
  ) {
    console.log(`🎯 finishNegotiation called: time=${time}, dock=${dock}, cost=${cost}, dayOffset=${dayOffset}, isReluctant=${isReluctant}`);
    // ✅ CRITICAL: Only NOW do we set confirmed time/dock (on actual acceptance)
    workflow.setConfirmedTime(time);
    workflow.setConfirmedDock(dock);
    workflow.setConfirmedDayOffset(dayOffset);
    console.log(`✅ Confirmed time, dock, and day offset set`);

    // Agreement details are shown in the Final Agreement panel (no need to add to Reasoning block)

    // Save agreement (but don't end conversation yet)
    const agreementText = generateAgreementText({
      originalTime: workflow.setupParams.originalAppointment,
      newTime: time,
      dock: dock,
      delayMinutes: workflow.setupParams.delayMinutes,
      costImpact: cost,
      warehouseContact: workflow.warehouseManagerName,
      dayOffset: workflow.confirmedDayOffset,
    });
    workflow.setFinalAgreement(agreementText);

    // =========================================================================
    // PHASE 12: DRIVER CONFIRMATION CHECK
    // If driver confirmation is enabled, put warehouse on hold and confirm with driver
    // =========================================================================
    if (isVoiceMode && workflow.isDriverConfirmationEnabled && VAPI_DRIVER_ASSISTANT_ID) {
      console.log('[Phase12] Driver confirmation enabled - initiating driver confirmation flow');
      // Don't end the conversation yet - trigger driver confirmation
      // This will put warehouse on hold, call driver, then return
      // Pass time/dock as overrides in case refs haven't synced yet (defensive fix)
      initiateDriverConfirmation({ time, dock });
      return;
    }

    // =========================================================================
    // VOICE MODE: Let VAPI handle the closing naturally
    // - Mike will say confirmation + closing phrase via VAPI
    // - Our speech detection will detect the closing phrase
    // - We wait for Mike to finish speaking
    // - Then wait for silence before ending
    // =========================================================================
    // TEXT MODE: Still use the old immediate transition since there's no speech
    // =========================================================================
    if (!isVoiceMode) {
      // Text mode: transition after short delay
      setTimeout(() => {
        workflow.setConversationPhase('done');
      }, 3000);
    }
    // Voice mode: Don't set phase to 'done' here!
    // The closing phrase detection + silence timer will handle it
    // See handleVapiTranscript() -> DISPATCHER CLOSING PHRASE DETECTION
  }

  async function handleVapiCallEnd() {
    console.log('🏁 handleVapiCallEnd called');
    console.log(`  conversationPhase: ${workflow.conversationPhase}`);
    console.log(`  confirmedTime (state): ${workflow.confirmedTime}`);
    console.log(`  confirmedDock (state): ${workflow.confirmedDock}`);
    console.log(`  confirmedTime (ref): ${workflow.confirmedTimeRef.current}`);
    console.log(`  confirmedDock (ref): ${workflow.confirmedDockRef.current}`);

    // Phase 12: Skip normal handling if we're ending the warehouse call for driver confirmation
    // The driver confirmation flow will handle saving to Google Sheets
    const driverConfirmPhases = ['putting_on_hold', 'warehouse_on_hold', 'driver_call_connecting', 'driver_call_active'];
    if (driverConfirmPhases.includes(workflow.conversationPhase)) {
      console.log('  ℹ️ Skipping normal call-end handling - in driver confirmation flow');
      return;
    }

    // Use refs instead of state - refs update synchronously!
    const confirmedTime = workflow.confirmedTimeRef.current;
    const confirmedDock = workflow.confirmedDockRef.current;

    if (confirmedTime && confirmedDock) {
      console.log('  ✅ Setting phase to done');
      workflow.setConversationPhase('done');

      // Automatically save schedule to Google Sheets
      console.log('💾 Auto-saving schedule to Google Sheets...');
      try {
        const scheduleData = {
          timestamp: new Date().toISOString(),
          originalAppointment: workflow.setupParams.originalAppointment,
          confirmedTime: confirmedTime,
          confirmedDock: confirmedDock,
          delayMinutes: workflow.setupParams.delayMinutes,
          shipmentValue: workflow.setupParams.shipmentValue,
          totalCost: workflow.currentCostAnalysis?.totalCost || 0,
          warehouseContact: workflow.warehouseManagerNameRef.current || undefined,
          partyName: workflow.partyName || undefined,
          contractFileName: workflow.contractFileName || undefined,
          status: 'CONFIRMED' as const,
        };

        const response = await fetch('/api/schedule/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleData),
        });

        const result = await response.json();

        if (result.success) {
          console.log('✅ Schedule saved to Google Sheets:', result.spreadsheetUrl);
          setSaveStatus({
            success: true,
            message: 'Schedule saved to Google Sheets',
            spreadsheetUrl: result.spreadsheetUrl,
          });
        } else {
          console.error('❌ Failed to save schedule:', result.error);
          setSaveStatus({
            success: false,
            message: `Failed to save: ${result.error}`,
          });
        }
      } catch (error) {
        console.error('❌ Error saving schedule:', error);
        setSaveStatus({
          success: false,
          message: 'Error saving to Google Sheets',
        });
      }
    } else {
      console.log('  ⚠️ Not setting phase to done - missing time or dock');
    }
  }

  // =============================================================================
  // TEXT MODE MESSAGE HANDLER - Matches VAPI "Mike the Dispatcher" flow exactly
  // =============================================================================
  // Conversation phases:
  // 1. awaiting_name → Get their name, then explain situation
  // 2. negotiating_time → Use check_slot_cost logic, accept or counter
  // 3. awaiting_dock → Got time, need dock number
  // 4. confirming → Confirm both and close
  // 5. done → Conversation complete
  // =============================================================================

  // Helper: Format time for natural speech (e.g., "2:30" → "2:30")
  function formatTimeForSpeech(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const period = h >= 12 ? 'PM' : 'AM';
    return m === 0 ? `${hour12} ${period}` : `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  // Helper: Extract time from message (handles various formats)
  function extractTimeFromMessage(msg: string): string | null {
    // Match patterns like "2pm", "2:30 pm", "14:00", "2 o'clock", "around 3"
    const patterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)?/i,           // 2:30 pm, 14:00
      /(\d{1,2})\s*(am|pm)/i,                     // 2pm, 2 pm
      /around\s+(\d{1,2})/i,                      // around 2
      /(\d{1,2})\s*o'?clock/i,                    // 2 o'clock
    ];

    for (const pattern of patterns) {
      const match = msg.match(pattern);
      if (match) {
        let hours = parseInt(match[1]);
        const mins = match[2] && !isNaN(parseInt(match[2])) ? parseInt(match[2]) : 0;
        const period = (match[3] || match[2])?.toLowerCase();

        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        // If no AM/PM and hour <= 6, assume PM (business hours)
        if (!period && hours <= 6) hours += 12;

        return `${hours}:${mins.toString().padStart(2, '0')}`;
      }
    }
    return null;
  }

  // Helper: Extract dock from message
  function extractDockFromMessage(msg: string): string | null {
    const patterns = [
      /(?:dock|bay|door)\s*(?:number|#|num)?\s*(\w+)/i,
      /(?:at|to)\s+(\d+)/i,  // "pull up to 5"
    ];
    for (const pattern of patterns) {
      const match = msg.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // Helper: Generate suggested counter offer based on strategy
  // ALWAYS push for EARLIER times, never later!
  function getSuggestedCounterOffer(): string {
    const ideal = workflow.negotiationStrategy?.display.idealBefore;

    // Always push for the IDEAL time (within OTIF window) - that's our goal
    if (ideal) {
      return formatTimeForSpeech(ideal);
    }
    return 'earlier';
  }

  async function handleTextMessage() {
    if (!userInput.trim()) return;

    const msg = userInput.trim();
    setUserInput('');
    workflow.addChatMessage('warehouse', msg);
    workflow.setIsProcessing(true);

    const phase = workflow.conversationPhase;
    const name = extractWarehouseManagerName(msg);
    const offeredTime = extractTimeFromMessage(msg);
    const offeredDock = extractDockFromMessage(msg);

    // Detect date indicators (tomorrow, next day, etc.)
    const { indicator: dateIndicator, dayOffset: offeredDayOffset } = detectDateIndicator(msg);

    // Store name if found
    if (name && !workflow.warehouseManagerName) {
      workflow.setWarehouseManagerName(name);
      // Mark contact task as completed, negotiation as starting
      workflow.updateTaskStatus('contact', 'completed');
      workflow.updateTaskStatus('negotiate', 'in_progress');
    }

    let response = '';
    let nextPhase = phase;

    // =========================================================================
    // PHASE: AWAITING_NAME - They just told us their name
    // =========================================================================
    if (phase === 'awaiting_name') {
      const theirName = name || workflow.warehouseManagerName || 'there';
      const delay = workflow.setupParams.delayMinutes;
      const appt = workflow.setupParams.originalAppointment;

      // Mike's style: casual, warm, explains the situation
      response = `Hey ${theirName}, so I've got a truck that was supposed to be there at ${formatTimeForSpeech(appt)}, but my driver's running about ${delay} minutes behind. Any chance you can fit us in a bit later?`;
      nextPhase = 'negotiating_time';
    }

    // =========================================================================
    // PHASE: NEGOTIATING_TIME - Evaluating time offers (check_slot_cost logic)
    // =========================================================================
    else if (phase === 'negotiating_time') {
      if (offeredTime) {
        // Run check_slot_cost logic (with day offset for multi-day support)
        const { costAnalysis, evaluation } = workflow.evaluateTimeOffer(offeredTime, offeredDayOffset);
        const timeFormatted = formatTimeForSpeech(offeredTime);

        if (evaluation.shouldAccept) {
          // ACCEPT the time warmly
          workflow.setConfirmedTime(offeredTime);

          if (offeredDock) {
            // Got both time and dock!
            workflow.setConfirmedDock(offeredDock);
            const theirName = workflow.warehouseManagerName || '';
            response = `Got it — ${timeFormatted} at dock ${offeredDock}. Thanks${theirName ? `, ${theirName}` : ''}!`;
            nextPhase = 'confirming';
            // Mark negotiate and confirm-dock as completed, finalize as in_progress
            workflow.updateTaskStatus('negotiate', 'completed');
            workflow.updateTaskStatus('confirm-dock', 'completed');
            workflow.updateTaskStatus('finalize', 'in_progress');
          } else {
            // Need dock number
            response = `Perfect — which dock should we pull into?`;
            nextPhase = 'awaiting_dock';
            // Mark negotiate as completed, confirm-dock as in_progress
            workflow.updateTaskStatus('negotiate', 'completed');
            workflow.updateTaskStatus('confirm-dock', 'in_progress');
          }
        } else {
          // NOT ACCEPTABLE - counter with suggested offer
          workflow.incrementPushback();
          const counter = getSuggestedCounterOffer();

          if (workflow.negotiationState.pushbackCount >= 2) {
            // Out of pushbacks, must accept
            workflow.setConfirmedTime(offeredTime);
            if (offeredDock) {
              workflow.setConfirmedDock(offeredDock);
              response = `Alright, ${timeFormatted} at dock ${offeredDock} it is. We'll make it work.`;
              nextPhase = 'confirming';
              // Mark negotiate and confirm-dock as completed, finalize as in_progress
              workflow.updateTaskStatus('negotiate', 'completed');
              workflow.updateTaskStatus('confirm-dock', 'completed');
              workflow.updateTaskStatus('finalize', 'in_progress');
            } else {
              response = `Gotcha, ${timeFormatted} will have to do. Which dock?`;
              nextPhase = 'awaiting_dock';
              // Mark negotiate as completed, confirm-dock as in_progress
              workflow.updateTaskStatus('negotiate', 'completed');
              workflow.updateTaskStatus('confirm-dock', 'in_progress');
            }
          } else {
            // Push for earlier
            response = `Hmm, ${timeFormatted} is a bit tight for us. Anything closer to ${counter} available?`;
            // Stay in negotiating_time
          }
        }
      } else if (offeredDock && workflow.confirmedTime) {
        // They gave dock but we already have time
        workflow.setConfirmedDock(offeredDock);
        const theirName = workflow.warehouseManagerName || '';
        const timeFormatted = formatTimeForSpeech(workflow.confirmedTime);
        response = `Got it — ${timeFormatted} at dock ${offeredDock}. Thanks${theirName ? `, ${theirName}` : ''}!`;
        nextPhase = 'confirming';
        // Mark negotiate and confirm-dock as completed, finalize as in_progress
        workflow.updateTaskStatus('negotiate', 'completed');
        workflow.updateTaskStatus('confirm-dock', 'completed');
        workflow.updateTaskStatus('finalize', 'in_progress');
      } else {
        // No time found - ask for one casually
        response = `Gotcha. So what time slots do you have open?`;
      }
    }

    // =========================================================================
    // PHASE: AWAITING_DOCK - We have time, need dock
    // =========================================================================
    else if (phase === 'awaiting_dock') {
      if (offeredDock) {
        workflow.setConfirmedDock(offeredDock);
        const theirName = workflow.warehouseManagerName || '';
        const timeFormatted = workflow.confirmedTime ? formatTimeForSpeech(workflow.confirmedTime) : '';
        response = `Got it — ${timeFormatted} at dock ${offeredDock}. Thanks${theirName ? `, ${theirName}` : ''}!`;
        nextPhase = 'confirming';
        // Mark negotiate and confirm-dock as completed, finalize as in_progress
        workflow.updateTaskStatus('negotiate', 'completed');
        workflow.updateTaskStatus('confirm-dock', 'completed');
        workflow.updateTaskStatus('finalize', 'in_progress');
      } else if (offeredTime) {
        // They changed the time? Re-evaluate (with day offset)
        const { evaluation } = workflow.evaluateTimeOffer(offeredTime, offeredDayOffset);
        if (evaluation.shouldAccept) {
          workflow.setConfirmedTime(offeredTime);
        }
        response = `Got the time, but which dock should we head to?`;
      } else {
        response = `Sorry, didn't catch the dock number. Which one should we use?`;
      }
    }

    // =========================================================================
    // PHASE: CONFIRMING - Both time and dock confirmed, close out
    // =========================================================================
    else if (phase === 'confirming') {
      const theirName = workflow.warehouseManagerName || '';
      response = `Alright, we'll see you then. Appreciate your help${theirName ? `, ${theirName}` : ''}!`;
      nextPhase = 'done';

      // Save final agreement
      const agreementText = generateAgreementText({
        originalTime: workflow.setupParams.originalAppointment,
        newTime: workflow.confirmedTime || '',
        dock: workflow.confirmedDock || '',
        delayMinutes: workflow.setupParams.delayMinutes,
        costImpact: workflow.currentCostAnalysis?.totalCost || 0,
        warehouseContact: workflow.warehouseManagerName,
        dayOffset: workflow.confirmedDayOffset,
      });
      workflow.setFinalAgreement(agreementText);
    }

    // Update phase and send response
    if (nextPhase !== phase) {
      workflow.setConversationPhase(nextPhase);
    }

    setTimeout(() => {
      if (response) {
        workflow.addChatMessage('dispatcher', response);
      }
      workflow.setIsProcessing(false);

      // Auto-complete workflow if done
      if (nextPhase === 'done') {
        setTimeout(() => {
          workflow.setConversationPhase('done');
        }, 1500);
      }
    }, 600);
  }

  function handleClose() {
    // This is now handled automatically in the confirming phase
    workflow.setConversationPhase('done');
  }

  function handleFinalize() {
    workflow.setIsProcessing(true);

    if (workflow.finalAgreement) {
      // Already saved, just transition
    } else if (workflow.confirmedTime && workflow.confirmedDock) {
      const agreementText = generateAgreementText({
        originalTime: workflow.setupParams.originalAppointment,
        newTime: workflow.confirmedTime,
        dock: workflow.confirmedDock,
        delayMinutes: workflow.setupParams.delayMinutes,
        costImpact: workflow.currentCostAnalysis?.totalCost || 0,
        warehouseContact: workflow.warehouseManagerName,
        dayOffset: workflow.confirmedDayOffset,
      });
      workflow.setFinalAgreement(agreementText);
    }

    // Mark finalize task as completed
    workflow.updateTaskStatus('finalize', 'completed');
    workflow.setIsProcessing(false);
  }

  return (
    <div className="min-h-screen text-[#EDEDED]" style={{ backgroundColor: carbon.bgBase }}>
      {/* Header */}
      <header className="border-b backdrop-blur-md sticky top-0 z-50" style={{
        borderColor: carbon.border,
        backgroundColor: `${carbon.bgSurface1}cc`,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                backgroundColor: carbon.button.primary.background,
                boxShadow: '0 2px 8px rgba(237, 237, 237, 0.2)'
              }}>
                <Clock className="w-5 h-5" style={{ color: carbon.button.primary.color }} />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: carbon.textPrimary }}>
                  AI Dispatch Agent
                </h1>
                <p className="text-xs" style={{ color: carbon.textTertiary }}>
                  Live delay management with voice/text
                </p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2">
              {workflow.currentEvaluation && (
                <div
                  className="px-3 py-1.5 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: workflow.currentEvaluation.quality === 'IDEAL'
                      ? carbon.successBg
                      : workflow.currentEvaluation.quality === 'ACCEPTABLE'
                      ? carbon.accentBg
                      : workflow.currentEvaluation.quality === 'SUBOPTIMAL'
                      ? carbon.warningBg
                      : carbon.criticalBg,
                    borderColor: workflow.currentEvaluation.quality === 'IDEAL'
                      ? carbon.successBorder
                      : workflow.currentEvaluation.quality === 'ACCEPTABLE'
                      ? carbon.accentBorder
                      : workflow.currentEvaluation.quality === 'SUBOPTIMAL'
                      ? carbon.warningBorder
                      : carbon.criticalBorder,
                    color: workflow.currentEvaluation.quality === 'IDEAL'
                      ? carbon.success
                      : workflow.currentEvaluation.quality === 'ACCEPTABLE'
                      ? carbon.accent
                      : workflow.currentEvaluation.quality === 'SUBOPTIMAL'
                      ? carbon.warning
                      : carbon.critical
                  }}
                >
                  {workflow.currentEvaluation.quality}
                </div>
              )}

              <div
                className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2"
                style={{
                  backgroundColor: workflow.workflowStage === 'setup'
                    ? carbon.bgSurface2
                    : isComplete
                    ? carbon.successBg
                    : carbon.warningBg,
                  color: workflow.workflowStage === 'setup'
                    ? carbon.textSecondary
                    : isComplete
                    ? carbon.success
                    : carbon.warning
                }}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    workflow.workflowStage !== 'setup' && !isComplete ? 'animate-pulse' : ''
                  }`}
                  style={{
                    backgroundColor: workflow.workflowStage === 'setup'
                      ? carbon.textTertiary
                      : isComplete
                      ? carbon.success
                      : carbon.warning
                  }}
                />
                {workflow.workflowStage === 'setup'
                  ? 'Ready'
                  : isComplete
                  ? 'Done'
                  : 'Active'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Setup Form */}
        {workflow.workflowStage === 'setup' && (
          <SetupForm
            params={workflow.setupParams}
            onParamsChange={workflow.updateSetupParams}
            onStart={workflow.startAnalysis}
            isDriverConfirmationEnabled={workflow.isDriverConfirmationEnabled}
            onDriverConfirmationChange={workflow.setDriverConfirmationEnabled}
            isDriverConfirmationAvailable={!!VAPI_DRIVER_ASSISTANT_ID}
            isPhoneConfigured={phoneConfigured}
            warehousePhoneDisplay={warehousePhoneDisplay}
          />
        )}

        {/* Active Workflow - Adaptive Layout */}
        {workflow.workflowStage !== 'setup' && (
          <>
            {/* Determine if we should use split layout */}
            {(() => {
              const isChatActive = showCallButton || workflow.chatMessages.length > 0 || callStatus !== 'idle';
              const shouldSplit = isChatActive && !isComplete;

              return shouldSplit ? (
                /* Split Layout - Main agent flow on left, Chat on right (Claude.ai style) */
                <div className="flex flex-col lg:flex-row gap-6 items-start transition-all duration-500 ease-out">
                  {/* Left Panel - Main Agent Flow (scrollable) */}
                  <div className="flex-1 space-y-4 w-full lg:max-w-2xl animate-slide-in-right">
                    {/* Collapsible Reasoning Panel */}
                    {workflow.thinkingSteps.length > 0 && (
                      <details open={!reasoningCollapsed} className="group rounded-xl overflow-hidden transition-all duration-300 ease-in-out" style={{
                        backgroundColor: `${carbon.bgSurface1}4d`,
                        border: `1px solid ${carbon.borderSubtle}`
                      }}>
                        <summary className="px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors list-none"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${carbon.bgSurface1}80`}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <Brain className="w-4 h-4" style={{ color: carbon.warning }} />
                          <span className="text-sm font-medium" style={{ color: carbon.textSecondary }}>Reasoning</span>
                          <span className="text-xs ml-1" style={{ color: carbon.textTertiary }}>
                            ({workflow.thinkingSteps.length} steps)
                          </span>
                          {workflow.activeStepId && (
                            <Loader className="w-3 h-3 animate-spin ml-2" style={{ color: carbon.warning }} />
                          )}
                          <svg className="w-4 h-4 ml-auto transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: carbon.textTertiary }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="transition-all duration-300 ease-in-out p-3 pt-0 space-y-2 max-h-[300px] overflow-y-auto border-t" style={{ borderColor: carbon.borderSubtle }}>
                          {workflow.thinkingSteps.map((step) => (
                            <ThinkingBlock
                              key={step.id}
                              {...step}
                              isExpanded={workflow.expandedSteps[step.id] ?? false}
                              onToggle={() => workflow.toggleStepExpanded(step.id)}
                              isActive={workflow.activeStepId === step.id}
                            />
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Loading spinner between reasoning → summary */}
                    {loadingSummary && (
                      <div className="flex items-center justify-center py-6">
                        <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.warning }} />
                      </div>
                    )}

                    {/* Summary after reasoning completes */}
                    {showSummary && workflow.negotiationStrategy && (
                      <div className="border rounded-xl p-4 transition-all duration-500 ease-in-out animate-in fade-in" style={{
                        backgroundColor: carbon.successBg,
                        borderColor: carbon.successBorder
                      }}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                            backgroundColor: `${carbon.success}33`
                          }}>
                            <CheckCircle className="w-5 h-5" style={{ color: carbon.success }} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold mb-1" style={{ color: carbon.success }}>
                              {summaryHeaderComplete ? (
                                'Analysis Complete'
                              ) : (
                                <TypewriterText
                                  text="Analysis Complete"
                                  speed={30}
                                  onComplete={() => setSummaryHeaderComplete(true)}
                                />
                              )}
                            </h3>
                            {summaryHeaderComplete && (
                              summaryTypingComplete ? (
                                <p className="text-xs" style={{ color: carbon.textSecondary }}>
                                  {`Analyzed delay impact and contract terms. Identified optimal negotiation windows: ${workflow.negotiationStrategy.display.idealBefore} (ideal) to ${workflow.negotiationStrategy.display.acceptableBefore} (acceptable). Cost range: ${workflow.negotiationStrategy.thresholds.ideal.costImpact} to ${workflow.negotiationStrategy.thresholds.problematic.costImpact}.`}
                                </p>
                              ) : (
                                <div style={{ color: carbon.textSecondary }}>
                                  <TypewriterText
                                    text={`Analyzed delay impact and contract terms. Identified optimal negotiation windows: ${workflow.negotiationStrategy.display.idealBefore} (ideal) to ${workflow.negotiationStrategy.display.acceptableBefore} (acceptable). Cost range: ${workflow.negotiationStrategy.thresholds.ideal.costImpact} to ${workflow.negotiationStrategy.thresholds.problematic.costImpact}.`}
                                    speed={15}
                                    className="text-xs"
                                    as="p"
                                    onComplete={() => setSummaryTypingComplete(true)}
                                  />
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Loading spinner between summary → strategy */}
                    {loadingStrategy && (
                      <div className="flex items-center justify-center py-6">
                        <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.accent }} />
                      </div>
                    )}

                    {/* Strategy Panel - Show after summary */}
                    {showStrategy && workflow.negotiationStrategy && isNegotiating && (
                      <div className="transition-all duration-500 ease-in-out animate-fade-in">
                        <StrategyPanel
                          strategy={workflow.negotiationStrategy}
                          negotiationState={workflow.negotiationState}
                          currentEvaluation={workflow.currentEvaluation}
                          contractSource={workflow.extractedTerms ? 'extracted' : 'defaults'}
                          partyName={workflow.partyName}
                        />
                      </div>
                    )}

                    {/* Contract Terms Display - Show with strategy */}
                    {showStrategy && isNegotiating && (
                      <div className="transition-all duration-500 ease-in-out animate-fade-in">
                        <ContractTermsDisplay
                          terms={workflow.extractedTerms}
                          fileName={workflow.contractFileName}
                          error={workflow.contractError}
                        />
                      </div>
                    )}

                    {/* Loading spinner between strategy → voice subagent */}
                    {loadingVoiceSubagent && (
                      <div className="flex items-center justify-center py-6">
                        <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.accent }} />
                      </div>
                    )}

                    {/* Voice Subagent Message - Show before warehouse contact */}
                    {showVoiceSubagent && isVoiceMode && (
                      <div className="border rounded-xl p-4 transition-all duration-500 ease-in-out animate-in fade-in" style={{
                        backgroundColor: carbon.accentBg,
                        borderColor: carbon.accentBorder
                      }}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                            backgroundColor: `${carbon.accent}33`
                          }}>
                            <PhoneCall className="w-5 h-5" style={{ color: carbon.accent }} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold mb-1" style={{ color: carbon.accent }}>
                              {voiceSubagentHeaderComplete ? (
                                'Spinning up Voice Subagent'
                              ) : (
                                <TypewriterText
                                  text="Spinning up Voice Subagent"
                                  speed={30}
                                  onComplete={() => setVoiceSubagentHeaderComplete(true)}
                                />
                              )}
                            </h3>
                            {voiceSubagentHeaderComplete && (
                              voiceSubagentTypingComplete ? (
                                <p className="text-xs" style={{ color: carbon.textSecondary }}>
                                  {`Initializing AI dispatcher "Mike" to coordinate and negotiate with the warehouse manager via voice call. He'll handle the conversation naturally, following the negotiation strategy above.`}
                                </p>
                              ) : (
                                <div style={{ color: carbon.textSecondary }}>
                                  <TypewriterText
                                    text={`Initializing AI dispatcher "Mike" to coordinate and negotiate with the warehouse manager via voice call. He'll handle the conversation naturally, following the negotiation strategy above.`}
                                    speed={15}
                                    className="text-xs"
                                    as="p"
                                    onComplete={() => setVoiceSubagentTypingComplete(true)}
                                  />
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Loading spinner between voice subagent → call button */}
                    {loadingCallButton && (
                      <div className="flex items-center justify-center py-6">
                        <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.accent }} />
                      </div>
                    )}

                    {/* Phase 12: Loading spinner before driver confirmation */}
                    {loadingDriverConfirm && (
                      <div className="flex items-center justify-center py-6">
                        <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.accent }} />
                      </div>
                    )}

                    {/* Phase 12: Driver Call UI - Same structure as warehouse call */}
                    {showDriverConfirmation && (
                      <div className="border rounded-xl p-4 transition-all duration-500 ease-in-out animate-in fade-in" style={{
                        backgroundColor: carbon.accentBg,
                        borderColor: carbon.accentBorder
                      }}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                            backgroundColor: `${carbon.accent}33`
                          }}>
                            <PhoneCall className="w-5 h-5" style={{ color: carbon.accent }} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold mb-1" style={{ color: carbon.accent }}>
                              {driverConfirmHeaderComplete ? (
                                'Calling Driver for Confirmation'
                              ) : (
                                <TypewriterText
                                  text="Calling Driver for Confirmation"
                                  speed={30}
                                  onComplete={() => setDriverConfirmHeaderComplete(true)}
                                />
                              )}
                            </h3>
                            {driverConfirmHeaderComplete && (
                              driverConfirmTypingComplete ? (
                                <div className="space-y-2">
                                  <p className="text-xs" style={{ color: carbon.textSecondary }}>
                                    Confirming availability with driver before finalizing the agreement.
                                  </p>
                                  {/* Tentative Agreement Details */}
                                  <div className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: `${carbon.bgSurface2}80` }}>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs" style={{ color: carbon.textTertiary }}>Tentative Time:</span>
                                      <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
                                        {pendingTentativeAgreementRef.current?.time || workflow.confirmedTime}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs" style={{ color: carbon.textTertiary }}>Tentative Dock:</span>
                                      <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
                                        {pendingTentativeAgreementRef.current?.dock || workflow.confirmedDock}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Driver Call Status */}
                                  <div className="rounded-lg p-3" style={{
                                    backgroundColor: driverCallStatus === 'confirmed' ? `${carbon.success}15`
                                      : driverCallStatus === 'rejected' || driverCallStatus === 'failed' || driverCallStatus === 'timeout' ? `${carbon.critical}15`
                                      : `${carbon.bgSurface2}80`
                                  }}>
                                    <div className="flex items-center justify-center gap-2">
                                      {driverCallStatus === 'connecting' && (
                                        <>
                                          <Loader className="w-4 h-4 animate-spin" style={{ color: carbon.accent }} />
                                          <span className="text-sm" style={{ color: carbon.textSecondary }}>Connecting to driver...</span>
                                        </>
                                      )}
                                      {driverCallStatus === 'active' && (
                                        <>
                                          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: carbon.critical }} />
                                          <PhoneCall className="w-4 h-4 animate-pulse" style={{ color: carbon.accent }} />
                                          <span className="text-sm" style={{ color: carbon.textSecondary }}>Speaking with driver...</span>
                                        </>
                                      )}
                                      {driverCallStatus === 'confirmed' && (
                                        <>
                                          <UserCheck className="w-4 h-4" style={{ color: carbon.success }} />
                                          <span className="text-sm font-medium" style={{ color: carbon.success }}>Driver Confirmed!</span>
                                        </>
                                      )}
                                      {driverCallStatus === 'rejected' && (
                                        <>
                                          <span className="text-sm" style={{ color: carbon.critical }}>Driver unavailable</span>
                                        </>
                                      )}
                                      {driverCallStatus === 'timeout' && (
                                        <>
                                          <span className="text-sm" style={{ color: carbon.critical }}>Driver did not respond</span>
                                        </>
                                      )}
                                      {driverCallStatus === 'failed' && (
                                        <>
                                          <span className="text-sm" style={{ color: carbon.critical }}>Call failed</span>
                                        </>
                                      )}
                                      {driverCallStatus === 'idle' && (
                                        <>
                                          <Loader className="w-4 h-4 animate-spin" style={{ color: carbon.textTertiary }} />
                                          <span className="text-sm" style={{ color: carbon.textTertiary }}>Preparing call...</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ color: carbon.textSecondary }}>
                                  <TypewriterText
                                    text="Confirming availability with driver before finalizing the agreement."
                                    speed={15}
                                    className="text-xs"
                                    as="p"
                                    onComplete={() => setDriverConfirmTypingComplete(true)}
                                  />
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}


                    {/* Loading spinner before finalized agreement */}
                    {loadingFinalized && (
                      <div className="flex items-center justify-center py-6">
                        <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.success }} />
                      </div>
                    )}

                    {/* Finalized Agreement Section - Show after call ends */}
                    {showFinalizedAgreement && workflow.confirmedTime && workflow.confirmedDock && (
                      <div className="border rounded-xl p-4 transition-all duration-500 ease-in-out animate-in fade-in" style={{
                        backgroundColor: carbon.successBg,
                        borderColor: carbon.successBorder
                      }}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                            backgroundColor: `${carbon.success}33`
                          }}>
                            <CheckCircle className="w-5 h-5" style={{ color: carbon.success }} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold mb-1" style={{ color: carbon.success }}>
                              {finalizedHeaderComplete ? (
                                'Agreement Finalized'
                              ) : (
                                <TypewriterText
                                  text="Agreement Finalized"
                                  speed={30}
                                  onComplete={() => setFinalizedHeaderComplete(true)}
                                />
                              )}
                            </h3>
                            {finalizedHeaderComplete && (
                              finalizedTypingComplete ? (
                                <div className="space-y-2">
                                  <p className="text-xs" style={{ color: carbon.textSecondary }}>
                                    Voice subagent successfully negotiated the new appointment details:
                                  </p>
                                  <div className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: `${carbon.bgSurface2}80` }}>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs" style={{ color: carbon.textTertiary }}>Original Time:</span>
                                      <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>{workflow.setupParams.originalAppointment}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs" style={{ color: carbon.textTertiary }}>Driver Delay:</span>
                                      <span className="text-sm font-medium" style={{ color: carbon.warning }}>{(() => {
                                        const { formatDelayForSpeech } = require('@/lib/time-parser');
                                        return formatDelayForSpeech(workflow.setupParams.delayMinutes);
                                      })()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs" style={{ color: carbon.textTertiary }}>New Arrival Time:</span>
                                      <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>{(() => {
                                        const { addMinutesToTime } = require('@/lib/time-parser');
                                        return addMinutesToTime(workflow.setupParams.originalAppointment, workflow.setupParams.delayMinutes);
                                      })()}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1.5 border-t" style={{ borderColor: `${carbon.border}80` }}>
                                      <span className="text-xs" style={{ color: carbon.textTertiary }}>Confirmed:</span>
                                      <span className="text-sm font-medium" style={{ color: carbon.success }}>{workflow.confirmedTime} at Dock {workflow.confirmedDock}</span>
                                    </div>
                                    {workflow.warehouseManagerName && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs" style={{ color: carbon.textTertiary }}>Warehouse Contact:</span>
                                        <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>{workflow.warehouseManagerName}</span>
                                      </div>
                                    )}
                                    {workflow.currentCostAnalysis && (
                                      <div className="flex justify-between items-center pt-1.5 border-t" style={{ borderColor: `${carbon.border}80` }}>
                                        <span className="text-xs" style={{ color: carbon.textTertiary }}>Total Cost Impact:</span>
                                        <span className="text-sm font-medium" style={{ color: carbon.warning }}>${workflow.currentCostAnalysis.totalCost.toFixed(2)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ color: carbon.textSecondary }}>
                                  <TypewriterText
                                    text="Voice subagent successfully negotiated the new appointment details. The rescheduled dock appointment has been confirmed and updated in the system."
                                    speed={15}
                                    className="text-xs"
                                    as="p"
                                    onComplete={() => setFinalizedTypingComplete(true)}
                                  />
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Panel - Chat Interface (sticky on large screens, separate scroll) */}
                  <div className="w-full lg:max-w-xl animate-slide-in-left">
                    <div className="lg:sticky lg:top-24">
                      <ChatInterface
                        messages={workflow.chatMessages}
                        userInput={userInput}
                        onUserInputChange={setUserInput}
                        onSendMessage={handleTextMessage}
                        onClose={handleClose}
                        onFinalize={handleFinalize}
                        isProcessing={workflow.isProcessing}
                        conversationPhase={workflow.conversationPhase}
                        isVoiceMode={isVoiceMode}
                        warehouseManagerName={workflow.warehouseManagerName}
                        confirmedTime={workflow.confirmedTime}
                        confirmedDock={workflow.confirmedDock}
                        costAnalysis={workflow.currentCostAnalysis}
                        evaluation={workflow.currentEvaluation}
                        showCostBreakdown={isNegotiating}
                        callStatus={effectiveCallStatus}
                        onStartCall={startCall}
                        onEndCall={endCurrentCall}
                        voiceTransport={workflow.setupParams.voiceTransport}
                        twilioCallState={twilioCall.callState}
                        warehouseHoldState={workflow.warehouseHold}
                        driverCallStatus={driverCallStatus}
                        isDriverConfirmationEnabled={workflow.isDriverConfirmationEnabled}
                        blockExpansion={workflow.blockExpansion}
                        onToggleBlock={workflow.toggleBlockExpansion}
                        onOpenArtifact={workflow.openArtifact}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Single Column Layout - Before chat starts or after completion */
                <div className="max-w-3xl mx-auto space-y-4 transition-all duration-500 ease-out">
                  {/* Collapsible Reasoning Panel */}
                  {workflow.thinkingSteps.length > 0 && (
                    <details open={!reasoningCollapsed} className="group rounded-xl overflow-hidden transition-all duration-300 ease-in-out" style={{
                      backgroundColor: `${carbon.bgSurface1}4d`,
                      border: `1px solid ${carbon.borderSubtle}`
                    }}>
                      <summary className="px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors list-none"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${carbon.bgSurface1}80`}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <Brain className="w-4 h-4" style={{ color: carbon.warning }} />
                        <span className="text-sm font-medium" style={{ color: carbon.textSecondary }}>Reasoning</span>
                        <span className="text-xs ml-1" style={{ color: carbon.textTertiary }}>
                          ({workflow.thinkingSteps.length} steps)
                        </span>
                        {workflow.activeStepId && (
                          <Loader className="w-3 h-3 animate-spin ml-2" style={{ color: carbon.warning }} />
                        )}
                        <svg className="w-4 h-4 ml-auto transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: carbon.textTertiary }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="transition-all duration-300 ease-in-out p-3 pt-0 space-y-2 max-h-[300px] overflow-y-auto border-t" style={{ borderColor: carbon.borderSubtle }}>
                        {workflow.thinkingSteps.map((step) => (
                          <ThinkingBlock
                            key={step.id}
                            {...step}
                            isExpanded={workflow.expandedSteps[step.id] ?? false}
                            onToggle={() => workflow.toggleStepExpanded(step.id)}
                            isActive={workflow.activeStepId === step.id}
                          />
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Loading spinner between reasoning → summary */}
                  {loadingSummary && (
                    <div className="flex items-center justify-center py-6">
                      <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.warning }} />
                    </div>
                  )}

                  {/* Summary after reasoning completes */}
                  {showSummary && workflow.negotiationStrategy && (
                    <div className="border rounded-xl p-4 transition-all duration-500 ease-in-out animate-fade-in" style={{
                      backgroundColor: carbon.successBg,
                      borderColor: carbon.successBorder
                    }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                          backgroundColor: `${carbon.success}33`
                        }}>
                          <CheckCircle className="w-5 h-5" style={{ color: carbon.success }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold mb-1" style={{ color: carbon.success }}>
                            {summaryHeaderComplete ? (
                              'Analysis Complete'
                            ) : (
                              <TypewriterText
                                text="Analysis Complete"
                                speed={30}
                                onComplete={() => setSummaryHeaderComplete(true)}
                              />
                            )}
                          </h3>
                          {summaryHeaderComplete && (
                            summaryTypingComplete ? (
                              <p className="text-xs" style={{ color: carbon.textSecondary }}>
                                {`Analyzed delay impact and contract terms. Identified optimal negotiation windows: ${workflow.negotiationStrategy.display.idealBefore} (ideal) to ${workflow.negotiationStrategy.display.acceptableBefore} (acceptable). Cost range: ${workflow.negotiationStrategy.thresholds.ideal.costImpact} to ${workflow.negotiationStrategy.thresholds.problematic.costImpact}.`}
                              </p>
                            ) : (
                              <div style={{ color: carbon.textSecondary }}>
                                <TypewriterText
                                  text={`Analyzed delay impact and contract terms. Identified optimal negotiation windows: ${workflow.negotiationStrategy.display.idealBefore} (ideal) to ${workflow.negotiationStrategy.display.acceptableBefore} (acceptable). Cost range: ${workflow.negotiationStrategy.thresholds.ideal.costImpact} to ${workflow.negotiationStrategy.thresholds.problematic.costImpact}.`}
                                  speed={15}
                                  className="text-xs"
                                  as="p"
                                  onComplete={() => setSummaryTypingComplete(true)}
                                />
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading spinner between summary → strategy */}
                  {loadingStrategy && (
                    <div className="flex items-center justify-center py-6">
                      <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.accent }} />
                    </div>
                  )}

                  {/* Strategy Panel - Show after summary */}
                  {showStrategy && workflow.negotiationStrategy && isNegotiating && (
                    <div className="transition-all duration-500 ease-in-out animate-fade-in">
                      <StrategyPanel
                        strategy={workflow.negotiationStrategy}
                        negotiationState={workflow.negotiationState}
                        currentEvaluation={workflow.currentEvaluation}
                        contractSource={workflow.extractedTerms ? 'extracted' : 'defaults'}
                        partyName={workflow.partyName}
                      />
                    </div>
                  )}

                  {/* Contract Terms Display - Show with strategy */}
                  {showStrategy && isNegotiating && (
                    <div className="transition-all duration-500 ease-in-out animate-fade-in">
                      <ContractTermsDisplay
                        terms={workflow.extractedTerms}
                        fileName={workflow.contractFileName}
                        error={workflow.contractError}
                      />
                    </div>
                  )}

                  {/* Loading spinner between strategy → voice subagent */}
                  {loadingVoiceSubagent && (
                    <div className="flex items-center justify-center py-6">
                      <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.accent }} />
                    </div>
                  )}

                  {/* Voice Subagent Message - Show before warehouse contact */}
                  {showVoiceSubagent && isVoiceMode && (
                    <div className="border rounded-xl p-4 transition-all duration-500 ease-in-out animate-fade-in" style={{
                      backgroundColor: carbon.accentBg,
                      borderColor: carbon.accentBorder
                    }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                          backgroundColor: `${carbon.accent}33`
                        }}>
                          <PhoneCall className="w-5 h-5" style={{ color: carbon.accent }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold mb-1" style={{ color: carbon.accent }}>
                            {voiceSubagentHeaderComplete ? (
                              'Spinning up Voice Subagent'
                            ) : (
                              <TypewriterText
                                text="Spinning up Voice Subagent"
                                speed={30}
                                onComplete={() => setVoiceSubagentHeaderComplete(true)}
                              />
                            )}
                          </h3>
                          {voiceSubagentHeaderComplete && (
                            voiceSubagentTypingComplete ? (
                              <p className="text-xs" style={{ color: carbon.textSecondary }}>
                                {`Initializing AI dispatcher "Mike" to coordinate and negotiate with the warehouse manager via voice call. He'll handle the conversation naturally, following the negotiation strategy above.`}
                              </p>
                            ) : (
                              <div style={{ color: carbon.textSecondary }}>
                                <TypewriterText
                                  text={`Initializing AI dispatcher "Mike" to coordinate and negotiate with the warehouse manager via voice call. He'll handle the conversation naturally, following the negotiation strategy above.`}
                                  speed={15}
                                  className="text-xs"
                                  as="p"
                                  onComplete={() => setVoiceSubagentTypingComplete(true)}
                                />
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading spinner between voice subagent → call button */}
                  {loadingCallButton && (
                    <div className="flex items-center justify-center py-6">
                      <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.accent }} />
                    </div>
                  )}

                  {/* Phase 12: Loading spinner before driver confirmation */}
                  {loadingDriverConfirm && (
                    <div className="flex items-center justify-center py-6">
                      <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.warning }} />
                    </div>
                  )}

                  {/* Phase 12: Driver Confirmation Status - Show when confirming with driver */}
                  {showDriverConfirmation && workflow.warehouseHold.isOnHold && (
                    <div className="border rounded-xl p-4 transition-all duration-500 ease-in-out animate-in fade-in" style={{
                      backgroundColor: carbon.warningBg,
                      borderColor: carbon.warningBorder
                    }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                          backgroundColor: `${carbon.warning}33`
                        }}>
                          <Pause className="w-5 h-5" style={{ color: carbon.warning }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold mb-1" style={{ color: carbon.warning }}>
                            {driverConfirmHeaderComplete ? (
                              'Warehouse On Hold'
                            ) : (
                              <TypewriterText
                                text="Warehouse On Hold"
                                speed={30}
                                onComplete={() => setDriverConfirmHeaderComplete(true)}
                              />
                            )}
                          </h3>
                          {driverConfirmHeaderComplete && (
                            driverConfirmTypingComplete ? (
                              <div className="space-y-2">
                                <p className="text-xs" style={{ color: carbon.textSecondary }}>
                                  Confirming availability with driver before finalizing...
                                </p>
                                <div className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: `${carbon.bgSurface2}80` }}>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Tentative Time:</span>
                                    <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
                                      {workflow.warehouseHold.tentativeAgreement?.time || workflow.confirmedTime}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Tentative Dock:</span>
                                    <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>
                                      {workflow.warehouseHold.tentativeAgreement?.dock || workflow.confirmedDock}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center pt-1.5 border-t" style={{ borderColor: `${carbon.border}80` }}>
                                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Driver Call:</span>
                                    <span className="text-sm font-medium flex items-center gap-2" style={{
                                      color: driverCallStatus === 'confirmed' ? carbon.success
                                           : driverCallStatus === 'rejected' || driverCallStatus === 'failed' || driverCallStatus === 'timeout' ? carbon.critical
                                           : carbon.warning
                                    }}>
                                      {driverCallStatus === 'connecting' && <Loader className="w-3 h-3 animate-spin" />}
                                      {driverCallStatus === 'active' && <PhoneCall className="w-3 h-3 animate-pulse" />}
                                      {driverCallStatus === 'confirmed' && <UserCheck className="w-3 h-3" />}
                                      {driverCallStatus === 'connecting' ? 'Connecting...'
                                        : driverCallStatus === 'active' ? 'Speaking with driver...'
                                        : driverCallStatus === 'confirmed' ? 'Confirmed!'
                                        : driverCallStatus === 'rejected' ? 'Rejected'
                                        : driverCallStatus === 'timeout' ? 'Timed out'
                                        : driverCallStatus === 'failed' ? 'Failed'
                                        : 'Pending'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: carbon.textSecondary }}>
                                <TypewriterText
                                  text="Confirming availability with driver before finalizing the appointment..."
                                  speed={15}
                                  className="text-xs"
                                  as="p"
                                  onComplete={() => setDriverConfirmTypingComplete(true)}
                                />
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading spinner before finalized agreement */}
                  {loadingFinalized && (
                    <div className="flex items-center justify-center py-6">
                      <Loader className="w-6 h-6 animate-spin" style={{ color: carbon.success }} />
                    </div>
                  )}

                  {/* Finalized Agreement Section - Show after call ends */}
                  {showFinalizedAgreement && workflow.confirmedTime && workflow.confirmedDock && (
                    <div className="border rounded-xl p-4 transition-all duration-500 ease-in-out animate-in fade-in" style={{
                      backgroundColor: carbon.successBg,
                      borderColor: carbon.successBorder
                    }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                          backgroundColor: `${carbon.success}33`
                        }}>
                          <CheckCircle className="w-5 h-5" style={{ color: carbon.success }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold mb-1" style={{ color: carbon.success }}>
                            {finalizedHeaderComplete ? (
                              'Agreement Finalized'
                            ) : (
                              <TypewriterText
                                text="Agreement Finalized"
                                speed={30}
                                onComplete={() => setFinalizedHeaderComplete(true)}
                              />
                            )}
                          </h3>
                          {finalizedHeaderComplete && (
                            finalizedTypingComplete ? (
                              <div className="space-y-2">
                                <p className="text-xs" style={{ color: carbon.textSecondary }}>
                                  Voice subagent successfully negotiated the new appointment details:
                                </p>
                                <div className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: `${carbon.bgSurface2}80` }}>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Original Time:</span>
                                    <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>{workflow.setupParams.originalAppointment}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Driver Delay:</span>
                                    <span className="text-sm font-medium" style={{ color: carbon.warning }}>{(() => {
                                      const { formatDelayForSpeech } = require('@/lib/time-parser');
                                      return formatDelayForSpeech(workflow.setupParams.delayMinutes);
                                    })()}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs" style={{ color: carbon.textTertiary }}>New Arrival Time:</span>
                                    <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>{(() => {
                                      const { addMinutesToTime } = require('@/lib/time-parser');
                                      return addMinutesToTime(workflow.setupParams.originalAppointment, workflow.setupParams.delayMinutes);
                                    })()}</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-1.5 border-t" style={{ borderColor: `${carbon.border}80` }}>
                                    <span className="text-xs" style={{ color: carbon.textTertiary }}>Confirmed:</span>
                                    <span className="text-sm font-medium" style={{ color: carbon.success }}>{workflow.confirmedTime} at Dock {workflow.confirmedDock}</span>
                                  </div>
                                  {workflow.warehouseManagerName && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs" style={{ color: carbon.textTertiary }}>Warehouse Contact:</span>
                                      <span className="text-sm font-medium" style={{ color: carbon.textPrimary }}>{workflow.warehouseManagerName}</span>
                                    </div>
                                  )}
                                  {workflow.currentCostAnalysis && (
                                    <div className="flex justify-between items-center pt-1.5 border-t" style={{ borderColor: `${carbon.border}80` }}>
                                      <span className="text-xs" style={{ color: carbon.textTertiary }}>Total Cost Impact:</span>
                                      <span className="text-sm font-medium" style={{ color: carbon.warning }}>${workflow.currentCostAnalysis.totalCost.toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: carbon.textSecondary }}>
                                <TypewriterText
                                  text="Voice subagent successfully negotiated the new appointment details. The rescheduled dock appointment has been confirmed and updated in the system."
                                  speed={15}
                                  className="text-xs"
                                  as="p"
                                  onComplete={() => setFinalizedTypingComplete(true)}
                                />
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Chat Interface - Only shown in single column when chat hasn't started yet */}
                  {(showCallButton || workflow.chatMessages.length > 0 || callStatus !== 'idle') && (
                    <ChatInterface
                      messages={workflow.chatMessages}
                      userInput={userInput}
                      onUserInputChange={setUserInput}
                      onSendMessage={handleTextMessage}
                      onClose={handleClose}
                      onFinalize={handleFinalize}
                      isProcessing={workflow.isProcessing}
                      conversationPhase={workflow.conversationPhase}
                      isVoiceMode={isVoiceMode}
                      warehouseManagerName={workflow.warehouseManagerName}
                      confirmedTime={workflow.confirmedTime}
                      confirmedDock={workflow.confirmedDock}
                      costAnalysis={workflow.currentCostAnalysis}
                      evaluation={workflow.currentEvaluation}
                      showCostBreakdown={isNegotiating}
                      callStatus={effectiveCallStatus}
                      onStartCall={startCall}
                      onEndCall={endCurrentCall}
                      voiceTransport={workflow.setupParams.voiceTransport}
                      twilioCallState={twilioCall.callState}
                      warehouseHoldState={workflow.warehouseHold}
                      driverCallStatus={driverCallStatus}
                      isDriverConfirmationEnabled={workflow.isDriverConfirmationEnabled}
                      blockExpansion={workflow.blockExpansion}
                      onToggleBlock={workflow.toggleBlockExpansion}
                      onOpenArtifact={workflow.openArtifact}
                    />
                  )}

                  {/* Final Agreement */}
                  {isComplete && workflow.finalAgreement && (
                    <>
                      <FinalAgreement
                        agreementText={workflow.finalAgreement}
                        originalAppointment={workflow.setupParams.originalAppointment}
                        confirmedTime={workflow.confirmedTime || ''}
                        confirmedDock={workflow.confirmedDock || ''}
                        delayMinutes={workflow.setupParams.delayMinutes}
                        totalCost={workflow.currentCostAnalysis?.totalCost || 0}
                        confirmedDayOffset={workflow.confirmedDayOffset}
                      />

                      {/* Save Status Indicator - Carbon Style */}
                      {saveStatus && (
                        <div className={`mt-4 p-4 rounded-lg border ${
                          saveStatus.success
                            ? 'bg-[#0a0a0a] border-[#50E3C2]'
                            : 'bg-[#0a0a0a] border-[#EE0000]'
                        }`}>
                          <div className="flex items-start gap-3">
                            {saveStatus.success ? (
                              <CheckCircle className="w-5 h-5 text-[#50E3C2] flex-shrink-0 mt-0.5" />
                            ) : (
                              <div className="w-5 h-5 text-[#EE0000] flex-shrink-0 mt-0.5">⚠️</div>
                            )}
                            <div className="flex-1">
                              <p className={`font-medium ${
                                saveStatus.success ? 'text-[#50E3C2]' : 'text-[#EE0000]'
                              }`}>
                                {saveStatus.message}
                              </p>
                              {saveStatus.success && saveStatus.spreadsheetUrl && (
                                <a
                                  href={saveStatus.spreadsheetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[#0070F3] hover:text-[#EDEDED] underline mt-1 inline-block transition-colors"
                                >
                                  View in Google Sheets →
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* Reset Button */}
        {workflow.workflowStage !== 'setup' && (
          <button
            onClick={workflow.reset}
            className="mx-auto mt-6 text-xs underline block transition-colors"
            style={{ color: carbon.textTertiary }}
            onMouseEnter={(e) => e.currentTarget.style.color = carbon.textSecondary}
            onMouseLeave={(e) => e.currentTarget.style.color = carbon.textTertiary}
          >
            Reset
          </button>
        )}
      </main>

      {/* Artifact Panel - Slide-out for detailed views */}
      <ArtifactPanel
        isOpen={workflow.artifact.isOpen}
        onClose={workflow.closeArtifact}
        type={workflow.artifact.type}
        data={workflow.artifact.data}
        onExport={
          workflow.artifact.type === 'agreement'
            ? () => {
                // Export as CSV logic
                if (workflow.finalAgreement && workflow.confirmedTime && workflow.confirmedDock) {
                  const csvContent = [
                    'Date,Original Time,New Time,Dock,Delay (min),Cost Impact,Status',
                    `${new Date().toLocaleDateString()},${workflow.setupParams.originalAppointment},${workflow.confirmedTime},${workflow.confirmedDock},${workflow.setupParams.delayMinutes},$${workflow.currentCostAnalysis?.totalCost || 0},CONFIRMED`,
                  ].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dispatch-agreement-${Date.now()}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }
            : undefined
        }
      />
    </div>
  );
}
