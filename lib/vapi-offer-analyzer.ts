/**
 * VAPI Offer Analyzer
 * Decision engine for evaluating time offers from warehouse managers
 * Used by the check-slot-cost webhook to determine acceptability
 */

import {
  parseTimeToMinutes,
  minutesToTime12Hour,
  minutesToTime,
  roundTimeToFiveMinutes,
  getMultiDayTimeDifference,
  formatTimeWithDayOffset,
} from '@/lib/time-parser';
import { calculateTotalCostImpact, calculateTotalCostImpactMultiDay, convertExtractedTermsToRules } from '@/lib/cost-engine';
import { createNegotiationStrategy } from '@/lib/negotiation-strategy';
import { checkHOSFeasibility } from '@/lib/hos-engine';
import { detectDateIndicator } from '@/lib/message-extractors';
import type { Retailer } from '@/types/dispatch';
import type { ExtractedContractTerms } from '@/types/contract';
import type { DriverHOSStatus, HOSBindingConstraint } from '@/types/hos';
import type { ContractRules } from '@/types/cost';

// ============================================================================
// Types
// ============================================================================

/**
 * Pre-computed strategy passed from UI to ensure VAPI uses exact same thresholds.
 * This prevents any drift between UI strategy display and VAPI decision-making.
 */
export interface PreComputedStrategy {
  thresholds: {
    ideal: { maxMinutes: number; description: string; costImpact: string };
    acceptable: { maxMinutes: number; description: string; costImpact: string };
    problematic: { maxMinutes: number; description: string; costImpact: string };
  };
  costThresholds: {
    ideal: number;
    acceptable: number;
    reluctant: number;
  };
  maxPushbackAttempts: number;
  display: {
    idealBefore: string;
    acceptableBefore: string;
    problematicAfter: string;
    actualArrivalTime: string;
  };
}

export interface OfferAnalysisParams {
  offeredTimeText: string;
  originalAppointment: string;
  delayMinutes: number;
  shipmentValue: number;
  retailer: Retailer;
  extractedTerms?: ExtractedContractTerms;
  /** Pre-computed strategy from UI - if provided, uses this instead of recalculating */
  preComputedStrategy?: PreComputedStrategy;
  hosEnabled?: boolean;
  currentTime?: string;
  driverHOS?: DriverHOSStatus;
  driverDetentionRate?: number;
  offeredDayOffset?: number;
}

export interface CostBreakdown {
  dwellCost: number;
  otifPenalty: number;
  totalCost: number;
  isLate: boolean;
}

