'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneCall,
  Mic,
  Loader,
  CheckCircle,
  UserCheck,
  AlertCircle,
  User,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type DriverCallStatus =
  | 'idle'
  | 'connecting'
  | 'active'
  | 'confirmed'        // Driver confirmed the proposed time
  | 'counter_proposed' // Driver proposed a different time
  | 'rejected'         // Driver rejected without alternative
  | 'timeout'
  | 'failed';

// Result returned when call ends
export interface DriverCallResult {
  status: DriverCallStatus;
  // Did driver accept the warehouse's proposed time?
  acceptedProposedTime: boolean;
  // The final confirmed/proposed time (either original or counter-proposed)
  confirmedTime: string;
  confirmedTime24h: string;
  // If driver counter-proposed, this is their proposed time
  counterProposedTime?: string;
  counterProposedTime24h?: string;
}

export interface TranscriptMessage {
  id: string;
  role: 'driver' | 'assistant';
  content: string;
  timestamp: string;
}

export interface DriverCallConfig {
  proposedTime: string;
  proposedDock: string;
  warehouseName?: string;
  originalAppointment: string;
}

export interface DriverVoiceInterfaceProps {
  config: DriverCallConfig;
  onCallResult?: (result: DriverCallResult) => void;
  assistantId?: string;
  publicKey?: string;
  className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTimeForSpeech(time24h: string): string {
  const [hoursStr, minutesStr] = time24h.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return minutes === 0 ? `${hour12} ${period}` : `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Driver response types
 */
type DriverResponseType =
  | { type: 'confirmed' }
  | { type: 'rejected' }
  | { type: 'counter_proposal'; time: string; time24h: string }
  | { type: 'unclear' }
  | null;

/**
 * Extract time from driver speech (e.g., "4 PM", "four o'clock", "4:30")
 */
function extractTimeFromSpeech(text: string): { time: string; time24h: string } | null {
  const lowerText = text.toLowerCase();

  // Pattern for "X PM/AM" or "X:XX PM/AM"
  const timePattern = /\b(\d{1,2})(?::(\d{2}))?\s*(pm|am|p\.?m\.?|a\.?m\.?)\b/i;
  const match = text.match(timePattern);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3].toLowerCase().replace(/\./g, '');

    // Convert to 24h
    if (period.startsWith('p') && hours !== 12) hours += 12;
    if (period.startsWith('a') && hours === 12) hours = 0;

    const time24h = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const displayPeriod = hours >= 12 ? 'PM' : 'AM';
    const time = minutes === 0 ? `${hour12} ${displayPeriod}` : `${hour12}:${minutes.toString().padStart(2, '0')} ${displayPeriod}`;

    return { time, time24h };
  }

  // Pattern for word-based times like "four", "four thirty"
  const wordToNum: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
    'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12
  };

  const wordTimePattern = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(thirty|fifteen|forty-?five))?\s*(pm|am|o'?clock)?\b/i;
  const wordMatch = lowerText.match(wordTimePattern);

  if (wordMatch) {
    let hours = wordToNum[wordMatch[1].toLowerCase()] || 0;
    let minutes = 0;
    if (wordMatch[2]) {
      if (wordMatch[2].includes('thirty')) minutes = 30;
      if (wordMatch[2].includes('fifteen')) minutes = 15;
      if (wordMatch[2].includes('forty')) minutes = 45;
    }

    // Assume PM for business hours if not specified
    const isPM = wordMatch[3]?.toLowerCase().startsWith('p') ||
                 (!wordMatch[3] && hours >= 1 && hours <= 6);
    if (isPM && hours !== 12) hours += 12;

    const time24h = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const displayPeriod = hours >= 12 ? 'PM' : 'AM';
    const time = minutes === 0 ? `${hour12} ${displayPeriod}` : `${hour12}:${minutes.toString().padStart(2, '0')} ${displayPeriod}`;

    return { time, time24h };
  }

  return null;
}

/**
 * Semantic detection - detects confirmation, rejection, or counter-proposal with time
 *
 * IMPORTANT: Order of checking matters!
 * 1. Uncertainty/negation patterns FIRST (trumps everything else)
 * 2. Counter-proposals (with specific time DIFFERENT from proposed time)
 * 3. Direct rejection patterns
 * 4. Confirmation patterns
 *
 * @param transcript - The driver's spoken text
 * @param proposedTime24h - The proposed time in 24h format (e.g., "15:30") to filter out
 */
function detectDriverResponse(transcript: string, proposedTime24h?: string): DriverResponseType {
  const text = transcript.toLowerCase().trim();

  // Skip very short responses that are ambiguous
  if (text.length < 2) return null;

  // ==========================================================================
  // UNCERTAINTY/NEGATION PATTERNS - Check FIRST!
  // These patterns indicate the driver is NOT confirming or counter-proposing
  // "I don't think I can make 3:30 work" is NOT a counter-proposal for 3:30!
  // ==========================================================================
  const negationPatterns = [
    /\bdon'?t\s+think\b/,                        // "I don't think I can make that"
    /\bnot\s+sure\b/,                            // "I'm not sure if I can make that"
    /\bdon'?t\s+know\s+if\b/,                    // "I don't know if I can"
    /\bnot\s+certain\b/,                         // "I'm not certain"
    /\bmight\s+not\b/,                           // "I might not be able to"
    /\bmay\s+not\b/,                             // "I may not make it"
    /\bprobably\s+(can'?t|won'?t|not)\b/,        // "I probably can't"
    /\bdoubt\s+(i|that|it)\b/,                   // "I doubt I can"
    /\bnot\s+confident\b/,                       // "I'm not confident"
    /\bunsure\b/,                                // "I'm unsure"
    /\bstill\s+(working|fixing|dealing)\b/,      // "I'm still working on..."
    /\bhaving\s+(trouble|issues|problems)\b/,    // "I'm having trouble"
    /\bworking\s+on\s+(fixing|it|the)\b/,        // "still working on fixing"
    /\bcan'?t\s+make\b/,                         // "I can't make that work"
    /\bwon'?t\s+(work|make)\b/,                  // "That won't work"
  ];

  for (const pattern of negationPatterns) {
    if (pattern.test(text)) {
      console.log('   └─ Matched NEGATION pattern:', pattern.toString());
      console.log('   └─ Treating as unclear - letting conversation continue');
      return { type: 'unclear' };
    }
  }

  // ==========================================================================
  // COUNTER-PROPOSAL PATTERNS - Check for NEW times being proposed
  // The extracted time must be DIFFERENT from the proposed time
  // ==========================================================================
  const extractedTime = extractTimeFromSpeech(transcript);

  if (extractedTime) {
    // Check if the extracted time is the SAME as the proposed time
    // If so, it's not a counter-proposal, they're just repeating the time
    if (proposedTime24h && extractedTime.time24h === proposedTime24h) {
      console.log('   └─ Extracted time matches proposed time - not a counter-proposal');
      // Don't return counter_proposal, let it fall through to other checks
    } else {
      // Time is different from proposed - check if it's being offered
      const counterProposalContextPatterns = [
        /\bhow\s+about\b/,                           // "How about 4 PM?"
        /\bwhat\s+about\b/,                          // "What about 4:30?"
        /\bcan\s+we\s+(do|make\s+it)\b/,             // "Can we do 4?"
        /\bi'?ll\s+be\s+(there\s+)?(by|at|around)\b/,// "I'll be there by 4"
        /\b(maybe|probably)\b/,                      // "Maybe 4 PM", "Probably 4:30"
        /\b(\d+|half\s+an?\s+hour|hour)\s+late\b/,   // "half an hour late"
        /\bmore\s+like\b/,                           // "More like 4 PM"
        /\bi\s+(can|could)\s+(do|make)\b/,           // "I could do 4 PM"
        /\baround\b/,                                // "Around 4"
      ];

      for (const pattern of counterProposalContextPatterns) {
        if (pattern.test(text)) {
          console.log('   └─ Matched counter-proposal context:', pattern.toString());
          console.log('   └─ Extracted time:', extractedTime.time);
          return { type: 'counter_proposal', ...extractedTime };
        }
      }

      // If a time is mentioned without strong context, still treat as counter-proposal
      // This catches simple responses like "4 PM" or "Four thirty"
      console.log('   └─ Time mentioned:', extractedTime.time);
      console.log('   └─ Treating as counter-proposal (time mentioned in response)');
      return { type: 'counter_proposal', ...extractedTime };
    }
  }

  // Check for "late" with relative time that we can calculate
  if (/\b(late|behind|delayed)\b/.test(text)) {
    // This indicates rejection but we may not have exact time
    // The VAPI assistant (Mike) should ask for specific time
    console.log('   └─ Detected "late/behind/delayed" - treating as unclear');
    return { type: 'unclear' };
  }

  // ==========================================================================
  // REJECTION PATTERNS - Direct rejections
  // ==========================================================================
  const rejectionPatterns = [
    /\b(can'?t|cannot|won'?t|unable)\b.*\b(make|do|work)\b/,
    /\b(that'?s?|it'?s?)\s+(not|won'?t|doesn'?t)\s+(going to\s+)?(work|possible|doable)/,
    /\bno\s+way\b/,
    /\bimpossible\b/,
    /\bout\s+of\s+(time|hours)\b/,
    /\bwon'?t\s+(work|make\s+it|be\s+able)/,
    /\bnot\s+gonna\s+(work|make|happen)/,
    /\bdoesn'?t\s+work\b/,
    /\bcan'?t\s+do\s+(that|it)\b/,
    /\bsounds\s+difficult\b/,                    // "Sounds difficult"
    /\btoo\s+(tight|early|late|close)\b/,        // "That's too tight"
    /^no\.?$/,
    /^nope\.?$/,
    /^nah\.?$/,
  ];

  for (const pattern of rejectionPatterns) {
    if (pattern.test(text)) {
      console.log('   └─ Matched rejection pattern:', pattern.toString());
      return { type: 'rejected' };
    }
  }

  // ==========================================================================
  // CONFIRMATION PATTERNS - Driver accepts the proposed time
  // Only checked AFTER ruling out uncertainty and rejection
  // ==========================================================================
  const confirmationPatterns = [
    // Direct affirmatives
    /^(yes|yeah|yep|yup|sure|absolutely|definitely|perfect)\.?$/,
    /\b(yes|yeah|yep|yup)\b.*\b(can|will|should)\b/,

    // "I can make that/it" - but ONLY if no negation prefix was detected above
    /\bi\s+(can|could)\s+(make\s+that|do\s+that|make\s+it|do\s+it)\b/,
    /\bi\s+think\s+i\s+(can|could)\s+(make|do)\s+(that|it)\b/,

    // "That works" variants
    /\b(that|it)\s+(works|should\s+work|will\s+work)\b/,
    /\bworks\s+for\s+me\b/,
    /\bsounds\s+good\b/,

    // Agreement patterns
    /\bno\s+problem\b/,
    /\bshouldn'?t\s+be\s+a\s+problem\b/,
    /\bi'?m\s+(good|fine)\s+with\s+(that|it)\b/,
    /\b(that'?s?|it'?s?)\s+(fine|good|great|perfect|doable)\b/,

    // Confirmations with context
    /\bconfirm/,
    /\bsee\s+you\s+(then|there)\b/,
    /\bwill\s+do\b/,
    /\bcan\s+do\b/,
  ];

  for (const pattern of confirmationPatterns) {
    if (pattern.test(text)) {
      console.log('   └─ Matched confirmation pattern:', pattern.toString());
      return { type: 'confirmed' };
    }
  }

  // No clear signal detected
  return null;
}

// =============================================================================
// TRANSCRIPT MESSAGE COMPONENTS
// Uses same styling as ChatInterface's WarehouseMessage and AgentMessage
// =============================================================================

/** Driver message bubble - matches WarehouseMessage styling (right-aligned, colored) */
function DriverMessage({ content, timestamp }: { content: string; timestamp: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] space-y-2">
        <div className="rounded-2xl px-4 py-2.5 bg-blue-500/20 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-blue-400">Driver</span>
            <span className="text-[10px] text-slate-500">{timestamp}</span>
          </div>
          <p className="text-sm text-slate-200">{content}</p>
        </div>
      </div>
    </div>
  );
}

/** Assistant (Mike) message bubble - matches AgentMessage styling (left-aligned) */
function AssistantMessage({ content, timestamp }: { content: string; timestamp: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-2">
        <div className="rounded-2xl px-4 py-2.5 bg-slate-700/50 border border-slate-600/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-slate-400">Dispatch (Mike)</span>
            <span className="text-[10px] text-slate-500">{timestamp}</span>
          </div>
          <p className="text-sm text-slate-200">{content}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CONSTANTS - Same as warehouse call
// =============================================================================

const SILENCE_DURATION_MS = 2000; // Wait 2 seconds of silence before ending call

// =============================================================================
// MAIN COMPONENT
// Uses EXACT same CSS classes as ChatInterface
// =============================================================================

export function DriverVoiceInterface({
  config,
  onCallResult,
  assistantId = process.env.NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID || '',
  publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '',
  className = '',
}: DriverVoiceInterfaceProps) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [callStatus, setCallStatus] = useState<DriverCallStatus>('idle');
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  // State for UI display of counter-proposed time (refs don't trigger re-renders)
  const [counterProposedTimeDisplay, setCounterProposedTimeDisplay] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // REFS - Same pattern as warehouse call
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiClientRef = useRef<any>(null);
  const callStatusRef = useRef<DriverCallStatus>('idle');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);

  // Timeout timer (60 second max call duration)
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Silence timer for graceful call ending (same as warehouse)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track assistant speech state (same as warehouse: isAssistantSpeakingRef)
  const isAssistantSpeakingRef = useRef<boolean>(false);

  // Track user (driver) speech state - IMPORTANT: cancel silence timer when user speaks
  const isUserSpeakingRef = useRef<boolean>(false);

  // Track if we're waiting for assistant to finish speaking before ending (same as warehouse: waitingForSpeechEndRef)
  const waitingForSpeechEndRef = useRef<boolean>(false);

  // Track the pending result while waiting for assistant to finish
  const pendingResultRef = useRef<'confirmed' | 'counter_proposed' | 'rejected' | null>(null);

  // Track if the assistant has asked the confirmation question
  // Only check for driver confirmation AFTER this is true
  const confirmationQuestionAskedRef = useRef<boolean>(false);

  // Track counter-proposed time if driver proposes a different time
  const counterProposedTimeRef = useRef<{ time: string; time24h: string } | null>(null);

  // Track if driver accepted the original proposed time or counter-proposed
  const acceptedProposedTimeRef = useRef<boolean>(true);

  // Keep ref in sync with state
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (vapiClientRef.current) {
        try {
          vapiClientRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // SPEECH STATE HANDLERS - Same pattern as warehouse call
  // ---------------------------------------------------------------------------

  const handleAssistantSpeechStart = useCallback(() => {
    console.log('🔊 [DriverVoice] handleAssistantSpeechStart');
    isAssistantSpeakingRef.current = true;

    // Cancel silence timer if assistant starts speaking again
    // AND set waitingForSpeechEndRef so we restart timer when assistant finishes
    if (silenceTimerRef.current) {
      console.log('   └─ Cancelling silence timer (assistant speaking again)');
      console.log('   └─ Will restart timer when assistant finishes');
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      // Set flag to restart timer when assistant finishes (if we have a pending result)
      if (pendingResultRef.current) {
        waitingForSpeechEndRef.current = true;
      }
    }
  }, []);

  const handleAssistantSpeechEnd = useCallback(() => {
    console.log('🔇 [DriverVoice] handleAssistantSpeechEnd');
    isAssistantSpeakingRef.current = false;

    // If we were waiting for assistant to finish before starting silence timer
    // AND user is not speaking, start the silence timer
    if (waitingForSpeechEndRef.current && pendingResultRef.current) {
      if (isUserSpeakingRef.current) {
        console.log('   └─ Was waiting for speech end, but user is still speaking - waiting');
      } else {
        console.log('   └─ Was waiting for speech end, now starting silence timer');
        console.log('   └─ Pending result:', pendingResultRef.current);
        waitingForSpeechEndRef.current = false;
        startSilenceTimer(pendingResultRef.current);
      }
    }
  }, []);

  const handleUserSpeechStart = useCallback(() => {
    console.log('🎤 [DriverVoice] handleUserSpeechStart');
    isUserSpeakingRef.current = true;

    // CRITICAL: Cancel silence timer if user starts speaking
    // This is actual silence detection - silence means NO ONE is talking
    if (silenceTimerRef.current) {
      console.log('   └─ Cancelling silence timer (user speaking)');
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      // Keep the pending result but wait for actual silence
      if (pendingResultRef.current) {
        waitingForSpeechEndRef.current = true;
      }
    }
  }, []);

  const handleUserSpeechEnd = useCallback(() => {
    console.log('🎤 [DriverVoice] handleUserSpeechEnd');
    isUserSpeakingRef.current = false;

    // If we have a pending result and neither party is speaking, start silence timer
    if (pendingResultRef.current && !isAssistantSpeakingRef.current) {
      console.log('   └─ User stopped, assistant not speaking - starting silence timer');
      console.log('   └─ Pending result:', pendingResultRef.current);
      waitingForSpeechEndRef.current = false;
      startSilenceTimer(pendingResultRef.current);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // SILENCE TIMER - Same pattern as warehouse call
  // ---------------------------------------------------------------------------

  const startSilenceTimer = useCallback((result: 'confirmed' | 'counter_proposed' | 'rejected') => {
    // Clear any existing timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    console.log(`⏰ [DriverVoice] Starting ${SILENCE_DURATION_MS / 1000}s silence timer`);
    console.log('   └─ Will end call with result:', result);
    if (counterProposedTimeRef.current) {
      console.log('   └─ Counter-proposed time:', counterProposedTimeRef.current.time);
    }

    silenceTimerRef.current = setTimeout(() => {
      console.log('⏰ [DriverVoice] Silence timer complete - ending call');
      finalizeCallResult(result);
      silenceTimerRef.current = null;
    }, SILENCE_DURATION_MS);
  }, []);

  // ---------------------------------------------------------------------------
  // FINALIZE CALL RESULT - Actually ends the call
  // ---------------------------------------------------------------------------

  const finalizeCallResult = useCallback((result: 'confirmed' | 'counter_proposed' | 'rejected' | 'timeout' | 'failed') => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📞 [DriverVoice] FINALIZING CALL');
    console.log('   └─ Result:', result);
    console.log('   └─ Previous status:', callStatusRef.current);
    console.log('   └─ Accepted proposed time:', acceptedProposedTimeRef.current);
    if (counterProposedTimeRef.current) {
      console.log('   └─ Counter-proposed time:', counterProposedTimeRef.current.time);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Update ref synchronously
    callStatusRef.current = result;

    // Clear all timers
    if (timeoutTimerRef.current) {
      console.log('   └─ Clearing timeout timer');
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      console.log('   └─ Clearing silence timer');
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Reset speech tracking
    waitingForSpeechEndRef.current = false;
    pendingResultRef.current = null;

    // End call if still active
    if (vapiClientRef.current) {
      console.log('   └─ Stopping VAPI client');
      try {
        vapiClientRef.current.stop();
      } catch (e) {
        // Ignore
      }
      vapiClientRef.current = null;
    }

    // Build the full result
    const counterTime = counterProposedTimeRef.current;
    const fullResult: DriverCallResult = {
      status: result,
      acceptedProposedTime: acceptedProposedTimeRef.current,
      // If counter-proposed, use that time; otherwise use original proposed time
      confirmedTime: counterTime ? counterTime.time : formatTimeForSpeech(config.proposedTime),
      confirmedTime24h: counterTime ? counterTime.time24h : config.proposedTime,
      counterProposedTime: counterTime?.time,
      counterProposedTime24h: counterTime?.time24h,
    };

    console.log('📋 [DriverVoice] Full result:', fullResult);

    // Update UI state for display
    if (counterTime) {
      setCounterProposedTimeDisplay(counterTime.time);
    }

    setCallStatus(result);
    onCallResult?.(fullResult);
  }, [onCallResult, config.proposedTime]);

  // ---------------------------------------------------------------------------
  // HANDLE CALL RESULT - Same pattern as warehouse call
  // Doesn't immediately end - waits for assistant to finish speaking
  // ---------------------------------------------------------------------------

  const handleCallResult = useCallback((
    result: 'confirmed' | 'counter_proposed' | 'rejected' | 'timeout' | 'failed',
    counterTime?: { time: string; time24h: string }
  ) => {
    // Prevent duplicate calls
    const terminalStates = ['confirmed', 'counter_proposed', 'rejected', 'timeout', 'failed'];
    if (terminalStates.includes(callStatusRef.current)) {
      console.log('⚠️ [DriverVoice] Ignoring result (already in terminal state)');
      console.log('   └─ Attempted:', result);
      console.log('   └─ Current:', callStatusRef.current);
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 [DriverVoice] CALL RESULT DETECTED:', result);
    console.log('   └─ Assistant speaking:', isAssistantSpeakingRef.current);
    console.log('   └─ Waiting for speech end:', waitingForSpeechEndRef.current);
    if (counterTime) {
      console.log('   └─ Counter-proposed time:', counterTime.time);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // For timeout/failed, end immediately
    if (result === 'timeout' || result === 'failed') {
      console.log('   └─ Immediate finalization (timeout/failed)');
      finalizeCallResult(result);
      return;
    }

    // Track counter-proposal info
    if (result === 'counter_proposed' && counterTime) {
      counterProposedTimeRef.current = counterTime;
      acceptedProposedTimeRef.current = false;
    } else if (result === 'confirmed') {
      acceptedProposedTimeRef.current = true;
    }

    // Clear the 60-second timeout since we got a response
    if (timeoutTimerRef.current) {
      console.log('   └─ Clearing 60s timeout timer');
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }

    // Store pending result
    pendingResultRef.current = result;
    console.log('   └─ Stored pending result:', result);

    // If assistant is currently speaking, wait for speech to end
    if (isAssistantSpeakingRef.current) {
      console.log('🔊 [DriverVoice] Assistant still speaking');
      console.log('   └─ Will start silence timer when assistant finishes');
      waitingForSpeechEndRef.current = true;
    } else {
      // Assistant not speaking - start silence timer after short delay
      // (to account for any speech-to-text latency)
      console.log('🔇 [DriverVoice] Assistant not speaking');
      console.log('   └─ Starting 500ms delay before silence timer');
      setTimeout(() => {
        // Only start timer if assistant hasn't started speaking again
        if (!isAssistantSpeakingRef.current && pendingResultRef.current) {
          console.log('   └─ 500ms delay complete, starting silence timer');
          startSilenceTimer(pendingResultRef.current);
        } else if (pendingResultRef.current) {
          console.log('   └─ Assistant started speaking during delay - will wait');
          waitingForSpeechEndRef.current = true;
        }
      }, 500);
    }
  }, [finalizeCallResult, startSilenceTimer]);

  // ---------------------------------------------------------------------------
  // START CALL
  // ---------------------------------------------------------------------------
  const startCall = async () => {
    if (!publicKey) {
      console.error('❌ [DriverVoice] VAPI public key not configured');
      alert('VAPI public key not configured. Please set NEXT_PUBLIC_VAPI_PUBLIC_KEY.');
      return;
    }

    if (!assistantId) {
      console.error('❌ [DriverVoice] Driver assistant ID not configured');
      alert('Driver assistant ID not configured. Please set NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID.');
      return;
    }

    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📞 [DriverVoice] STARTING CALL');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      setCallStatus('connecting');
      callStatusRef.current = 'connecting';
      setTranscripts([]);
      setCounterProposedTimeDisplay(null);

      // Reset speech tracking
      isAssistantSpeakingRef.current = false;
      isUserSpeakingRef.current = false;
      waitingForSpeechEndRef.current = false;
      pendingResultRef.current = null;
      confirmationQuestionAskedRef.current = false;
      counterProposedTimeRef.current = null;
      acceptedProposedTimeRef.current = true;
      console.log('   └─ Reset speech tracking refs');
      console.log('   └─ Reset counter-proposal tracking refs');
      console.log('   └─ Waiting for assistant to ask confirmation question before detecting response');

      // Dynamically import VAPI SDK
      console.log('   └─ Loading VAPI SDK...');
      const VapiModule = await import('@vapi-ai/web');
      const VapiClass = VapiModule.default;

      const client = new VapiClass(publicKey);
      vapiClientRef.current = client;

      // ---------------------------------------------------------------------------
      // EVENT LISTENERS - Same pattern as warehouse call
      // ---------------------------------------------------------------------------

      client.on('call-start', () => {
        console.log('🟢 VAPI: Call started');
        setCallStatus('active');
        callStatusRef.current = 'active';

        // Start 60-second timeout
        timeoutTimerRef.current = setTimeout(() => {
          console.log('⏰ [DriverVoice] Timeout - no response in 60 seconds');
          handleCallResult('timeout');
        }, 60000);
      });

      client.on('call-end', () => {
        console.log('🔴 VAPI: Call ended');
        console.log('   └─ Current status:', callStatusRef.current);
        console.log('   └─ Pending result:', pendingResultRef.current);
        console.log('   └─ Counter-proposed time:', counterProposedTimeRef.current?.time || 'none');
        const currentStatus = callStatusRef.current;

        // If we have a pending result, use that instead of timeout
        if (pendingResultRef.current) {
          console.log('📞 [DriverVoice] Using pending result:', pendingResultRef.current);
          finalizeCallResult(pendingResultRef.current);
          return;
        }

        // If we haven't received explicit confirmation/rejection, treat as timeout
        if (currentStatus === 'active' || currentStatus === 'connecting') {
          console.log('⚠️ [DriverVoice] No explicit confirmation - treating as timeout');
          finalizeCallResult('timeout');
        }
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

        // Log full message object like warehouse call does
        console.log('📨 VAPI Message:', msg.type, msg);

        // Track speech state via speech-update for BOTH assistant AND user
        // This is critical for proper silence detection
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
          } else if (msg.role === 'user') {
            // Track user speech to properly detect silence
            if (msg.status === 'started') {
              console.log('🎤 User started speaking');
              handleUserSpeechStart();
            } else if (msg.status === 'stopped') {
              console.log('🎤 User stopped speaking');
              handleUserSpeechEnd();
            }
          }
        }

        // Handle transcript messages
        if (msg.type === 'transcript' && msg.transcriptType === 'final') {
          const role = msg.role === 'user' ? 'driver' : 'assistant';
          const content = msg.transcript;

          // Log transcript content like warehouse call does
          console.log(`💬 Transcript (${role}):`, content);

          // Add to transcripts
          const newMessage: TranscriptMessage = {
            id: `msg-${++messageIdRef.current}`,
            role,
            content,
            timestamp: new Date().toLocaleTimeString(),
          };
          setTranscripts(prev => [...prev, newMessage]);

          // Check if assistant has asked the confirmation question
          // Only then do we start listening for driver's yes/no response
          if (role === 'assistant') {
            const lowerAssistant = content.toLowerCase();
            if (
              lowerAssistant.includes('can you make') ||
              lowerAssistant.includes('does that work') ||
              lowerAssistant.includes('will that work') ||
              lowerAssistant.includes('that work for you') ||
              lowerAssistant.includes('work for you') ||
              lowerAssistant.includes('can you do')
            ) {
              console.log('❓ [DriverVoice] Confirmation question detected - now listening for driver response');
              confirmationQuestionAskedRef.current = true;
            }

            // Check for conversation-ending phrases from assistant
            // If Mike says goodbye and we don't have a result yet, the driver couldn't confirm
            const goodbyePatterns = [
              /\btalk\s+to\s+you\s+(later|soon)\b/,     // "Talk to you later"
              /\bstay\s+safe\b/,                        // "Stay safe out there"
              /\btake\s+care\b/,                        // "Take care"
              /\bthanks\s+for\s+the\s+heads\s+up\b/,    // "Thanks for the heads up"
              /\bi'?ll\s+let\s+(the\s+)?warehouse\s+know\b/, // "I'll let the warehouse know"
              /\bgive\s+dispatch\s+a\s+call\b/,         // "Give dispatch a call when..."
              /\bbye\b/,                                // "Bye"
              /\bcatch\s+you\s+later\b/,                // "Catch you later"
            ];

            const isGoodbye = goodbyePatterns.some(pattern => pattern.test(lowerAssistant));

            if (isGoodbye && !pendingResultRef.current && confirmationQuestionAskedRef.current) {
              console.log('👋 [DriverVoice] Assistant said goodbye - ending call as rejected');
              console.log('   └─ No confirmation was received');
              // Mark as rejected since driver couldn't confirm the proposed time
              acceptedProposedTimeRef.current = false;
              handleCallResult('rejected');
            }
          }

          // Check for confirmation/rejection/counter-proposal in driver's speech
          // ONLY if the assistant has already asked the confirmation question
          if (role === 'driver' && !pendingResultRef.current) {
            if (!confirmationQuestionAskedRef.current) {
              console.log('⏳ [DriverVoice] Driver spoke, but confirmation question not asked yet - ignoring');
            } else {
              // Use semantic detection
              console.log('🔍 [DriverVoice] Analyzing driver response:', content);
              const detectedResponse = detectDriverResponse(content, config.proposedTime);

              if (detectedResponse === null) {
                console.log('🤔 [DriverVoice] No clear signal detected');
              } else if (detectedResponse.type === 'confirmed') {
                console.log('✅ [DriverVoice] Driver CONFIRMED the proposed time');
                handleCallResult('confirmed');
              } else if (detectedResponse.type === 'rejected') {
                console.log('❌ [DriverVoice] Driver REJECTED (no alternative provided)');
                // Don't end call yet - Mike should ask for alternative time
                // Just log for now, let the conversation continue
              } else if (detectedResponse.type === 'counter_proposal') {
                console.log('🔄 [DriverVoice] Driver COUNTER-PROPOSED:', detectedResponse.time);
                handleCallResult('counter_proposed', { time: detectedResponse.time, time24h: detectedResponse.time24h });
              } else if (detectedResponse.type === 'unclear') {
                console.log('🤔 [DriverVoice] Response unclear - letting conversation continue');
                // Let Mike (VAPI assistant) handle asking for clarification
              }
            }
          }
        }

        // Log model-output events (for debugging)
        if (msg.type === 'model-output') {
          console.log('🤖 Model output detected');
        }

        // Log assistant response completion
        if (msg.type === 'assistant-response' && msg.done === true) {
          console.log('✅ Assistant response complete');
        }
      });

      client.on('error', (error: unknown) => {
        console.error('❌ VAPI error:', error);
        finalizeCallResult('failed');
      });

      // ---------------------------------------------------------------------------
      // START THE CALL
      // ---------------------------------------------------------------------------

      const driverVariables = {
        proposed_time: formatTimeForSpeech(config.proposedTime),
        proposed_time_24h: config.proposedTime,
        proposed_dock: config.proposedDock,
        warehouse_name: config.warehouseName || 'the warehouse',
        original_appointment: formatTimeForSpeech(config.originalAppointment),
      };

      console.log('🚀 Starting VAPI call with variables:', driverVariables);

      await client.start(assistantId, {
        variableValues: driverVariables,
      });

      console.log('✅ VAPI call started successfully');
    } catch (error) {
      console.error('❌ [DriverVoice] Failed to start call:', error);
      finalizeCallResult('failed');
    }
  };

  // ---------------------------------------------------------------------------
  // END CALL
  // ---------------------------------------------------------------------------
  const endCall = () => {
    console.log('🛑 [DriverVoice] Manual end call requested');
    console.log('   └─ Current status:', callStatusRef.current);
    console.log('   └─ Pending result:', pendingResultRef.current);
    if (vapiClientRef.current) {
      vapiClientRef.current.stop();
    }
  };

  // ---------------------------------------------------------------------------
  // RESET
  // ---------------------------------------------------------------------------
  const reset = () => {
    console.log('🔄 [DriverVoice] Resetting state');
    setCallStatus('idle');
    callStatusRef.current = 'idle';
    setTranscripts([]);
    setCounterProposedTimeDisplay(null);
    messageIdRef.current = 0;
    isAssistantSpeakingRef.current = false;
    isUserSpeakingRef.current = false;
    waitingForSpeechEndRef.current = false;
    pendingResultRef.current = null;
    confirmationQuestionAskedRef.current = false;
    counterProposedTimeRef.current = null;
    acceptedProposedTimeRef.current = true;
  };

  // ---------------------------------------------------------------------------
  // DERIVED STATE
  // ---------------------------------------------------------------------------
  const isCallEnded = ['confirmed', 'counter_proposed', 'rejected', 'timeout', 'failed'].includes(callStatus);
  const hasConfigured = !!publicKey && !!assistantId;

  // ---------------------------------------------------------------------------
  // RENDER - Uses EXACT same structure and CSS as ChatInterface
  // ---------------------------------------------------------------------------
  return (
    <div
      className={`bg-slate-800/20 border border-slate-700/30 rounded-2xl overflow-hidden flex flex-col shadow-xl ${className}`}
      style={{ height: 'calc(100vh - 144px)', maxHeight: '800px', minHeight: '400px' }}
    >
      {/* Header - Same as ChatInterface */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium">Driver Confirmation</span>
        </div>
        <div className="flex gap-1">
          {/* Status badges - same styling as ChatInterface */}
          {callStatus === 'confirmed' && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              Confirmed
            </span>
          )}
          {callStatus === 'counter_proposed' && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Counter-Proposed
            </span>
          )}
          {(callStatus === 'rejected' || callStatus === 'timeout' || callStatus === 'failed') && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {callStatus === 'rejected' ? 'Rejected' : callStatus === 'timeout' ? 'Timeout' : 'Failed'}
            </span>
          )}
          {/* Proposed time/dock badges */}
          <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded">
            {formatTimeForSpeech(config.proposedTime)}
          </span>
          <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded">
            Dock {config.proposedDock}
          </span>
        </div>
      </div>

      {/* Messages Area - Same as ChatInterface */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {transcripts.length === 0 && callStatus === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <User className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">
              Click "Start Call" to connect with the driver
            </p>
            <p className="text-xs text-slate-500 mt-2">
              The driver will be asked to confirm {formatTimeForSpeech(config.proposedTime)} at Dock {config.proposedDock}
            </p>
          </div>
        )}
        {transcripts.map(msg => (
          msg.role === 'driver' ? (
            <DriverMessage key={msg.id} content={msg.content} timestamp={msg.timestamp} />
          ) : (
            <AssistantMessage key={msg.id} content={msg.content} timestamp={msg.timestamp} />
          )
        ))}
        <div ref={transcriptEndRef} />
      </div>

      {/* Input/Control Area - EXACT same structure as ChatInterface voice mode */}
      <div className="p-3 border-t border-white/5">
        {/* Idle state - Start call button */}
        {callStatus === 'idle' && (
          <button
            onClick={startCall}
            disabled={!hasConfigured}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
          >
            <Phone className="w-5 h-5" />
            Start Driver Call
          </button>
        )}

        {/* Connecting state */}
        {callStatus === 'connecting' && (
          <div className="flex items-center justify-center gap-3 py-3">
            <Loader className="w-5 h-5 text-purple-400 animate-spin" />
            <span className="text-sm text-purple-300">Connecting to driver...</span>
          </div>
        )}

        {/* Active call state */}
        {callStatus === 'active' && (
          <>
            {/* Live call indicator - same as ChatInterface */}
            <div className="bg-black/20 rounded-lg p-3 mb-2 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400 font-medium">LIVE CALL</span>
              </div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Mic className="w-5 h-5 text-purple-400 animate-pulse" />
              </div>
              <p className="text-xs text-slate-500">
                Speak naturally with the driver
              </p>
            </div>
            {/* End call button - same as ChatInterface */}
            <button
              onClick={endCall}
              className="w-full py-2.5 bg-red-500 hover:bg-red-400 text-white font-medium rounded-xl flex items-center justify-center gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              End Call
            </button>
          </>
        )}

        {/* Call ended states */}
        {callStatus === 'confirmed' && (
          <div className="text-center py-3">
            <UserCheck className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
            <p className="text-sm text-emerald-300 font-medium">Driver Confirmed</p>
            <p className="text-xs text-slate-500 mt-1">
              {formatTimeForSpeech(config.proposedTime)} at Dock {config.proposedDock}
            </p>
            <button
              onClick={reset}
              className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg"
            >
              Start New Call
            </button>
          </div>
        )}

        {callStatus === 'counter_proposed' && (
          <div className="text-center py-3">
            <CheckCircle className="w-6 h-6 text-amber-400 mx-auto mb-1" />
            <p className="text-sm text-amber-300 font-medium">Driver Counter-Proposed</p>
            <p className="text-xs text-slate-500 mt-1">
              Driver proposed: <span className="text-amber-400 font-medium">{counterProposedTimeDisplay}</span>
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Original proposal was {formatTimeForSpeech(config.proposedTime)} at Dock {config.proposedDock}
            </p>
            <button
              onClick={reset}
              className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg"
            >
              Start New Call
            </button>
          </div>
        )}

        {callStatus === 'rejected' && (
          <div className="text-center py-3">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
            <p className="text-sm text-red-300 font-medium">Driver Rejected</p>
            <p className="text-xs text-slate-500 mt-1">
              Driver cannot make the proposed time
            </p>
            <button
              onClick={reset}
              className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg"
            >
              Start New Call
            </button>
          </div>
        )}

        {callStatus === 'timeout' && (
          <div className="text-center py-3">
            <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-1" />
            <p className="text-sm text-amber-300 font-medium">No Response</p>
            <p className="text-xs text-slate-500 mt-1">
              Driver did not respond within 60 seconds
            </p>
            <button
              onClick={reset}
              className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg"
            >
              Try Again
            </button>
          </div>
        )}

        {callStatus === 'failed' && (
          <div className="text-center py-3">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
            <p className="text-sm text-red-300 font-medium">Call Failed</p>
            <p className="text-xs text-slate-500 mt-1">
              Unable to connect to driver
            </p>
            <button
              onClick={reset}
              className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverVoiceInterface;
