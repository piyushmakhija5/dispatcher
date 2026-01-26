/**
 * GET /api/call/[callId]/messages
 *
 * Fetches transcript messages for a call.
 * Used by clients polling for real-time transcripts during phone calls.
 *
 * Query params:
 * - after: Message ID to get messages after (for incremental updates)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTranscriptMessages,
  getCallStatus,
  isLastMessageComplete,
  type TranscriptMessage,
} from '@/lib/call-transcript-store';

export interface MessagesResponse {
  success: true;
  callId: string;
  callStatus: 'active' | 'ended' | 'unknown';
  messages: TranscriptMessage[];
  lastMessageId: string | null;
  lastMessageComplete: boolean;
}

export interface MessagesErrorResponse {
  success: false;
  error: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
): Promise<NextResponse<MessagesResponse | MessagesErrorResponse>> {
  const { callId } = await params;
  const { searchParams } = new URL(request.url);
  const afterMessageId = searchParams.get('after') || undefined;

  console.log(`[Messages] Fetching messages for call ${callId}${afterMessageId ? ` after ${afterMessageId}` : ''}`);

  try {
    const messages = getTranscriptMessages(callId, afterMessageId);
    const callStatus = getCallStatus(callId);
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
    const lastMessageComplete = isLastMessageComplete(callId);

    console.log(`[Messages] Returning ${messages.length} messages for call ${callId}, status: ${callStatus}, lastComplete: ${lastMessageComplete}`);

    return NextResponse.json({
      success: true,
      callId,
      callStatus,
      messages,
      lastMessageId,
      lastMessageComplete,
    });
  } catch (error) {
    console.error('[Messages] Error fetching messages:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
