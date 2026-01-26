/**
 * POST /api/vapi/webhook
 *
 * Receives webhook events from VAPI for phone calls.
 * Stores transcripts for client polling.
 *
 * VAPI must be configured to send events to this endpoint:
 * 1. Go to VAPI Dashboard → Assistants → Your Assistant
 * 2. Set Server URL to your app URL (e.g., https://your-ngrok-url.ngrok.io)
 * 3. VAPI will send events to {serverUrl}/api/vapi/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  addTranscriptMessage,
  initializeTranscript,
  markCallEnded,
  clearTranscriptMessages,
  markLastMessageComplete,
  getMessageCount,
  setLastMessageComplete,
  isLastMessageComplete,
} from '@/lib/call-transcript-store';

// VAPI Server Message types (nested in message object)
type VapiMessageType =
  | 'assistant-request'
  | 'conversation-update'
  | 'end-of-call-report'
  | 'speech-update'
  | 'transcript'
  | 'tool-calls'
  | 'transfer-destination-request'
  | 'status-update';

// VAPI artifact message format (what they actually send)
interface VapiArtifactMessage {
  role: 'assistant' | 'user' | 'system' | 'bot' | 'tool_call' | 'tool_result';
  message?: string;
  content?: string;
  // Other fields we don't need
}

interface VapiWebhookPayload {
  // VAPI nests the event in a 'message' object
  message?: {
    type: VapiMessageType;
    // For transcript events
    transcript?: string;
    transcriptType?: 'partial' | 'final';
    role?: 'assistant' | 'user' | 'system';
    // For conversation-update - actual messages are in artifact.messages
    artifact?: {
      messages?: VapiArtifactMessage[];
    };
    // Legacy format
    conversation?: Array<{
      role: 'assistant' | 'user' | 'system';
      content: string;
    }>;
    // For status-update
    status?: string;
    // For end-of-call-report
    endedReason?: string;
    summary?: string;
  };
  // Call info is at root level
  call?: {
    id: string;
    status?: string;
    type?: string;
  };
  // Some events have type at root level (older format)
  type?: string;
  // Generic catch-all
  [key: string]: unknown;
}


export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await request.json();

    // VAPI can send call ID in multiple places depending on event type
    // Try: payload.call.id, payload.message.call.id, or root-level callId
    const messageObj = payload.message as Record<string, unknown> | undefined;
    const messageCall = messageObj?.call as Record<string, unknown> | undefined;
    const callId = payload.call?.id ||
                   messageCall?.id ||
                   payload.callId;

    // VAPI uses nested message.type for most events
    const messageType = messageObj?.type as string | undefined;
    // Fallback to root type for older format
    const eventType = messageType || payload.type;

    console.log(`[VAPI Webhook] ====== RECEIVED EVENT ======`);
    console.log(`[VAPI Webhook] Event type: ${eventType}`);
    console.log(`[VAPI Webhook] Call ID: ${callId}`);
    console.log(`[VAPI Webhook] Payload keys:`, Object.keys(payload));

    if (!callId) {
      console.log('[VAPI Webhook] No call ID found, checking payload structure...');
      console.log('[VAPI Webhook] payload.call:', payload.call);
      console.log('[VAPI Webhook] payload.message?.call:', messageCall);
      // Don't skip - try to process anyway for debugging
    }

    // Handle different event types
    switch (eventType) {
      case 'status-update': {
        const status = (messageObj?.status as string) || payload.call?.status;
        console.log(`[VAPI Webhook] Status update: ${status}`);
        if (callId) {
          if (status === 'in-progress') {
            initializeTranscript(callId);
          } else if (status === 'ended') {
            markCallEnded(callId);
          }
        }
        break;
      }

      case 'transcript': {
        // Real-time transcript updates
        const transcript = payload.message?.transcript;
        const transcriptType = payload.message?.transcriptType;
        const role = payload.message?.role;

        console.log(`[VAPI Webhook] Transcript: type=${transcriptType}, role=${role}, text="${transcript?.substring(0, 50)}..."`);

        if (transcript && transcriptType === 'final' && role) {
          const mappedRole = role === 'assistant' ? 'assistant' : 'user';
          addTranscriptMessage(callId, mappedRole, transcript);
          console.log(`[VAPI Webhook] ✅ Added transcript message: ${mappedRole}`);
        }
        break;
      }

      case 'conversation-update': {
        // VAPI sends ALL messages with their current state on each update
        // Messages get longer as speech continues, so we need to REPLACE, not append
        const artifactMessages = (messageObj?.artifact as { messages?: VapiArtifactMessage[] })?.messages;
        const conversationMessages = messageObj?.conversation as VapiArtifactMessage[] | undefined;
        const messages = artifactMessages || conversationMessages;

        if (messages && messages.length > 0 && callId) {
          // Track state BEFORE clearing
          const previousMessageCount = getMessageCount(callId);
          const wasLastMessageComplete = isLastMessageComplete(callId);

          console.log(`[VAPI Webhook] conversation-update: ${messages.length} messages (was ${previousMessageCount}), replacing all`);

          // Clear and rebuild with latest state (messages may have been updated/extended)
          clearTranscriptMessages(callId);

          let addedCount = 0;
          for (const msg of messages) {
            const text = msg.message || msg.content || (msg as unknown as { text?: string }).text;
            if (!text) continue;

            const role = msg.role || (msg as unknown as { type?: string }).type;
            if (role === 'assistant' || role === 'bot') {
              addTranscriptMessage(callId, 'assistant', text);
              addedCount++;
            } else if (role === 'user') {
              addTranscriptMessage(callId, 'user', text);
              addedCount++;
            }
          }

          // If no new messages were added (just content updates), preserve lastMessageComplete
          // This prevents losing the "speech stopped" signal during rebuilds
          if (addedCount <= previousMessageCount && wasLastMessageComplete) {
            console.log(`[VAPI Webhook] Preserving lastMessageComplete=true (no new messages added)`);
            setLastMessageComplete(callId, true);
          }

          console.log(`[VAPI Webhook] ✅ Replaced transcript with ${addedCount} messages`);
        }
        break;
      }

      case 'end-of-call-report': {
        console.log(`[VAPI Webhook] Call ended: ${payload.message?.endedReason}`);

        if (callId) {
          // end-of-call-report is the authoritative final transcript
          // Clear and rebuild from it (has complete messages, not truncated)
          const artifactMessages = (messageObj?.artifact as { messages?: VapiArtifactMessage[] })?.messages;

          if (artifactMessages && artifactMessages.length > 0) {
            console.log(`[VAPI Webhook] End-of-call: rebuilding transcript with ${artifactMessages.length} messages`);

            // Clear existing (may have truncated versions from conversation-update)
            clearTranscriptMessages(callId);

            // Rebuild from authoritative source
            for (const msg of artifactMessages) {
              const text = msg.message || msg.content;
              if (!text) continue;

              if (msg.role === 'assistant' || msg.role === 'bot') {
                addTranscriptMessage(callId, 'assistant', text);
              } else if (msg.role === 'user') {
                addTranscriptMessage(callId, 'user', text);
              }
            }

            console.log(`[VAPI Webhook] ✅ Transcript rebuilt from end-of-call-report`);
          }

          markCallEnded(callId);
        }
        break;
      }

      case 'speech-update': {
        const speechStatus = (messageObj?.status as string) || '';
        console.log(`[VAPI Webhook] Speech update: status=${speechStatus}`);

        // When speaker stops, mark the last message as complete
        if (speechStatus === 'stopped' && callId) {
          markLastMessageComplete(callId);
          console.log(`[VAPI Webhook] Marked last message as complete for call ${callId}`);
        }
        break;
      }

      case 'tool-calls':
        console.log(`[VAPI Webhook] Tool calls - handled by check-slot-cost endpoint`);
        break;

      // Legacy/fallback event types (root level type)
      case 'call-start':
        initializeTranscript(callId);
        break;

      case 'call-end':
      case 'hang':
        markCallEnded(callId);
        break;

      default:
        console.log(`[VAPI Webhook] Unhandled event type: ${eventType}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[VAPI Webhook] Error processing webhook:', error);
    // Still return 200 to prevent VAPI from retrying
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}

// Health check
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/vapi/webhook',
    description: 'VAPI webhook endpoint for call events and transcripts',
  });
}
