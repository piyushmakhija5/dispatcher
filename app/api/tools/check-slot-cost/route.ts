import { NextRequest, NextResponse } from 'next/server';
import { calculateTotalCostImpact, calculateTotalCostImpactMultiDay, convertExtractedTermsToRules } from '@/lib/cost-engine';
import {
  parseTimeToMinutes,
  minutesToTime12Hour,
  minutesToTime,
  roundTimeToFiveMinutes,
  getMultiDayTimeDifference,
  formatTimeWithDayOffset,
} from '@/lib/time-parser';
import { createNegotiationStrategy } from '@/lib/negotiation-strategy';
import { checkHOSFeasibility } from '@/lib/hos-engine';
import { detectDateIndicator } from '@/lib/message-extractors';
import type { Retailer } from '@/types/dispatch';
import type { ExtractedContractTerms } from '@/types/contract';
import type { DriverHOSStatus, HOSBindingConstraint } from '@/types/hos';

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
      /** HOS enabled flag (optional) */
      hosEnabled?: boolean;
      /** Current time for HOS calculations (optional, defaults to now) */
      currentTime?: string;
      /** JSON string of driver HOS status (optional) */
      driverHOSJson?: string;
      /** Driver detention rate per hour for next-shift cost calculations */
      driverDetentionRate?: number;
      /** Day offset of offered time (0 = today, 1 = tomorrow) - Phase 11 */
      offeredDayOffset?: number;
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
    /** HOS-related fields (Phase 10) */
    hosFeasible?: boolean;
    hosBindingConstraint?: HOSBindingConstraint | null;
    hosLatestLegalTime?: string | null;
    hosRequiresNextShift?: boolean;
    /** Combined cost + HOS acceptance */
    combinedAcceptable?: boolean;
    /** Multi-day fields (Phase 11) */
    dayOffset?: number;
    isNextDay?: boolean;
    formattedTime?: string;
    /** Enhanced delay information for VAPI clarity */
    delayHours?: number;
    delayDescription?: string;
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

      // Get day offset from args, or auto-detect from time text (Phase 11)
      // This provides a fallback if VAPI doesn't explicitly pass offeredDayOffset
      let offeredDayOffset = args.offeredDayOffset ?? 0;
      if (offeredDayOffset === 0) {
        // Try to detect "tomorrow" etc. from the offered time text
        const detected = detectDateIndicator(args.offeredTimeText);
        if (detected.dayOffset > 0) {
          offeredDayOffset = detected.dayOffset;
          console.log(`📅 Auto-detected day offset ${offeredDayOffset} from "${args.offeredTimeText}" (${detected.indicator})`);
        }
      }

      // Use multi-day time difference calculation for correct handling
      // of next-day scenarios (e.g., "tomorrow at 6 AM")
      const deltaMinutes = getMultiDayTimeDifference(
        args.originalAppointment,
        args.offeredTimeText,
        offeredDayOffset
      ) ?? (offeredMinutes - originalMinutes);

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
      // Phase 11: Use multi-day calculation when day offset > 0
      const costImpact = offeredDayOffset > 0
        ? calculateTotalCostImpactMultiDay(
            {
              originalAppointmentTime: args.originalAppointment,
              newAppointmentTime: args.offeredTimeText,
              shipmentValue: args.shipmentValue,
              retailer: args.retailer as Retailer,
              offeredDayOffset,
            },
            contractRules
          )
        : calculateTotalCostImpact(
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
      // HOS FEASIBILITY CHECK (Phase 10)
      // Check if driver can legally work at the offered time
      // =======================================================================

      let hosFeasible = true;
      let hosBindingConstraint: HOSBindingConstraint | null = null;
      let hosLatestLegalTime: string | null = null;
      let hosRequiresNextShift = false;

      // Parse driver HOS status if provided
      let driverHOS: DriverHOSStatus | undefined = undefined;
      if (args.hosEnabled && args.driverHOSJson) {
        try {
          driverHOS = JSON.parse(args.driverHOSJson);
          console.log('🕐 HOS enabled, checking driver availability');
        } catch (e) {
          console.warn('⚠️ Failed to parse driverHOSJson:', e);
        }
      }

      // Check HOS feasibility if driver status is provided
      if (driverHOS) {
        const currentTime = args.currentTime || new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        const hosResult = checkHOSFeasibility(
          args.offeredTimeText,
          currentTime,
          driverHOS,
          60, // Estimated dock duration (1 hour)
          args.driverDetentionRate || 50
        );

        hosFeasible = hosResult.feasible;
        hosBindingConstraint = hosResult.bindingConstraint || null;
        hosLatestLegalTime = hosResult.latestLegalDockTime;
        hosRequiresNextShift = hosResult.requiresNextShift;

        console.log(`🕐 HOS feasibility: ${hosFeasible ? 'OK' : 'NOT FEASIBLE'}, binding: ${hosBindingConstraint || 'none'}`);
      }

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

      // For multi-day offers, convert to absolute minutes for comparison
      // e.g., 3 AM tomorrow (dayOffset=1) = 180 + 1440 = 1620 absolute minutes
      const offeredAbsoluteMinutes = offeredMinutes + (offeredDayOffset * 24 * 60);

      // Calculate delay in hours for clear messaging
      const delayHours = Math.round(deltaMinutes / 60 * 10) / 10;
      const delayDays = Math.floor(deltaMinutes / (24 * 60));
      const delayDescription = delayDays >= 1
        ? `${delayDays} day${delayDays > 1 ? 's' : ''} and ${Math.round((deltaMinutes % (24*60)) / 60)} hours later`
        : `${delayHours} hours later`;

      // IDEAL: Within compliance window and cost at/below ideal threshold
      // For same-day: compare clock times. For next-day: any offer is already past deadline
      const withinIdealTime = offeredDayOffset === 0
        ? offeredMinutes <= thresholds.ideal.maxMinutes
        : false; // Next-day offers are never "ideal" time-wise

      const withinAcceptableTime = offeredDayOffset === 0
        ? offeredMinutes <= thresholds.acceptable.maxMinutes
        : false; // Next-day offers are never within acceptable time window

      if (withinIdealTime && totalCost <= costThresholds.ideal) {
        acceptable = true;
        reason = totalCost === 0
          ? `IDEAL - No cost impact`
          : `IDEAL - Minimal cost ($${totalCost})`;
      }
      // ACCEPTABLE: Within acceptable time window and cost at/below acceptable threshold
      else if (withinAcceptableTime && totalCost <= costThresholds.acceptable) {
        acceptable = true;
        reason = `ACCEPTABLE - Cost ($${totalCost}) within threshold ($${costThresholds.acceptable})`;
      }
      // SUBOPTIMAL: Next-day offer OR time is past acceptable deadline OR cost exceeds threshold
      else if (offeredDayOffset > 0 || !withinAcceptableTime || totalCost > costThresholds.reluctant) {
        acceptable = false;
        // Suggest the ideal time as counter-offer, rounded UP to 5-minute intervals
        // e.g., 18:03 → 18:05, 18:07 → 18:10 (more natural for speech)
        const idealTime24h = minutesToTime(thresholds.ideal.maxMinutes);
        const roundedIdealTime24h = roundTimeToFiveMinutes(idealTime24h);
        const roundedIdealMinutes = parseTimeToMinutes(roundedIdealTime24h) || thresholds.ideal.maxMinutes;
        suggestedCounterOffer = minutesToTime12Hour(roundedIdealMinutes);

        // Build clear reason based on why it's suboptimal
        let timeReason: string;
        if (offeredDayOffset > 0) {
          timeReason = `Offered time is ${delayDescription} - significant delay`;
        } else if (!withinAcceptableTime) {
          timeReason = 'Time too late in the day';
        } else {
          timeReason = 'Cost too high';
        }
        reason = `SUBOPTIMAL - ${timeReason}. Total delay: ${deltaMinutes} minutes (${delayDescription}). Counter-offer: ${suggestedCounterOffer} today.`;
      }
      // Default: Within acceptable range
      else {
        acceptable = true;
        reason = `OK - Cost ($${totalCost}) within tolerance`;
      }

      // Combined acceptance: cost acceptable AND HOS feasible
      const combinedAcceptable = acceptable && hosFeasible;

      // If HOS is not feasible, override the suggested counter offer with HOS latest legal time
      if (!hosFeasible && hosLatestLegalTime) {
        suggestedCounterOffer = hosLatestLegalTime;
        reason = hosRequiresNextShift
          ? `HOS INFEASIBLE - Exceeds driver's ${hosBindingConstraint} limit. Next shift required.`
          : `HOS INFEASIBLE - Driver cannot work at this time (${hosBindingConstraint}). Latest: ${hosLatestLegalTime}`;
      }

      // CRITICAL: Even if HOS is feasible for the OFFERED time, the cost-based
      // suggestedCounterOffer must also respect HOS limits. For example:
      // - Offered: "tomorrow at 6 AM" (HOS infeasible)
      // - Cost engine suggests: "5 PM today" as counter
      // - But HOS limit is 4:30 PM!
      // - We must clamp the counter-offer to 4:30 PM
      if (driverHOS && hosLatestLegalTime && suggestedCounterOffer) {
        const counterMinutes = parseTimeToMinutes(suggestedCounterOffer);
        const hosLimitMinutes = parseTimeToMinutes(hosLatestLegalTime);

        if (counterMinutes !== null && hosLimitMinutes !== null) {
          if (counterMinutes > hosLimitMinutes) {
            console.log(`⚠️ Cost-based counter-offer ${suggestedCounterOffer} exceeds HOS limit ${hosLatestLegalTime}, clamping to HOS limit`);
            suggestedCounterOffer = hosLatestLegalTime;
            reason += ` (Counter clamped to HOS limit: ${hosLatestLegalTime})`;
          }
        }
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
          // HOS fields (Phase 10)
          hosFeasible,
          hosBindingConstraint,
          hosLatestLegalTime,
          hosRequiresNextShift,
          combinedAcceptable,
          // Multi-day fields (Phase 11)
          dayOffset: offeredDayOffset,
          isNextDay: offeredDayOffset > 0,
          formattedTime: formatTimeWithDayOffset(args.offeredTimeText, offeredDayOffset),
          // Enhanced delay information for VAPI clarity
          delayHours: Math.round(deltaMinutes / 60 * 10) / 10,
          delayDescription: offeredDayOffset > 0
            ? `${Math.floor(deltaMinutes / (24 * 60))} day(s) and ${Math.round((deltaMinutes % (24*60)) / 60)} hours delay`
            : `${Math.round(deltaMinutes / 60 * 10) / 10} hours delay`,
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
