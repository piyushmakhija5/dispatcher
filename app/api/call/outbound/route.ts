/**
 * POST /api/call/outbound
 *
 * Initiates an outbound phone call via VAPI + Twilio.
 * Used when voice transport is set to 'phone' mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVapiOutboundConfig } from '@/lib/voice-transport';
import type { VapiOutboundCallResponse } from '@/types/vapi';

// VAPI API endpoint for outbound calls
const VAPI_API_URL = 'https://api.vapi.ai/call';

export interface OutboundCallRequest {
  /** Dynamic variables to pass to the VAPI assistant */
  variableValues: Record<string, string>;
  /** Optional: Override the warehouse phone number (for testing) */
  phoneNumberOverride?: string;
  /** Optional: Override the tool server URL (for ngrok/tunnel setups) */
  toolServerUrl?: string;
}

export interface OutboundCallSuccessResponse {
  success: true;
  callId: string;
  status: string;
  phoneNumber: string;
  message: string;
}

export interface OutboundCallErrorResponse {
  success: false;
  error: string;
  details?: string;
}

export type OutboundCallResponse = OutboundCallSuccessResponse | OutboundCallErrorResponse;

export async function POST(request: NextRequest): Promise<NextResponse<OutboundCallResponse>> {
  console.log('[Outbound Call] Received request to initiate call');

  try {
    // Get VAPI configuration
    const config = getVapiOutboundConfig();
    if (!config) {
      console.error('[Outbound Call] Missing required configuration');
      return NextResponse.json(
        {
          success: false,
          error: 'Phone transport not configured',
          details: 'Missing VAPI_PRIVATE_KEY, VAPI_PHONE_NUMBER_ID, or WAREHOUSE_PHONE_NUMBER',
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body: OutboundCallRequest = await request.json();
    const { variableValues, phoneNumberOverride, toolServerUrl } = body;

    // Determine phone number to call
    const phoneNumber = phoneNumberOverride || config.warehousePhone;
    console.log(`[Outbound Call] Calling ${phoneNumber.slice(0, 6)}...${phoneNumber.slice(-4)}`);
    console.log('[Outbound Call] Variable values:', variableValues);

    // Get tool server URL from request, env var, or leave undefined (uses VAPI assistant default)
    const effectiveToolServerUrl = toolServerUrl || process.env.VAPI_TOOL_SERVER_URL;
    if (effectiveToolServerUrl) {
      console.log('[Outbound Call] Tool server URL override:', effectiveToolServerUrl);
    } else {
      console.warn('[Outbound Call] ⚠️ No tool server URL - using VAPI assistant default (may be stale ngrok)');
    }

    // Build VAPI API request with tool server override if provided
    // The server override ensures the check_slot_cost tool points to the current server
    interface VapiAssistantOverrides {
      variableValues: Record<string, string>;
      server?: {
        url: string;
        secret?: string;
      };
    }

    const assistantOverrides: VapiAssistantOverrides = {
      variableValues: variableValues,
    };

    // Add tool server override if URL is provided
    // This overrides the default server URL for ALL tools in the assistant
    if (effectiveToolServerUrl) {
      assistantOverrides.server = {
        url: effectiveToolServerUrl,
        secret: process.env.VAPI_WEBHOOK_SECRET,
      };
    }

    const vapiRequest = {
      assistantId: config.assistantId,
      phoneNumberId: config.phoneNumberId,
      customer: {
        number: phoneNumber,
      },
      assistantOverrides,
    };

    console.log('[Outbound Call] Sending request to VAPI:', {
      assistantId: config.assistantId,
      phoneNumberId: config.phoneNumberId,
      customerNumber: phoneNumber.slice(0, 6) + '...',
    });

    // Call VAPI API to initiate outbound call
    const vapiResponse = await fetch(VAPI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vapiRequest),
    });

    // Handle VAPI API response
    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      console.error('[Outbound Call] VAPI API error:', vapiResponse.status);
      console.error('[Outbound Call] Error body:', errorText);
      console.error('[Outbound Call] Request was:', JSON.stringify(vapiRequest, null, 2));
      return NextResponse.json(
        {
          success: false,
          error: `VAPI API error: ${vapiResponse.status}`,
          details: errorText,
        },
        { status: vapiResponse.status }
      );
    }

    const vapiData: VapiOutboundCallResponse = await vapiResponse.json();
    console.log('[Outbound Call] VAPI response:', {
      callId: vapiData.id,
      status: vapiData.status,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      callId: vapiData.id,
      status: vapiData.status,
      phoneNumber: phoneNumber,
      message: `Call initiated to ${phoneNumber}`,
    });

  } catch (error) {
    console.error('[Outbound Call] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate call',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET(): Promise<NextResponse> {
  const config = getVapiOutboundConfig();
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/call/outbound',
    configured: !!config,
    capabilities: ['POST - Initiate outbound call'],
  });
}
