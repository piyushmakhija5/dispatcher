import { NextRequest, NextResponse } from 'next/server';
import { analyzeTimeOffer, type OfferAnalysisResult } from '@/lib/vapi-offer-analyzer';
import type { Retailer } from '@/types/dispatch';
import type { ExtractedContractTerms } from '@/types/contract';
import type { DriverHOSStatus } from '@/types/hos';

// ============================================================================
// VAPI Webhook Types
// ============================================================================

interface VapiToolCall {
  id: string;
  function: {
    name: string;
    arguments: {
      offeredTimeText: string;
      originalAppointment: string;
      delayMinutes: number;
      shipmentValue: number;
      retailer: string;
      extractedTermsJson?: string;
      hosEnabled?: boolean;
      currentTime?: string;
      driverHOSJson?: string;
      driverDetentionRate?: number;
      offeredDayOffset?: number;
    };
  };
}

interface VapiToolResult {
  toolCallId: string;
  result: OfferAnalysisResult & {
    // Legacy field names for VAPI compatibility
    costBreakdown?: {
      dwellCost: number;
      otifPenalty: number;
      totalCost: number;
      isLate: boolean;
    };
  };
}

// ============================================================================
// Webhook Handler
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('🔧 check-slot-cost webhook called');

  try {
    // Verify webhook secret if configured
    if (!verifyWebhookSecret(request)) {
      console.log('❌ Webhook unauthorized - secret mismatch');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('📥 Webhook body:', JSON.stringify(body, null, 2));

    // Handle VAPI function call format
    const toolCalls: VapiToolCall[] = body.toolCalls || body.message?.toolCalls || [];

    const results: VapiToolResult[] = toolCalls.map((call) => {
      const args = call.function.arguments;

      // Parse JSON arguments
      const extractedTerms = parseJsonArg<ExtractedContractTerms>(args.extractedTermsJson, 'extractedTermsJson');
      const driverHOS = args.hosEnabled
        ? parseJsonArg<DriverHOSStatus>(args.driverHOSJson, 'driverHOSJson')
        : undefined;

      if (extractedTerms) {
        console.log('📋 Using extracted contract terms for cost calculation');
      } else {
        console.log('📊 No contract terms provided - costs based on empty rules (missing sections = $0)');
      }

      if (driverHOS) {
        console.log('🕐 HOS enabled, checking driver availability');
      }

      // Analyze the offer using the decision engine
      const result = analyzeTimeOffer({
        offeredTimeText: args.offeredTimeText,
        originalAppointment: args.originalAppointment,
        delayMinutes: args.delayMinutes,
        shipmentValue: args.shipmentValue,
        retailer: args.retailer as Retailer,
        extractedTerms,
        hosEnabled: args.hosEnabled,
        currentTime: args.currentTime,
        driverHOS,
        driverDetentionRate: args.driverDetentionRate,
        offeredDayOffset: args.offeredDayOffset,
      });

      return {
        toolCallId: call.id,
        result,
      };
    });

    console.log('📤 Webhook response:', JSON.stringify(results, null, 2));
    return NextResponse.json({ results });
  } catch (error) {
    console.error('❌ Tool webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', tool: 'check-slot-cost' });
}

// ============================================================================
// Helpers
// ============================================================================

function verifyWebhookSecret(request: NextRequest): boolean {
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
  if (!webhookSecret) return true; // No secret configured, allow all

  const providedSecret = request.headers.get('x-tool-secret');
  return providedSecret === webhookSecret;
}

function parseJsonArg<T>(jsonString: string | undefined, argName: string): T | undefined {
  if (!jsonString) return undefined;

  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.warn(`⚠️ Failed to parse ${argName}:`, e);
    return undefined;
  }
}
