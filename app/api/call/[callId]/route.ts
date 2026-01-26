/**
 * GET /api/call/[callId] - Get call status
 * DELETE /api/call/[callId] - End/hang up the call
 *
 * Used to monitor and control outbound phone calls via VAPI.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { VapiCallStatusResponse, TwilioCallStatus, TwilioCallEndReason } from '@/types/vapi';

// VAPI API base URL
const VAPI_API_BASE = 'https://api.vapi.ai/call';

// =============================================================================
// GET - Get Call Status
// =============================================================================

export interface CallStatusSuccessResponse {
  success: true;
  callId: string;
  status: TwilioCallStatus | 'unknown';
  startedAt: string | null;
  endedAt: string | null;
  endReason: TwilioCallEndReason | null;
  transcript: string | null;
}

export interface CallStatusErrorResponse {
  success: false;
  error: string;
  details?: string;
}

export type CallStatusResponse = CallStatusSuccessResponse | CallStatusErrorResponse;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
): Promise<NextResponse<CallStatusResponse>> {
  const { callId } = await params;

  console.log(`[Call Status] Getting status for call: ${callId}`);

  try {
    const privateKey = process.env.VAPI_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { success: false, error: 'VAPI_PRIVATE_KEY not configured' },
        { status: 500 }
      );
    }

    // Call VAPI API to get call status
    const response = await fetch(`${VAPI_API_BASE}/${callId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${privateKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Call Status] VAPI API error: ${response.status}`, errorText);

      // If 404, call might have ended and been cleaned up
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          callId,
          status: 'ended',
          startedAt: null,
          endedAt: null,
          endReason: null,
          transcript: null,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: `VAPI API error: ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data: VapiCallStatusResponse = await response.json();
    console.log(`[Call Status] Call ${callId} status: ${data.status}`);

    return NextResponse.json({
      success: true,
      callId: data.id,
      status: data.status,
      startedAt: data.startedAt || null,
      endedAt: data.endedAt || null,
      endReason: data.endedReason || null,
      transcript: data.transcript || null,
    });

  } catch (error) {
    console.error('[Call Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get call status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - End Call
// =============================================================================

export interface EndCallSuccessResponse {
  success: true;
  callId: string;
  message: string;
}

export interface EndCallErrorResponse {
  success: false;
  error: string;
  details?: string;
}

export type EndCallResponse = EndCallSuccessResponse | EndCallErrorResponse;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
): Promise<NextResponse<EndCallResponse>> {
  const { callId } = await params;

  console.log(`[End Call] Ending call: ${callId}`);

  try {
    const privateKey = process.env.VAPI_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { success: false, error: 'VAPI_PRIVATE_KEY not configured' },
        { status: 500 }
      );
    }

    // Call VAPI API to end the call
    const response = await fetch(`${VAPI_API_BASE}/${callId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${privateKey}`,
      },
    });

    // 200 OK or 404 Not Found both mean the call is ended
    if (response.ok || response.status === 404) {
      console.log(`[End Call] Call ${callId} ended successfully`);
      return NextResponse.json({
        success: true,
        callId,
        message: 'Call ended',
      });
    }

    const errorText = await response.text();
    console.error(`[End Call] VAPI API error: ${response.status}`, errorText);

    return NextResponse.json(
      {
        success: false,
        error: `VAPI API error: ${response.status}`,
        details: errorText,
      },
      { status: response.status }
    );

  } catch (error) {
    console.error('[End Call] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to end call',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
