/**
 * Server-side store for call transcripts
 * Used to store messages from VAPI webhooks during phone calls
 * so they can be polled by the client.
 *
 * IMPORTANT: Uses globalThis to persist across serverless function invocations.
 * Without this, the Map would be empty in different API routes.
 */

export interface TranscriptMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

interface CallTranscriptState {
  messages: TranscriptMessage[];
  lastUpdated: number;
  callStatus: 'active' | 'ended';
  // True when speaker stopped (speech-update status=stopped), meaning last message is complete
  lastMessageComplete: boolean;
}

// Declare global type for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __transcriptStore: Map<string, CallTranscriptState> | undefined;
}

// Use globalThis to persist across serverless invocations
// This ensures the webhook and messages API share the same Map
const transcriptStore = globalThis.__transcriptStore ?? new Map<string, CallTranscriptState>();
globalThis.__transcriptStore = transcriptStore;

// TTL for cleanup (1 hour)
const TRANSCRIPT_TTL_MS = 60 * 60 * 1000;

/**
 * Initialize transcript store for a call
 */
export function initializeTranscript(callId: string): void {
  transcriptStore.set(callId, {
    messages: [],
    lastUpdated: Date.now(),
    callStatus: 'active',
    lastMessageComplete: false,
  });
  console.log(`[TranscriptStore] Initialized transcript for call: ${callId}`);
}

/**
 * Add a message to the transcript
 */
export function addTranscriptMessage(
  callId: string,
  role: 'assistant' | 'user',
  content: string
): void {
  let state = transcriptStore.get(callId);

  if (!state) {
    state = {
      messages: [],
      lastUpdated: Date.now(),
      callStatus: 'active',
      lastMessageComplete: false,
    };
    transcriptStore.set(callId, state);
  }

  const message: TranscriptMessage = {
    id: `${callId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  };

  state.messages.push(message);
  state.lastUpdated = Date.now();
  // New message added = it's still in progress until speech-update says stopped
  state.lastMessageComplete = false;

  console.log(`[TranscriptStore] Added message to call ${callId}:`, {
    role,
    contentPreview: content.substring(0, 50),
    totalMessages: state.messages.length,
  });
}

/**
 * Mark the last message as complete (called when speech-update status=stopped)
 */
export function markLastMessageComplete(callId: string): void {
  const state = transcriptStore.get(callId);
  if (state) {
    state.lastMessageComplete = true;
    state.lastUpdated = Date.now();
  }
}

/**
 * Get the current message count for a call
 */
export function getMessageCount(callId: string): number {
  const state = transcriptStore.get(callId);
  return state?.messages.length ?? 0;
}

/**
 * Set lastMessageComplete flag explicitly (used after rebuilding to preserve state)
 */
export function setLastMessageComplete(callId: string, complete: boolean): void {
  const state = transcriptStore.get(callId);
  if (state) {
    state.lastMessageComplete = complete;
  }
}

/**
 * Check if the last message is complete
 */
export function isLastMessageComplete(callId: string): boolean {
  const state = transcriptStore.get(callId);
  return state?.lastMessageComplete ?? false;
}

/**
 * Clear all messages for a call (used before rebuilding from conversation-update)
 * NOTE: Does NOT reset lastMessageComplete - that flag is managed by speech-update events
 * and should only be reset when a new message is actually added (which happens in addTranscriptMessage)
 */
export function clearTranscriptMessages(callId: string): void {
  const state = transcriptStore.get(callId);
  if (state) {
    state.messages = [];
    state.lastUpdated = Date.now();
    // Don't reset lastMessageComplete - it's managed by speech-update events
    console.log(`[TranscriptStore] Cleared messages for call: ${callId}`);
  }
}

/**
 * Get all messages for a call (optionally after a certain message ID)
 */
export function getTranscriptMessages(
  callId: string,
  afterMessageId?: string
): TranscriptMessage[] {
  const state = transcriptStore.get(callId);
  if (!state) {
    return [];
  }

  if (!afterMessageId) {
    return state.messages;
  }

  // Find index of the message and return all after it
  const index = state.messages.findIndex((m) => m.id === afterMessageId);
  if (index === -1) {
    return state.messages; // Return all if not found
  }

  return state.messages.slice(index + 1);
}

/**
 * Mark call as ended
 */
export function markCallEnded(callId: string): void {
  const state = transcriptStore.get(callId);
  if (state) {
    state.callStatus = 'ended';
    state.lastUpdated = Date.now();
    console.log(`[TranscriptStore] Marked call ${callId} as ended`);
  }
}

/**
 * Get call status
 */
export function getCallStatus(callId: string): 'active' | 'ended' | 'unknown' {
  const state = transcriptStore.get(callId);
  return state?.callStatus || 'unknown';
}

/**
 * Clean up old transcripts
 */
export function cleanupOldTranscripts(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [callId, state] of transcriptStore.entries()) {
    if (now - state.lastUpdated > TRANSCRIPT_TTL_MS) {
      transcriptStore.delete(callId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[TranscriptStore] Cleaned up ${cleaned} old transcripts`);
  }
}

// Run cleanup periodically
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupOldTranscripts, 5 * 60 * 1000); // Every 5 minutes
}
