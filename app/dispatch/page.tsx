'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock, Brain, Loader } from 'lucide-react';
import { useDispatchWorkflow } from '@/hooks/useDispatchWorkflow';
import { useVapiCall, useAutoEndCall, extractWarehouseManagerName } from '@/hooks/useVapiCall';
import {
  SetupForm,
  ThinkingBlock,
  StrategyPanel,
  ChatInterface,
  VoiceCallInterface,
  VoiceCallControls,
  FinalAgreement,
  generateAgreementText,
} from '@/components/dispatch';
import type { VapiTranscriptData } from '@/types/vapi';

// VAPI Configuration
const VAPI_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || 'fcbf6dc8-d661-4cdc-83c0-6965ca9163d3';

export default function DispatchPage() {
  const workflow = useDispatchWorkflow();
  const [userInput, setUserInput] = useState('');

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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoEndTimerRef.current) {
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
    };
  }, []);

  const isVoiceMode = workflow.setupParams.communicationMode === 'voice';

  // Auto-end call when conversation is done
  // For voice mode: Only use this as a fallback when phase is 'done' (set by our speech detection)
  // The primary ending mechanism is speech detection + silence timer
  useAutoEndCall(
    workflow.conversationPhase === 'done',
    vapiCall.callStatus,
    vapiCall.endCallFn,
    isVoiceMode ? 1000 : 2000  // Shorter delay for voice since silence already elapsed
  );
  const isNegotiating = workflow.workflowStage === 'negotiating';
  const isComplete = workflow.workflowStage === 'complete';

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
    if (name && !workflow.warehouseManagerName) {
      workflow.setWarehouseManagerName(name);
    }

    // Use backend API to extract slot information
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: data.content }),
      });

      if (!response.ok) throw new Error('Extraction failed');

      const extracted = await response.json();

      if (extracted.confidence === 'low') {
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
    // ✅ CRITICAL: Only NOW do we set confirmed time/dock (on actual acceptance)
    workflow.setConfirmedTime(time);
    workflow.setConfirmedDock(dock);

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
    if (workflow.confirmedTime && workflow.confirmedDock) {
      workflow.setConversationPhase('done');
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
          } else {
            // Need dock number
            response = `Perfect — which dock should we pull into?`;
            nextPhase = 'awaiting_dock';
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
            } else {
              response = `Gotcha, ${timeFormatted} will have to do. Which dock?`;
              nextPhase = 'awaiting_dock';
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

    workflow.setIsProcessing(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
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
      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Setup Form */}
        {workflow.workflowStage === 'setup' && (
          <SetupForm
            params={workflow.setupParams}
            onParamsChange={workflow.updateSetupParams}
            onStart={workflow.startAnalysis}
          />
        )}

        {/* Active Workflow */}
        {workflow.workflowStage !== 'setup' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Reasoning */}
            <div className="bg-slate-800/20 border border-slate-700/30 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                <Brain className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium">Reasoning</span>
                {workflow.activeStepId && (
                  <Loader className="w-3 h-3 text-amber-400 animate-spin ml-auto" />
                )}
              </div>
              <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
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
            </div>

            {/* Right Panel - Communication */}
            <div className="flex flex-col">
              {/* Strategy Panel */}
              {workflow.negotiationStrategy && isNegotiating && (
                <StrategyPanel
                  strategy={workflow.negotiationStrategy}
                  negotiationState={workflow.negotiationState}
                  currentEvaluation={workflow.currentEvaluation}
                />
              )}

              {/* Voice Interface */}
              {isVoiceMode && isNegotiating && (
                <VoiceCallInterface
                  onTranscript={vapiCall.handleTranscript}
                  onCallEnd={handleVapiCallEnd}
                  onCallStatusChange={vapiCall.handleCallStatusChange}
                  assistantId={VAPI_ASSISTANT_ID}
                  isActive={true}
                  originalAppointment={workflow.setupParams.originalAppointment}
                  delayMinutes={workflow.setupParams.delayMinutes}
                  shipmentValue={workflow.setupParams.shipmentValue}
                  retailer={workflow.setupParams.retailer}
                  onAssistantSpeechStart={handleAssistantSpeechStart}
                  onAssistantSpeechEnd={handleAssistantSpeechEnd}
                />
              )}

              {/* Chat Interface */}
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
              />

              {/* Voice Controls */}
              {isVoiceMode && isNegotiating && (
                <div className="mt-3">
                  <VoiceCallControls
                    callStatus={vapiCall.callStatus}
                    conversationPhase={workflow.conversationPhase}
                    isProcessing={workflow.isProcessing}
                    onEndCall={vapiCall.endCallFn}
                    onFinalize={handleFinalize}
                  />
                </div>
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
          </div>
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
    </div>
  );
}
