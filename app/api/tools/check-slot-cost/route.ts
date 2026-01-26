import { NextRequest, NextResponse } from 'next/server';
import { analyzeTimeOffer, type OfferAnalysisResult, type PreComputedStrategy } from '@/lib/vapi-offer-analyzer';
import { extractCallId, getPushbackCount, incrementPushbackCount } from '@/lib/pushback-tracker';
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
      strategyJson?: string;
      hosEnabled?: boolean;
      currentTime?: string;
      driverHOSJson?: string;
      driverDetentionRate?: number;
      offeredDayOffset?: number;
      /** Current pushback count - VAPI tracks this internally */
      pushbackCount?: number;
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

    // Debug: Log top-level keys to understand VAPI's structure
    console.log('🔍 Top-level keys:', Object.keys(body));
    if (body.message) {
      console.log('🔍 message keys:', Object.keys(body.message));
      if (body.message.call) {
        console.log('🔍 message.call:', JSON.stringify(body.message.call, null, 2));
      }
    }
    if (body.call) {
      console.log('🔍 body.call:', JSON.stringify(body.call, null, 2));
    }

    // Extract call ID for pushback tracking
    const callId = extractCallId(body as Record<string, unknown>);
    console.log(`📞 Call ID: ${callId || 'unknown (extraction failed)'}`);

    // Get current pushback count for this call (server-side tracking)
    const trackedPushbackCount = callId ? getPushbackCount(callId) : 0;
    console.log(`📊 Server-tracked pushback count: ${trackedPushbackCount}`);

    // Handle VAPI function call format
    const toolCalls: VapiToolCall[] = body.toolCalls || body.message?.toolCalls || [];

    const results: VapiToolResult[] = toolCalls.map((call) => {
      // VAPI may send arguments as a JSON string OR as a parsed object
      // We need to handle both cases
      let args: VapiToolCall['function']['arguments'];
      const rawArgs = call.function.arguments;

      console.log('🔍 Raw arguments type:', typeof rawArgs);
      console.log('🔍 Raw arguments:', JSON.stringify(rawArgs, null, 2));

      if (typeof rawArgs === 'string') {
        try {
          args = JSON.parse(rawArgs);
          console.log('📦 Parsed arguments from string');
        } catch (e) {
          console.error('❌ Failed to parse arguments string:', e);
          args = {} as VapiToolCall['function']['arguments'];
        }
      } else {
        args = rawArgs || {} as VapiToolCall['function']['arguments'];
      }

      console.log('📋 Final args:', JSON.stringify(args, null, 2));

      // FALLBACK: If args are empty, try to extract from VAPI context
      if (!args.offeredTimeText || !args.originalAppointment) {
        console.log('⚠️ Arguments missing, attempting to extract from VAPI context...');

        // Get variable values from assistant overrides
        const variableValues = body.call?.assistantOverrides?.variableValues ||
                               body.message?.call?.assistantOverrides?.variableValues || {};

        // Get conversation to find the last user message (the offered time)
        const conversation = body.message?.artifact?.messages ||
                             body.message?.conversation ||
                             body.artifact?.messages || [];

        // Find last user message that looks like a time offer
        const userMessages = conversation
          .filter((m: { role: string }) => m.role === 'user')
          .map((m: { message?: string; content?: string }) => m.message || m.content || '');

        const lastUserMessage = userMessages[userMessages.length - 1] || '';

        console.log('📝 Last user message:', lastUserMessage);
        console.log('📝 Variable values available:', Object.keys(variableValues));

        // Fill in missing args from context
        if (!args.offeredTimeText && lastUserMessage) {
          args.offeredTimeText = lastUserMessage;
          console.log('✅ Extracted offeredTimeText from conversation:', args.offeredTimeText);
        }
        if (!args.originalAppointment && variableValues.original_24h) {
          args.originalAppointment = variableValues.original_24h;
          console.log('✅ Extracted originalAppointment from variables:', args.originalAppointment);
        }
        if (!args.delayMinutes && variableValues.delay_minutes) {
          args.delayMinutes = Number(variableValues.delay_minutes);
          console.log('✅ Extracted delayMinutes from variables:', args.delayMinutes);
        }
        if (!args.shipmentValue && variableValues.shipment_value) {
          args.shipmentValue = Number(variableValues.shipment_value);
          console.log('✅ Extracted shipmentValue from variables:', args.shipmentValue);
        }
        if (!args.retailer && variableValues.retailer) {
          args.retailer = variableValues.retailer;
          console.log('✅ Extracted retailer from variables:', args.retailer);
        }
        if (!args.extractedTermsJson && variableValues.extracted_terms_json) {
          args.extractedTermsJson = variableValues.extracted_terms_json;
          console.log('✅ Extracted contract terms from variables');
        }
        if (!args.strategyJson && variableValues.strategy_json) {
          args.strategyJson = variableValues.strategy_json;
          console.log('✅ Extracted strategy from variables');
        }
        // CRITICAL: Extract HOS parameters (hosEnabled and driverHOSJson)
        // Without these, HOS constraints won't be considered in negotiation
        if (args.hosEnabled === undefined && variableValues.hos_enabled) {
          args.hosEnabled = variableValues.hos_enabled === 'true' || variableValues.hos_enabled === true;
          console.log('✅ Extracted hosEnabled from variables:', args.hosEnabled);
        }
        if (!args.driverHOSJson && variableValues.driver_hos_json) {
          args.driverHOSJson = variableValues.driver_hos_json;
          console.log('✅ Extracted driverHOSJson from variables');
        }
        if (args.offeredDayOffset === undefined) {
          // Default to today if not specified
          args.offeredDayOffset = 0;
          // Check if the message mentions tomorrow
          if (lastUserMessage.toLowerCase().includes('tomorrow') ||
              lastUserMessage.toLowerCase().includes('tmrw') ||
              lastUserMessage.toLowerCase().includes('next day')) {
            args.offeredDayOffset = 1;
          }
          console.log('✅ Set offeredDayOffset:', args.offeredDayOffset);
        }
      }

      // Parse JSON arguments
      const extractedTerms = parseJsonArg<ExtractedContractTerms>(args.extractedTermsJson, 'extractedTermsJson');
      const preComputedStrategy = parseJsonArg<PreComputedStrategy>(args.strategyJson, 'strategyJson');

      // Parse and normalize HOS JSON - handles both flat and nested structures
      const rawDriverHOS = args.hosEnabled
        ? parseJsonArg<Record<string, unknown>>(args.driverHOSJson, 'driverHOSJson')
        : undefined;
      const driverHOS = normalizeDriverHOS(rawDriverHOS);

      if (extractedTerms) {
        console.log('📋 Using extracted contract terms for cost calculation');
      } else {
        console.log('📊 No contract terms provided - costs based on empty rules (missing sections = $0)');
      }

      if (preComputedStrategy) {
        console.log('🎯 Using pre-computed strategy from UI (ensures consistency)');
      } else {
        console.log('⚠️ No pre-computed strategy - will calculate fresh (may differ from UI)');
      }

      if (driverHOS) {
        console.log('🕐 HOS enabled, checking driver availability');
      }

      // IMPORTANT: VAPI template variables come as strings, must convert to numbers
      // Without this, "840 + '55'" = "84055" (string concat) instead of 895 (numeric add)
      console.log('🔢 Raw numeric values before conversion:', {
        delayMinutes: args.delayMinutes,
        shipmentValue: args.shipmentValue,
        offeredTimeText: args.offeredTimeText,
        originalAppointment: args.originalAppointment,
      });
      const delayMinutes = Number(args.delayMinutes) || 0;
      const shipmentValue = Number(args.shipmentValue) || 0;
      const driverDetentionRate = args.driverDetentionRate !== undefined
        ? Number(args.driverDetentionRate)
        : undefined;
      const offeredDayOffset = args.offeredDayOffset !== undefined
        ? Number(args.offeredDayOffset)
        : undefined;

      // Use server-tracked pushback count (more reliable than VAPI-passed count)
      const pushbackCount = trackedPushbackCount;

      console.log('📊 Parsed numeric params:', { delayMinutes, shipmentValue, driverDetentionRate, offeredDayOffset, pushbackCount });

      // Analyze the offer using the decision engine
      const result = analyzeTimeOffer({
        offeredTimeText: args.offeredTimeText,
        originalAppointment: args.originalAppointment,
        delayMinutes,
        shipmentValue,
        retailer: args.retailer as Retailer,
        extractedTerms,
        preComputedStrategy,
        hosEnabled: args.hosEnabled,
        currentTime: args.currentTime,
        driverHOS,
        driverDetentionRate,
        offeredDayOffset,
        pushbackCount,
      });

      // If offer is not acceptable, increment pushback count for next time
      // This happens AFTER analysis so the current call uses the current count
      if (!result.acceptable && !result.combinedAcceptable && callId) {
        const newCount = incrementPushbackCount(callId);
        console.log(`📈 Offer rejected, incremented pushback count to ${newCount} for next offer`);
      }

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

/**
 * Normalize HOS JSON to match DriverHOSStatus type
 *
 * The UI may send a flat structure (weekRule at root) but DriverHOSStatus expects
 * nested structure (config.weekRule). This function handles both formats.
 */
function normalizeDriverHOS(parsed: Record<string, unknown> | undefined): DriverHOSStatus | undefined {
  if (!parsed) return undefined;

  // Check if it already has the correct nested structure
  if (parsed.config && typeof parsed.config === 'object') {
    console.log('✅ HOS JSON already has nested config structure');
    return parsed as unknown as DriverHOSStatus;
  }

  // Convert flat structure to nested
  // Flat: { weekRule, shortHaulExempt, remainingDriveMinutes, ... }
  // Nested: { config: { weekRule, shortHaulExempt, ... }, remainingDriveMinutes, ... }
  console.log('🔄 Converting flat HOS structure to nested config structure');

  const normalized: DriverHOSStatus = {
    remainingDriveMinutes: Number(parsed.remainingDriveMinutes) || 0,
    remainingWindowMinutes: Number(parsed.remainingWindowMinutes) || 0,
    remainingWeeklyMinutes: Number(parsed.remainingWeeklyMinutes) || 0,
    minutesSinceLastBreak: Number(parsed.minutesSinceLastBreak) || 0,
    config: {
      weekRule: (parsed.weekRule as '60_in_7' | '70_in_8') || '70_in_8',
      shortHaulExempt: Boolean(parsed.shortHaulExempt),
      canUseSplitSleeper: Boolean(parsed.canUseSplitSleeper),
      allow16HourException: Boolean(parsed.allow16HourException),
    },
  };

  console.log('✅ Normalized HOS:', JSON.stringify(normalized, null, 2));
  return normalized;
}
