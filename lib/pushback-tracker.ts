/**
 * Pushback Tracker
 *
 * Server-side state management for tracking pushback counts per VAPI call.
 * This solves the problem of VAPI not being able to reliably track counters internally.
 *
 * The tracker:
 * 1. Stores pushback count per call ID
 * 2. Auto-increments when an offer is rejected
 * 3. Auto-cleans up stale entries after TTL expires
 */

interface PushbackState {
  count: number;
  lastUpdated: number;
  callStartTime: number;
}

// In-memory store - for production, consider Redis or similar
const pushbackStore = new Map<string, PushbackState>();

// TTL for cleanup (1 hour) - calls longer than this are cleaned up
const STATE_TTL_MS = 60 * 60 * 1000;

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Get the current pushback count for a call
 */
export function getPushbackCount(callId: string): number {
  const state = pushbackStore.get(callId);
  if (!state) {
    return 0;
  }
  return state.count;
}

/**
 * Increment the pushback count for a call
 * Called when an offer is rejected (acceptable=false)
 */
export function incrementPushbackCount(callId: string): number {
  const now = Date.now();
  const existing = pushbackStore.get(callId);

  if (existing) {
    existing.count += 1;
    existing.lastUpdated = now;
    pushbackStore.set(callId, existing);
    console.log(`📊 [PushbackTracker] Incremented count for call ${callId}: ${existing.count}`);
    return existing.count;
  } else {
    // First rejection for this call
    const newState: PushbackState = {
      count: 1,
      lastUpdated: now,
      callStartTime: now,
    };
    pushbackStore.set(callId, newState);
    console.log(`📊 [PushbackTracker] First pushback for call ${callId}: 1`);
    return 1;
  }
}

/**
 * Reset/clear the pushback count for a call
 * Called when a call ends or when we want to start fresh
 */
export function resetPushbackCount(callId: string): void {
  pushbackStore.delete(callId);
  console.log(`📊 [PushbackTracker] Reset count for call ${callId}`);
}

/**
 * Get stats for debugging
 */
export function getTrackerStats(): { activeCalls: number; callIds: string[] } {
  return {
    activeCalls: pushbackStore.size,
    callIds: Array.from(pushbackStore.keys()),
  };
}

/**
 * Cleanup stale entries
 */
function cleanupStaleEntries(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [callId, state] of pushbackStore.entries()) {
    if (now - state.lastUpdated > STATE_TTL_MS) {
      pushbackStore.delete(callId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`📊 [PushbackTracker] Cleaned up ${cleaned} stale entries`);
  }
}

// Start cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupStaleEntries, CLEANUP_INTERVAL_MS);
}

/**
 * Extract call ID from VAPI webhook body
 * VAPI typically sends call info in message.call.id or similar
 */
export function extractCallId(webhookBody: Record<string, unknown>): string | null {
  // Try different paths where VAPI might put the call ID

  // Path 1: message.call.id (common VAPI structure)
  const messageCall = (webhookBody.message as Record<string, unknown>)?.call as Record<string, unknown>;
  if (messageCall?.id && typeof messageCall.id === 'string') {
    return messageCall.id;
  }

  // Path 2: call.id (alternative structure)
  const call = webhookBody.call as Record<string, unknown>;
  if (call?.id && typeof call.id === 'string') {
    return call.id;
  }

  // Path 3: callId directly
  if (webhookBody.callId && typeof webhookBody.callId === 'string') {
    return webhookBody.callId;
  }

  // Path 4: From tool call metadata
  const toolCalls = webhookBody.toolCalls as Array<Record<string, unknown>>;
  if (toolCalls?.[0]) {
    // Some VAPI versions include call info in tool call
    const toolCall = toolCalls[0];
    if (toolCall.callId && typeof toolCall.callId === 'string') {
      return toolCall.callId;
    }
  }

  // Fallback: Generate from timestamp + random (not ideal but works)
  // This will be unique per request but won't persist across the call
  // We'll log a warning so we know this is happening
  console.warn('⚠️ [PushbackTracker] Could not extract call ID from webhook body, using fallback');
  return null;
}
