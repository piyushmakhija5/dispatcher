/**
 * Root API route handler
 *
 * This catches VAPI webhook events that are sent to the root URL (/)
 * when using server.url override for tool calls.
 *
 * VAPI sends both tool calls and general webhook events (conversation-update,
 * speech-update, etc.) to the server.url. When we override server.url for
 * ngrok/tunnel setups, these events hit the root instead of /api/vapi/webhook.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  addTranscriptMessage,
  markCallEnded,
  clearTranscriptMessages,
  markLastMessageComplete,
  getMessageCount,
  setLastMessageComplete,
  isLastMessageComplete,
} from '@/lib/call-transcript-store';

// VAPI artifact message format
interface VapiArtifactMessage {
  role: 'assistant' | 'user' | 'system' | 'bot' | 'tool_call' | 'tool_result';
  message?: string;
  content?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();

    // Check if this is a VAPI webhook event
    const messageObj = payload.message as Record<string, unknown> | undefined;
    const messageCall = messageObj?.call as Record<string, unknown> | undefined;
    const callId = payload.call?.id || messageCall?.id || payload.callId;

    const messageType = messageObj?.type as string | undefined;
    const eventType = messageType || payload.type;

    console.log(`[Root Webhook] ====== INCOMING REQUEST ======`);
    console.log(`[Root Webhook] Event type: ${eventType || 'unknown'}`);
    console.log(`[Root Webhook] Call ID: ${callId || 'unknown'}`);

    // If we have an event type, this is a VAPI webhook - process it
    if (eventType && callId) {
      // Handle conversation-update (transcript messages)
      if (eventType === 'conversation-update') {
        return handleConversationUpdate(payload, callId, messageObj);
      }

      // Handle speech-update (for lastMessageComplete tracking)
      if (eventType === 'speech-update') {
        return handleSpeechUpdate(payload, callId, messageObj);
      }

      // Handle status-update
      if (eventType === 'status-update') {
        const status = messageObj?.status as string | undefined;
        console.log(`[Root Webhook] Status update: ${status}`);
        if (status === 'ended') {
          markCallEnded(callId);
        }
        return NextResponse.json({ success: true });
      }

      // Handle end-of-call-report
      if (eventType === 'end-of-call-report') {
        const endedReason = messageObj?.endedReason as string | undefined;
        console.log(`[Root Webhook] Call ended: ${endedReason}`);

        // Rebuild transcript from final messages if available
        const artifact = messageObj?.artifact as { messages?: VapiArtifactMessage[] } | undefined;
        if (artifact?.messages?.length) {
          console.log(`[Root Webhook] End-of-call: rebuilding transcript with ${artifact.messages.length} messages`);
          clearTranscriptMessages(callId);
          for (const msg of artifact.messages) {
            const msgContent = msg.message || msg.content;
            // VAPI uses 'bot' role for assistant messages
            if (msgContent && (msg.role === 'assistant' || msg.role === 'bot' || msg.role === 'user')) {
              const normalizedRole = (msg.role === 'assistant' || msg.role === 'bot') ? 'assistant' : 'user';
              addTranscriptMessage(
                callId,
                normalizedRole,
                msgContent
              );
            }
          }
          console.log(`[Root Webhook] ✅ Transcript rebuilt from end-of-call-report`);
        }

        markCallEnded(callId);
        return NextResponse.json({ success: true });
      }

      // Other events - just acknowledge
      console.log(`[Root Webhook] Acknowledged event: ${eventType}`);
      return NextResponse.json({ success: true });
    }

    // Not a VAPI webhook event - log and acknowledge
    console.log(`[Root Webhook] Non-webhook request received`);
    return NextResponse.json({ success: true, message: 'Not a recognized webhook event' });

  } catch (error) {
    console.error('[Root Webhook] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

function handleConversationUpdate(
  payload: Record<string, unknown>,
  callId: string,
  messageObj: Record<string, unknown> | undefined
): NextResponse {
  // Get messages from artifact
  const artifact = messageObj?.artifact as { messages?: VapiArtifactMessage[] } | undefined;
  const messages = artifact?.messages || [];

  const previousCount = getMessageCount(callId);
  console.log(`[Root Webhook] conversation-update: ${messages.length} messages (was ${previousCount}), replacing all`);

  // Track if lastMessageComplete was true before clearing
  const wasComplete = isLastMessageComplete(callId);

  // Clear and rebuild with latest authoritative state
  clearTranscriptMessages(callId);

  // Track if we added any messages
  let addedCount = 0;

  for (const msg of messages) {
    const msgContent = msg.message || msg.content;
    if (!msgContent) continue;

    // Only process assistant/bot and user messages (skip system, tool_call, tool_result)
    // VAPI uses 'bot' role for assistant messages
    if (msg.role === 'assistant' || msg.role === 'bot' || msg.role === 'user') {
      const normalizedRole = (msg.role === 'assistant' || msg.role === 'bot') ? 'assistant' : 'user';
      addTranscriptMessage(
        callId,
        normalizedRole,
        msgContent
      );
      addedCount++;
      console.log(`[Root Webhook] Added ${normalizedRole} message (was ${msg.role}): "${msgContent.substring(0, 50)}..."`);
    }
  }

  // If the message count didn't change, preserve lastMessageComplete state
  const newCount = getMessageCount(callId);
  if (newCount === previousCount && wasComplete) {
    console.log(`[Root Webhook] Preserving lastMessageComplete=true (no new messages added)`);
    setLastMessageComplete(callId, true);
  }

  console.log(`[Root Webhook] ✅ Replaced transcript with ${newCount} messages`);
  return NextResponse.json({ success: true });
}

function handleSpeechUpdate(
  payload: Record<string, unknown>,
  callId: string,
  messageObj: Record<string, unknown> | undefined
): NextResponse {
  const status = messageObj?.status as string | undefined;
  console.log(`[Root Webhook] Speech update: status=${status}`);

  if (status === 'stopped') {
    markLastMessageComplete(callId);
    console.log(`[Root Webhook] Marked last message as complete for call ${callId}`);
  }

  return NextResponse.json({ success: true });
}