export interface OfferAnalysisResult {
  acceptable: boolean;
  parsedOfferedTime: string | null;
  minutesFromOriginal: number | null;
  internalReason: string;
  suggestedCounterOffer: string | null;
  costBreakdown?: CostBreakdown;
  // HOS fields
  hosFeasible: boolean;
  hosBindingConstraint: HOSBindingConstraint | null;
  hosLatestLegalTime: string | null;
  hosRequiresNextShift: boolean;
  combinedAcceptable: boolean;
  // Multi-day fields
  dayOffset: number;
  isNextDay: boolean;
  formattedTime: string;
  // Enhanced delay info
  delayHours: number;
  delayDescription: string;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze a time offer from warehouse manager
 * Returns acceptability, cost breakdown, HOS feasibility, and counter-offer if needed
 */
export function analyzeTimeOffer(params: OfferAnalysisParams): OfferAnalysisResult {
  const {
    offeredTimeText,
    originalAppointment,
    delayMinutes,
    shipmentValue,
    retailer,
    extractedTerms,
    preComputedStrategy,
    hosEnabled,
    currentTime,
    driverHOS,
    driverDetentionRate = 50,
    offeredDayOffset: providedDayOffset,
  } = params;

  // Parse times
  const originalMinutes = parseTimeToMinutes(originalAppointment);
  const offeredMinutes = parseTimeToMinutes(offeredTimeText);

  if (originalMinutes === null || offeredMinutes === null) {
    return createParseErrorResult();
  }

  // Determine day offset (from args or auto-detect)
  const offeredDayOffset = detectDayOffset(offeredTimeText, providedDayOffset);

  // Calculate time difference
  const deltaMinutes = getMultiDayTimeDifference(
    originalAppointment,
    offeredTimeText,
    offeredDayOffset
  ) ?? (offeredMinutes - originalMinutes);

  // Convert contract terms to rules
  // IMPORTANT: Pass retailer to ensure chargebacks are stored under the correct key for lookup
  const contractRules = convertExtractedTermsToRules(extractedTerms, retailer);

  // Calculate cost impact
  const costBreakdown = calculateCostBreakdown(
    originalAppointment,
    offeredTimeText,
    shipmentValue,
    retailer,
    offeredDayOffset,
    contractRules
  );

  // Check HOS feasibility
  const hosResult = checkHOSForOffer(
    offeredTimeText,
    currentTime,
    hosEnabled,
    driverHOS,
    driverDetentionRate
  );

  // Use pre-computed strategy from UI if provided (ensures exact match with UI display)
  // Otherwise, fall back to calculating a fresh strategy
  const strategy = preComputedStrategy || createNegotiationStrategy({
    originalAppointment,
    delayMinutes,
    shipmentValue,
    retailer,
    contractRules,
  });

  // Evaluate offer against strategy thresholds
  const evaluation = evaluateOffer(
    offeredMinutes,
    offeredDayOffset,
    costBreakdown.totalCost,
    deltaMinutes,
    strategy
  );

  // Generate counter-offer if needed
  let suggestedCounterOffer = evaluation.suggestedCounterOffer;
  let reason = evaluation.reason;

  // Override counter-offer if HOS is not feasible
  if (!hosResult.hosFeasible && hosResult.hosLatestLegalTime) {
    suggestedCounterOffer = hosResult.hosLatestLegalTime;
    reason = hosResult.hosRequiresNextShift
      ? `HOS INFEASIBLE - Exceeds driver's ${hosResult.hosBindingConstraint} limit. Next shift required.`
      : `HOS INFEASIBLE - Driver cannot work at this time (${hosResult.hosBindingConstraint}). Latest: ${hosResult.hosLatestLegalTime}`;
  }

  // Clamp counter-offer to HOS limit if needed
  if (driverHOS && hosResult.hosLatestLegalTime && suggestedCounterOffer) {
    const clampResult = clampCounterOfferToHOS(suggestedCounterOffer, hosResult.hosLatestLegalTime);
    if (clampResult.wasClamped) {
      suggestedCounterOffer = clampResult.clampedTime;
      reason += ` (Counter clamped to HOS limit: ${hosResult.hosLatestLegalTime})`;
    }
  }

  // Calculate delay description
  const delayHours = Math.round(deltaMinutes / 60 * 10) / 10;
  const delayDays = Math.floor(deltaMinutes / (24 * 60));
  const delayDescription = delayDays >= 1
    ? `${delayDays} day(s) and ${Math.round((deltaMinutes % (24*60)) / 60)} hours delay`
    : `${delayHours} hours delay`;

  return {
    acceptable: evaluation.acceptable,
    parsedOfferedTime: minutesToTime12Hour(offeredMinutes),
    minutesFromOriginal: deltaMinutes,
    internalReason: reason,
    suggestedCounterOffer,
    costBreakdown,
    hosFeasible: hosResult.hosFeasible,
    hosBindingConstraint: hosResult.hosBindingConstraint,
    hosLatestLegalTime: hosResult.hosLatestLegalTime,
    hosRequiresNextShift: hosResult.hosRequiresNextShift,
    combinedAcceptable: evaluation.acceptable && hosResult.hosFeasible,
    dayOffset: offeredDayOffset,
    isNextDay: offeredDayOffset > 0,
    formattedTime: formatTimeWithDayOffset(offeredTimeText, offeredDayOffset),
    delayHours,
    delayDescription,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function createParseErrorResult(): OfferAnalysisResult {
  return {
    acceptable: false,
    parsedOfferedTime: null,
    minutesFromOriginal: null,
    internalReason: 'Could not parse time values',
    suggestedCounterOffer: null,
    hosFeasible: true,
    hosBindingConstraint: null,
    hosLatestLegalTime: null,
    hosRequiresNextShift: false,
    combinedAcceptable: false,
    dayOffset: 0,
    isNextDay: false,
    formattedTime: '',
    delayHours: 0,
    delayDescription: '',
  };
}

function detectDayOffset(offeredTimeText: string, providedOffset?: number): number {
  if (providedOffset !== undefined && providedOffset > 0) {
    return providedOffset;
  }
  const detected = detectDateIndicator(offeredTimeText);
  if (detected.dayOffset > 0) {
    console.log(`📅 Auto-detected day offset ${detected.dayOffset} from "${offeredTimeText}" (${detected.indicator})`);
  }
  return detected.dayOffset;
}

function calculateCostBreakdown(
  originalAppointment: string,
  offeredTimeText: string,
  shipmentValue: number,
  retailer: Retailer,
  offeredDayOffset: number,
  contractRules: ContractRules
): CostBreakdown {
  const costImpact = offeredDayOffset > 0
    ? calculateTotalCostImpactMultiDay(
        {
          originalAppointmentTime: originalAppointment,
          newAppointmentTime: offeredTimeText,
          shipmentValue,
          retailer,
          offeredDayOffset,
        },
        contractRules
      )
    : calculateTotalCostImpact(
        {
          originalAppointmentTime: originalAppointment,
          newAppointmentTime: offeredTimeText,
          shipmentValue,
          retailer,
        },
        contractRules
      );

  return {
    dwellCost: costImpact.calculations.dwellTime?.total ?? 0,
    otifPenalty: costImpact.calculations.otif?.total ?? 0,
    totalCost: costImpact.totalCost,
    isLate: costImpact.calculations.otif?.outsideWindow ?? false,
  };
}

interface HOSCheckResult {
  hosFeasible: boolean;
  hosBindingConstraint: HOSBindingConstraint | null;
  hosLatestLegalTime: string | null;
  hosRequiresNextShift: boolean;
}

function checkHOSForOffer(
  offeredTimeText: string,
  currentTime: string | undefined,
  hosEnabled: boolean | undefined,
  driverHOS: DriverHOSStatus | undefined,
  driverDetentionRate: number
): HOSCheckResult {
  if (!hosEnabled || !driverHOS) {
    return {
      hosFeasible: true,
      hosBindingConstraint: null,
      hosLatestLegalTime: null,
      hosRequiresNextShift: false,
    };
  }

  const now = currentTime || new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const hosResult = checkHOSFeasibility(
    offeredTimeText,
    now,
    driverHOS,
    60, // Estimated dock duration (1 hour)
    driverDetentionRate
  );

  console.log(`🕐 HOS feasibility: ${hosResult.feasible ? 'OK' : 'NOT FEASIBLE'}, binding: ${hosResult.bindingConstraint || 'none'}`);

  return {
    hosFeasible: hosResult.feasible,
    hosBindingConstraint: hosResult.bindingConstraint || null,
    hosLatestLegalTime: hosResult.latestLegalDockTime,
    hosRequiresNextShift: hosResult.requiresNextShift,
  };
}

interface OfferEvaluation {
  acceptable: boolean;
  reason: string;
  suggestedCounterOffer: string | null;
}

function evaluateOffer(
  offeredMinutes: number,
  offeredDayOffset: number,
  totalCost: number,
  deltaMinutes: number,
  strategy: ReturnType<typeof createNegotiationStrategy>
): OfferEvaluation {
  const { costThresholds, thresholds } = strategy;

  // For same-day: compare clock times. For next-day: any offer is already past deadline
  const withinIdealTime = offeredDayOffset === 0
    ? offeredMinutes <= thresholds.ideal.maxMinutes
    : false;

  const withinAcceptableTime = offeredDayOffset === 0
    ? offeredMinutes <= thresholds.acceptable.maxMinutes
    : false;

  // Calculate delay description for reason
  const delayHours = Math.round(deltaMinutes / 60 * 10) / 10;
  const delayDays = Math.floor(deltaMinutes / (24 * 60));
  const delayDescription = delayDays >= 1
    ? `${delayDays} day${delayDays > 1 ? 's' : ''} and ${Math.round((deltaMinutes % (24*60)) / 60)} hours later`
    : `${delayHours} hours later`;

  // IDEAL: Within compliance window and cost at/below ideal threshold
  if (withinIdealTime && totalCost <= costThresholds.ideal) {
    return {
      acceptable: true,
      reason: totalCost === 0
        ? `IDEAL - No cost impact`
        : `IDEAL - Minimal cost ($${totalCost})`,
      suggestedCounterOffer: null,
    };
  }

  // ACCEPTABLE: Within acceptable time window and cost at/below acceptable threshold
  if (withinAcceptableTime && totalCost <= costThresholds.acceptable) {
    return {
      acceptable: true,
      reason: `ACCEPTABLE - Cost ($${totalCost}) within threshold ($${costThresholds.acceptable})`,
      suggestedCounterOffer: null,
    };
  }

  // SUBOPTIMAL: Next-day offer OR time is past acceptable deadline OR cost exceeds threshold
  if (offeredDayOffset > 0 || !withinAcceptableTime || totalCost > costThresholds.reluctant) {
    // Suggest the ideal time as counter-offer, rounded UP to 5-minute intervals
    const idealTime24h = minutesToTime(thresholds.ideal.maxMinutes);
    const roundedIdealTime24h = roundTimeToFiveMinutes(idealTime24h);
    const roundedIdealMinutes = parseTimeToMinutes(roundedIdealTime24h) || thresholds.ideal.maxMinutes;
    const counterOffer = minutesToTime12Hour(roundedIdealMinutes);

    // Build reason based on why it's suboptimal
    let timeReason: string;
    if (offeredDayOffset > 0) {
      timeReason = `Offered time is ${delayDescription} - significant delay`;
    } else if (!withinAcceptableTime) {
      timeReason = 'Time too late in the day';
    } else {
      timeReason = 'Cost too high';
    }

    return {
      acceptable: false,
      reason: `SUBOPTIMAL - ${timeReason}. Total delay: ${deltaMinutes} minutes (${delayDescription}). Counter-offer: ${counterOffer} today.`,
      suggestedCounterOffer: counterOffer,
    };
  }

  // Default: Within acceptable range
  return {
    acceptable: true,
    reason: `OK - Cost ($${totalCost}) within tolerance`,
    suggestedCounterOffer: null,
  };
}

interface ClampResult {
  clampedTime: string;
  wasClamped: boolean;
}

function clampCounterOfferToHOS(
  counterOffer: string,
  hosLatestLegalTime: string
): ClampResult {
  const counterMinutes = parseTimeToMinutes(counterOffer);
  const hosLimitMinutes = parseTimeToMinutes(hosLatestLegalTime);

  if (counterMinutes !== null && hosLimitMinutes !== null && counterMinutes > hosLimitMinutes) {
    console.log(`⚠️ Cost-based counter-offer ${counterOffer} exceeds HOS limit ${hosLatestLegalTime}, clamping to HOS limit`);
    return {
      clampedTime: hosLatestLegalTime,
      wasClamped: true,
    };
  }

  return {
    clampedTime: counterOffer,
    wasClamped: false,
  };
}
