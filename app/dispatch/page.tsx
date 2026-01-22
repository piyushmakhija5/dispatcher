'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock, Brain, Loader, CheckCircle, PhoneCall } from 'lucide-react';
import { useDispatchWorkflow } from '@/hooks/useDispatchWorkflow';
import { useVapiCall, useAutoEndCall, extractWarehouseManagerName } from '@/hooks/useVapiCall';
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

// VAPI Configuration
const VAPI_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || 'fcbf6dc8-d661-4cdc-83c0-6965ca9163d3';

export default function DispatchPage() {
  const workflow = useDispatchWorkflow();
  const [userInput, setUserInput] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');

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

  // Track pending accepted values (before full confirmation)
  // Use refs for synchronous updates (no stale closure issues)
  const pendingAcceptedTimeRef = useRef<string | null>(null);
  const pendingAcceptedCostRef = useRef<number>(0);

  // Track auto-end timer to allow cancellation if user speaks
  const autoEndTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track if we're waiting for assistant to finish speaking before starting silence timer
  const waitingForSpeechEndRef = useRef<boolean>(false);

  // Track if assistant is currently speaking
  const isAssistantSpeakingRef = useRef<boolean>(false);

  // VAPI call management
  const vapiCall = useVapiCall({
    onTranscript: (data) => handleVapiTranscript(data),
    onCallEnd: handleVapiCallEnd,
  });

  // VAPI client ref for direct SDK access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiClientRef = useRef<any>(null);

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

      // Start the call
      // NOTE: Using fallback 'Walmart' for retailer until Phase 7.6 adds contract fetching
      const vapiVariables = {
        original_appointment: formattedAppointment,
        original_24h: originalAppointment,
        actual_arrival_time: actualArrivalTimeSpeech,
        actual_arrival_24h: actualArrivalTime24h,
        otif_window_start: otifWindowStartSpeech,
        otif_window_end: otifWindowEndSpeech,
        delay_minutes: delayMinutes.toString(),
        shipment_value: shipmentValue.toString(),
        retailer: 'Walmart', // Fallback - will be replaced by extracted party in Phase 7.6
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoEndTimerRef.current) {
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
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
    }
  }, [workflow.workflowStage]);

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
  useAutoEndCall(
    workflow.conversationPhase === 'done',
    callStatus,
    endVapiCall,
    isVoiceMode ? 1000 : 2000  // Shorter delay for voice since silence already elapsed
  );

  // Silence duration before auto-ending call (in milliseconds)
  const SILENCE_DURATION_MS = 3000;

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
  }

  function handleAssistantSpeechEnd() {
    console.log('🔇 Assistant finished speaking');
    isAssistantSpeakingRef.current = false;
    
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
    // DISPATCHER CLOSING PHRASE DETECTION
    // =========================================================================
    if (data.role === 'dispatcher') {
      const closingPhrases = [
        'see you then',
        'appreciate your help',
        'thanks for your help',
        'take care',
        'have a good one',
        'talk to you later',
        'we\'ll see you then',
        'thanks again',
        'goodbye',
        'bye',
      ];
      const contentLower = data.content.toLowerCase();
      const isClosing = closingPhrases.some(phrase => contentLower.includes(phrase));

      console.log(`🔍 Checking closing phrase: isClosing=${isClosing}, confirmedTime=${workflow.confirmedTimeRef.current}, confirmedDock=${workflow.confirmedDockRef.current}`);

      if (isClosing && workflow.confirmedTimeRef.current && workflow.confirmedDockRef.current) {
        console.log('🔔 Mike said closing phrase - waiting for speech to finish');

        // Generate agreement if not already done
        if (!workflow.finalAgreement) {
          const currentCost = workflow.currentCostAnalysis?.totalCost || 0;
          const agreementText = generateAgreementText({
            originalTime: workflow.setupParams.originalAppointment,
            newTime: workflow.confirmedTimeRef.current,
            dock: workflow.confirmedDockRef.current,
            delayMinutes: workflow.setupParams.delayMinutes,
            costImpact: currentCost,
            warehouseContact: workflow.warehouseManagerName,
          });
          workflow.setFinalAgreement(agreementText);
        }

        // Clear any existing timer
        if (autoEndTimerRef.current) {
          clearTimeout(autoEndTimerRef.current);
          autoEndTimerRef.current = null;
        }

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
      return;
    }

    // =========================================================================
    // WAREHOUSE MANAGER SPOKE - CANCEL AUTO-END TIMER & CONTINUE CONVERSATION
    // =========================================================================
    if (data.role === 'warehouse') {
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
          // We have both, check if we should accept
          const { costAnalysis, evaluation } = workflow.evaluateTimeOffer(currentTime);

          if (evaluation.shouldAccept) {
            finishNegotiation(currentTime, currentDock, costAnalysis.totalCost, false);
            return;
          }
        }
        return;
      }

      // Extract offered values (but don't set as confirmed yet!)
      // Only set confirmed time/dock when we actually accept the offer
      const offeredTime = extracted.time;
      const offeredDock = extracted.dock;

      console.log('Extraction result:', { offeredTime, offeredDock, confidence: extracted.confidence });

      // Determine current values from multiple sources
      const currentTime = offeredTime || pendingAcceptedTimeRef.current || workflow.confirmedTimeRef.current;
      const currentDock = offeredDock || workflow.confirmedDockRef.current;

      // Case 1: We got a time offer (with or without dock)
      if (offeredTime) {
        const { costAnalysis, evaluation } = workflow.evaluateTimeOffer(offeredTime);

        workflow.addThinkingStep('analysis', 'Evaluating Offer', [
          `Offered time: ${offeredTime}`,
          currentDock ? `Dock: ${currentDock}` : 'Dock: pending',
          `Cost impact: $${costAnalysis.totalCost}`,
          `Quality: ${evaluation.quality}`,
          evaluation.reason,
        ]);

        if (offeredTime && currentDock) {
          // We have both - finalize now
          if (evaluation.shouldAccept) {
            finishNegotiation(offeredTime, currentDock, costAnalysis.totalCost, false);
            pendingAcceptedTimeRef.current = null; // Clear pending
          } else if (evaluation.shouldPushback && workflow.negotiationState.pushbackCount < 2) {
            // Strategic pushback
            workflow.incrementPushback();
            const idealTime = workflow.negotiationStrategy?.display.idealBefore || 'earlier';

            const pushbackMsg = workflow.negotiationState.pushbackCount === 0
              ? `Hmm, that's a bit late for us. Any chance you have something closer to ${idealTime}?`
              : `I hear you. What's the earliest you could fit us in? Even close to ${idealTime} would really help.`;

            if (vapiCall.speakMessageFn) {
              vapiCall.speakMessageFn(pushbackMsg);
              workflow.addChatMessage('dispatcher', pushbackMsg);
            }
          } else {
            // Force accept - out of options
            finishNegotiation(offeredTime, currentDock, costAnalysis.totalCost, true);
            pendingAcceptedTimeRef.current = null; // Clear pending
          }
        } else if (offeredTime && !currentDock) {
          // Time accepted, waiting for dock
          console.log('Time accepted but no dock yet. Evaluation:', evaluation);
          if (evaluation.shouldAccept || evaluation.quality === 'ACCEPTABLE') {
            console.log('Storing pending accepted time:', offeredTime, 'with cost:', costAnalysis.totalCost);
            pendingAcceptedTimeRef.current = offeredTime;
            pendingAcceptedCostRef.current = costAnalysis.totalCost;

            // Mike asks for dock (VAPI will say this, we don't need to)
            // The VAPI prompt already has logic to ask for dock
          } else {
            console.log('Time offer not acceptable, evaluation:', evaluation);
          }
        }
      }
      // Case 2: We got ONLY a dock (time was accepted previously)
      else if (offeredDock && pendingAcceptedTimeRef.current) {
        // Complete the negotiation with pending time + new dock
        console.log('✅ Completing negotiation with pending time:', pendingAcceptedTimeRef.current, 'and dock:', offeredDock);
        finishNegotiation(pendingAcceptedTimeRef.current, offeredDock, pendingAcceptedCostRef.current, false);
        pendingAcceptedTimeRef.current = null; // Clear pending
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
    isReluctant: boolean
  ) {
    console.log(`🎯 finishNegotiation called: time=${time}, dock=${dock}, cost=${cost}, isReluctant=${isReluctant}`);
    // ✅ CRITICAL: Only NOW do we set confirmed time/dock (on actual acceptance)
    workflow.setConfirmedTime(time);
    workflow.setConfirmedDock(dock);
    console.log(`✅ Confirmed time and dock set`);

    workflow.addThinkingStep('success', 'Agreement Reached', [
      `Time: ${time}`,
      `Dock: ${dock}`,
      `Cost: $${cost}`,
      isReluctant ? 'Accepted reluctantly (no better options)' : 'Accepted',
    ]);

    // Save agreement (but don't end conversation yet)
    const agreementText = generateAgreementText({
      originalTime: workflow.setupParams.originalAppointment,
      newTime: time,
      dock: dock,
      delayMinutes: workflow.setupParams.delayMinutes,
      costImpact: cost,
      warehouseContact: workflow.warehouseManagerName,
    });
    workflow.setFinalAgreement(agreementText);

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

  function handleVapiCallEnd() {
    console.log('🏁 handleVapiCallEnd called');
    console.log(`  confirmedTime: ${workflow.confirmedTime}`);
    console.log(`  confirmedDock: ${workflow.confirmedDock}`);
    if (workflow.confirmedTime && workflow.confirmedDock) {
      console.log('  ✅ Setting phase to done');
      workflow.setConversationPhase('done');
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

      workflow.addThinkingStep('info', 'Contact Established', [
        `Speaking with: ${theirName}`,
        'Explaining delay situation...',
      ]);

      // Mike's style: casual, warm, explains the situation
      response = `Hey ${theirName}, so I've got a truck that was supposed to be there at ${formatTimeForSpeech(appt)}, but my driver's running about ${delay} minutes behind. Any chance you can fit us in a bit later?`;
      nextPhase = 'negotiating_time';
    }

    // =========================================================================
    // PHASE: NEGOTIATING_TIME - Evaluating time offers (check_slot_cost logic)
    // =========================================================================
    else if (phase === 'negotiating_time') {
      if (offeredTime) {
        // Run check_slot_cost logic
        const { costAnalysis, evaluation } = workflow.evaluateTimeOffer(offeredTime);
        const timeFormatted = formatTimeForSpeech(offeredTime);

        workflow.addThinkingStep('analysis', 'Checking Slot Cost', [
          `Offered: ${timeFormatted}`,
          `Cost impact: $${costAnalysis.totalCost}`,
          `Acceptable: ${evaluation.shouldAccept ? 'YES' : 'NO'}`,
          evaluation.shouldAccept ? 'Will accept this slot' : `Counter with: ${getSuggestedCounterOffer()}`,
        ]);

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
        // They changed the time? Re-evaluate
        const { evaluation } = workflow.evaluateTimeOffer(offeredTime);
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
      });
      workflow.setFinalAgreement(agreementText);
    }

    // Mark finalize task as completed
    workflow.updateTaskStatus('finalize', 'completed');
    workflow.setIsProcessing(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-md bg-slate-900/80 sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Clock className="w-5 h-5 text-slate-900" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  AI Dispatch Agent
                </h1>
                <p className="text-xs text-slate-500">Live delay management with voice/text</p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2">
              {workflow.currentEvaluation && (
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    workflow.currentEvaluation.quality === 'IDEAL'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : workflow.currentEvaluation.quality === 'ACCEPTABLE'
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      : workflow.currentEvaluation.quality === 'SUBOPTIMAL'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {workflow.currentEvaluation.quality}
                </div>
              )}

              <div
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 ${
                  workflow.workflowStage === 'setup'
                    ? 'bg-slate-800 text-slate-400'
                    : isComplete
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    workflow.workflowStage === 'setup'
                      ? 'bg-slate-500'
                      : isComplete
                      ? 'bg-emerald-400'
                      : 'bg-amber-400 animate-pulse'
                  }`}
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
                      <details open={!reasoningCollapsed} className="group bg-slate-800/30 border border-slate-700/30 rounded-xl overflow-hidden transition-all duration-300 ease-in-out">
                        <summary className="px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 transition-colors list-none">
                          <Brain className="w-4 h-4 text-amber-400" />
                          <span className="text-sm font-medium text-slate-300">Reasoning</span>
                          <span className="text-xs text-slate-500 ml-1">
                            ({workflow.thinkingSteps.length} steps)
                          </span>
                          {workflow.activeStepId && (
                            <Loader className="w-3 h-3 text-amber-400 animate-spin ml-2" />
                          )}
                          <svg className="w-4 h-4 text-slate-500 ml-auto transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="transition-all duration-300 ease-in-out p-3 pt-0 space-y-2 max-h-[300px] overflow-y-auto border-t border-slate-700/30">
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
                        <Loader className="w-6 h-6 text-amber-400 animate-spin" />
                      </div>
                    )}

                    {/* Summary after reasoning completes */}
                    {showSummary && workflow.negotiationStrategy && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 transition-all duration-500 ease-in-out animate-in fade-in">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-emerald-400 mb-1">
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
                                <p className="text-xs text-slate-300">
                                  {`Analyzed delay impact and contract terms. Identified optimal negotiation windows: ${workflow.negotiationStrategy.display.idealBefore} (ideal) to ${workflow.negotiationStrategy.display.acceptableBefore} (acceptable). Cost range: ${workflow.negotiationStrategy.thresholds.ideal.costImpact} to ${workflow.negotiationStrategy.thresholds.problematic.costImpact}.`}
                                </p>
                              ) : (
                                <TypewriterText
                                  text={`Analyzed delay impact and contract terms. Identified optimal negotiation windows: ${workflow.negotiationStrategy.display.idealBefore} (ideal) to ${workflow.negotiationStrategy.display.acceptableBefore} (acceptable). Cost range: ${workflow.negotiationStrategy.thresholds.ideal.costImpact} to ${workflow.negotiationStrategy.thresholds.problematic.costImpact}.`}
                                  speed={15}
                                  className="text-xs text-slate-300"
                                  as="p"
                                  onComplete={() => setSummaryTypingComplete(true)}
                                />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Loading spinner between summary → strategy */}
                    {loadingStrategy && (
                      <div className="flex items-center justify-center py-6">
                        <Loader className="w-6 h-6 text-purple-400 animate-spin" />
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
                        <Loader className="w-6 h-6 text-purple-400 animate-spin" />
                      </div>
                    )}

                    {/* Voice Subagent Message - Show before warehouse contact */}
                    {showVoiceSubagent && isVoiceMode && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 transition-all duration-500 ease-in-out animate-in fade-in">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <PhoneCall className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-purple-400 mb-1">
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
                                <p className="text-xs text-slate-300">
                                  {`Initializing AI dispatcher "Mike" to coordinate and negotiate with the warehouse manager via voice call. He'll handle the conversation naturally, following the negotiation strategy above.`}
                                </p>
                              ) : (
                                <TypewriterText
                                  text={`Initializing AI dispatcher "Mike" to coordinate and negotiate with the warehouse manager via voice call. He'll handle the conversation naturally, following the negotiation strategy above.`}
                                  speed={15}
                                  className="text-xs text-slate-300"
                                  as="p"
                                  onComplete={() => setVoiceSubagentTypingComplete(true)}
                                />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Loading spinner between voice subagent → call button */}
                    {loadingCallButton && (
                      <div className="flex items-center justify-center py-6">
                        <Loader className="w-6 h-6 text-blue-400 animate-spin" />
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
                        callStatus={callStatus}
                        onStartCall={startVapiCall}
                        onEndCall={endVapiCall}
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
                    <details open={!reasoningCollapsed} className="group bg-slate-800/30 border border-slate-700/30 rounded-xl overflow-hidden transition-all duration-300 ease-in-out">
                      <summary className="px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 transition-colors list-none">
                        <Brain className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-slate-300">Reasoning</span>
                        <span className="text-xs text-slate-500 ml-1">
                          ({workflow.thinkingSteps.length} steps)
                        </span>
                        {workflow.activeStepId && (
                          <Loader className="w-3 h-3 text-amber-400 animate-spin ml-2" />
                        )}
                        <svg className="w-4 h-4 text-slate-500 ml-auto transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="transition-all duration-300 ease-in-out p-3 pt-0 space-y-2 max-h-[300px] overflow-y-auto border-t border-slate-700/30">
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
                      <Loader className="w-6 h-6 text-amber-400 animate-spin" />
                    </div>
                  )}

                  {/* Summary after reasoning completes */}
                  {showSummary && workflow.negotiationStrategy && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 transition-all duration-500 ease-in-out animate-fade-in">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-emerald-400 mb-1">
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
                              <p className="text-xs text-slate-300">
                                {`Analyzed delay impact and contract terms. Identified optimal negotiation windows: ${workflow.negotiationStrategy.display.idealBefore} (ideal) to ${workflow.negotiationStrategy.display.acceptableBefore} (acceptable). Cost range: ${workflow.negotiationStrategy.thresholds.ideal.costImpact} to ${workflow.negotiationStrategy.thresholds.problematic.costImpact}.`}
                              </p>
                            ) : (
                              <TypewriterText
                                text={`Analyzed delay impact and contract terms. Identified optimal negotiation windows: ${workflow.negotiationStrategy.display.idealBefore} (ideal) to ${workflow.negotiationStrategy.display.acceptableBefore} (acceptable). Cost range: ${workflow.negotiationStrategy.thresholds.ideal.costImpact} to ${workflow.negotiationStrategy.thresholds.problematic.costImpact}.`}
                                speed={15}
                                className="text-xs text-slate-300"
                                as="p"
                                onComplete={() => setSummaryTypingComplete(true)}
                              />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading spinner between summary → strategy */}
                  {loadingStrategy && (
                    <div className="flex items-center justify-center py-6">
                      <Loader className="w-6 h-6 text-purple-400 animate-spin" />
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
                      <Loader className="w-6 h-6 text-purple-400 animate-spin" />
                    </div>
                  )}

                  {/* Voice Subagent Message - Show before warehouse contact */}
                  {showVoiceSubagent && isVoiceMode && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 transition-all duration-500 ease-in-out animate-fade-in">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <PhoneCall className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-purple-400 mb-1">
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
                              <p className="text-xs text-slate-300">
                                {`Initializing AI dispatcher "Mike" to coordinate and negotiate with the warehouse manager via voice call. He'll handle the conversation naturally, following the negotiation strategy above.`}
                              </p>
                            ) : (
                              <TypewriterText
                                text={`Initializing AI dispatcher "Mike" to coordinate and negotiate with the warehouse manager via voice call. He'll handle the conversation naturally, following the negotiation strategy above.`}
                                speed={15}
                                className="text-xs text-slate-300"
                                as="p"
                                onComplete={() => setVoiceSubagentTypingComplete(true)}
                              />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading spinner between voice subagent → call button */}
                  {loadingCallButton && (
                    <div className="flex items-center justify-center py-6">
                      <Loader className="w-6 h-6 text-blue-400 animate-spin" />
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
                      callStatus={callStatus}
                      onStartCall={startVapiCall}
                      onEndCall={endVapiCall}
                      blockExpansion={workflow.blockExpansion}
                      onToggleBlock={workflow.toggleBlockExpansion}
                      onOpenArtifact={workflow.openArtifact}
                    />
                  )}

                  {/* Final Agreement */}
                  {isComplete && workflow.finalAgreement && (
                    <FinalAgreement
                      agreementText={workflow.finalAgreement}
                      originalAppointment={workflow.setupParams.originalAppointment}
                      confirmedTime={workflow.confirmedTime || ''}
                      confirmedDock={workflow.confirmedDock || ''}
                      delayMinutes={workflow.setupParams.delayMinutes}
                      totalCost={workflow.currentCostAnalysis?.totalCost || 0}
                    />
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
            className="mx-auto mt-6 text-xs text-slate-500 hover:text-slate-300 underline block"
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
