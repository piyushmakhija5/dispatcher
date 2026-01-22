import { NextRequest, NextResponse } from 'next/server';
import { calculateTotalCostImpact, convertExtractedTermsToRules } from '@/lib/cost-engine';
import { parseTimeToMinutes, minutesToTime12Hour, minutesToTime, roundTimeToFiveMinutes } from '@/lib/time-parser';
import { createNegotiationStrategy } from '@/lib/negotiation-strategy';
import type { Retailer } from '@/types/dispatch';
import type { ExtractedContractTerms } from '@/types/contract';

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
      /** JSON string of extracted contract terms (optional) */
      extractedTermsJson?: string;
    };
  };
}

interface VapiToolResult {
  toolCallId: string;
  result: {
    acceptable: boolean;
    parsedOfferedTime: string | null;
    minutesFromOriginal: number | null;
    internalReason: string;
    suggestedCounterOffer: string | null;
    costBreakdown?: {
      dwellCost: number;
      otifPenalty: number;
      totalCost: number;
      isLate: boolean;
    };
  };
}

// VAPI webhook handler for cost analysis
export async function POST(request: NextRequest) {
  console.log('🔧 check-slot-cost webhook called');
  
  try {
    // Verify webhook secret if configured
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = request.headers.get('x-tool-secret');
      if (providedSecret !== webhookSecret) {
        console.log('❌ Webhook unauthorized - secret mismatch');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    console.log('📥 Webhook body:', JSON.stringify(body, null, 2));

    // Handle VAPI function call format
    const toolCalls: VapiToolCall[] = body.toolCalls || body.message?.toolCalls || [];

    const results: VapiToolResult[] = toolCalls.map((call) => {
      const args = call.function.arguments;

      const originalMinutes = parseTimeToMinutes(args.originalAppointment);
      const offeredMinutes = parseTimeToMinutes(args.offeredTimeText);

      if (originalMinutes === null || offeredMinutes === null) {
        return {
          toolCallId: call.id,
          result: {
            acceptable: false,
            parsedOfferedTime: null,
            minutesFromOriginal: null,
            internalReason: 'Could not parse time values',
            suggestedCounterOffer: null,
          },
        };
      }

      const deltaMinutes = offeredMinutes - originalMinutes;

      // Parse extracted contract terms if provided
      let extractedTerms: ExtractedContractTerms | undefined = undefined;
      if (args.extractedTermsJson) {
        try {
          extractedTerms = JSON.parse(args.extractedTermsJson);
          console.log('📋 Using extracted contract terms for cost calculation');
        } catch (e) {
          console.warn('⚠️ Failed to parse extractedTermsJson:', e);
        }
      }

      // Convert extracted terms to rules (or empty rules if not provided)
      // NOTE: No fake "default" rules - missing terms = $0 cost for that category
      const contractRules = convertExtractedTermsToRules(extractedTerms);
      
      if (extractedTerms) {
        console.log('📊 Cost calculation using extracted contract terms');
      } else {
        console.log('📊 No contract terms provided - costs based on empty rules (missing sections = $0)');
      }

      // Use shared cost engine with the appropriate rules
      const costImpact = calculateTotalCostImpact(
        {
          originalAppointmentTime: args.originalAppointment,
          newAppointmentTime: args.offeredTimeText,
          shipmentValue: args.shipmentValue,
          retailer: args.retailer as Retailer,
        },
        contractRules
      );

      const totalCost = costImpact.totalCost;
      const dwellCost = costImpact.calculations.dwellTime?.total ?? 0;
      const otifPenalty = costImpact.calculations.otif?.total ?? 0;
      const isLate = costImpact.calculations.otif?.outsideWindow ?? false;

      // =======================================================================
      // DECISION LOGIC - Uses same strategy as text mode!
      // GENERIC: Calculates thresholds from actual costs, not hardcoded for OTIF
      // Uses extracted contract terms when available for consistent calculations
      // =======================================================================

      // Create strategy using the same function as text mode
      // This calculates thresholds by computing actual costs at key time points
      const strategy = createNegotiationStrategy({
        originalAppointment: args.originalAppointment,
        delayMinutes: args.delayMinutes,
        shipmentValue: args.shipmentValue,
        retailer: args.retailer as Retailer,
        contractRules: contractRules, // Use extracted terms or defaults
      });

      const { costThresholds, thresholds } = strategy;

      let acceptable = false;
      let suggestedCounterOffer: string | null = null;
      let reason = '';

      // IDEAL: Within compliance window and cost at/below ideal threshold
      if (offeredMinutes <= thresholds.ideal.maxMinutes && totalCost <= costThresholds.ideal) {
        acceptable = true;
        reason = totalCost === 0
          ? `IDEAL - No cost impact`
          : `IDEAL - Minimal cost ($${totalCost})`;
      }
      // ACCEPTABLE: Within acceptable time window and cost at/below acceptable threshold
      else if (offeredMinutes <= thresholds.acceptable.maxMinutes && totalCost <= costThresholds.acceptable) {
        acceptable = true;
        reason = `ACCEPTABLE - Cost ($${totalCost}) within threshold ($${costThresholds.acceptable})`;
      }
      // SUBOPTIMAL: Time is past acceptable deadline OR cost exceeds reluctant threshold
      else if (offeredMinutes > thresholds.acceptable.maxMinutes || totalCost > costThresholds.reluctant) {
        acceptable = false;
        // Suggest the ideal time as counter-offer, rounded UP to 5-minute intervals
        // e.g., 18:03 → 18:05, 18:07 → 18:10 (more natural for speech)
        const idealTime24h = minutesToTime(thresholds.ideal.maxMinutes);
        const roundedIdealTime24h = roundTimeToFiveMinutes(idealTime24h);
        const roundedIdealMinutes = parseTimeToMinutes(roundedIdealTime24h) || thresholds.ideal.maxMinutes;
        suggestedCounterOffer = minutesToTime12Hour(roundedIdealMinutes);
        const timeReason = offeredMinutes > thresholds.acceptable.maxMinutes ? 'Time too late' : 'Cost too high';
        reason = `SUBOPTIMAL - ${timeReason}. Counter: ${suggestedCounterOffer}`;
      }
      // Default: Within acceptable range
      else {
        acceptable = true;
        reason = `OK - Cost ($${totalCost}) within tolerance`;
      }

      return {
        toolCallId: call.id,
        result: {
          acceptable,
          parsedOfferedTime: minutesToTime12Hour(offeredMinutes),
          minutesFromOriginal: deltaMinutes,
          internalReason: reason,
          suggestedCounterOffer,
          costBreakdown: {
            dwellCost,
            otifPenalty,
            totalCost,
            isLate,
          },
        },
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
