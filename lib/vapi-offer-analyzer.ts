/**
 * VAPI Offer Analyzer
 * Decision engine for evaluating time offers from warehouse managers
 * Used by the check-slot-cost webhook to determine acceptability
 */

import {
  parseTimeToMinutes,
  parseTimeToMinutesWithExtraction,
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
  /** Current pushback count (0 = no pushbacks yet, 1 = one pushback made, etc.) */
  pushbackCount?: number;
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
  // Incentive fields (for $100 emergency rescheduling fee)
  shouldOfferIncentive: boolean;
  incentiveAmount: number;
  /** Potential savings if warehouse accepts counter-offer vs current offer */
  potentialSavings: number;

  // === NEGOTIATION FIELDS (for humanized pushback) ===
  /** Human-readable reason Mike can speak to justify pushing back - ONE primary reason only */
  speakableReason: string;
  /** Type of the primary reason: 'hos' | 'otif' | 'cost' | 'delay' | 'none' */
  reasonType: 'hos' | 'otif' | 'cost' | 'delay' | 'none';
  /** Cost impact in friendly/rounded format (e.g., "almost $2,000") */
  costImpactFriendly: string;
  /** OTIF-specific impact if OTIF penalties are a factor (e.g., "about $1,500 in compliance penalties") */
  otifImpactFriendly: string | null;
  /** HOS-specific impact if driver hours are a factor (e.g., "driver only has about 2 hours left") */
  hosImpactFriendly: string | null;
  /** Trade-offs Mike can offer to sweeten the deal - ONLY provided on 2nd+ pushback */
  tradeOffs: string[];
  /** Context about where we are in the negotiation - helps VAPI vary its approach */
  pushbackContext: string;
  /** Whether this is a repeat pushback (pushbackCount > 0) - VAPI should vary phrasing */
  isRepeatPushback: boolean;
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
    pushbackCount = 0,
  } = params;

  // Debug: Log input parameters
  console.log('🔍 [analyzeTimeOffer] Input params:', {
    offeredTimeText,
    originalAppointment,
    delayMinutes,
    shipmentValue,
    retailer,
    pushbackCount,
    hasExtractedTerms: !!extractedTerms,
    hasPreComputedStrategy: !!preComputedStrategy,
  });

  // Parse times
  // Note: offeredTimeText may be raw user speech like "No. I said 9 PM."
  // Use parseTimeToMinutesWithExtraction to handle natural language
  const originalMinutes = parseTimeToMinutes(originalAppointment);
  const offeredMinutes = parseTimeToMinutesWithExtraction(offeredTimeText);

  console.log('🔍 [analyzeTimeOffer] Parsed times:', {
    originalAppointment,
    originalMinutes,
    offeredTimeText,
    offeredMinutes,
  });

  if (originalMinutes === null || offeredMinutes === null) {
    console.error('❌ [analyzeTimeOffer] Time parsing failed:', {
      originalAppointment: originalAppointment ?? 'undefined/null',
      offeredTimeText: offeredTimeText ?? 'undefined/null',
      originalMinutes,
      offeredMinutes,
    });
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

  // Determine if we should offer the $100 emergency rescheduling incentive
  // Conditions:
  // 1. Offer is not acceptable (we're pushing back)
  // 2. This is the 2nd pushback (pushbackCount >= 1)
  // 3. The cost savings justify it (savings >= $200, so net benefit after $100 fee is $100+)
  const isNotAcceptable = !evaluation.acceptable || !hosResult.hosFeasible;
  const incentiveAmount = 100; // Fixed at $100
  const minimumSavingsRequired = 200; // Must save at least $200 to justify $100 fee

  let shouldOfferIncentive = false;
  let potentialSavings = 0;

  if (isNotAcceptable && pushbackCount >= 1 && suggestedCounterOffer) {
    // Calculate what the cost would be at the suggested counter-offer time
    const counterOfferCostBreakdown = calculateCostBreakdown(
      originalAppointment,
      suggestedCounterOffer,
      shipmentValue,
      retailer,
      0, // Counter-offer is always same-day
      contractRules
    );

    potentialSavings = costBreakdown.totalCost - counterOfferCostBreakdown.totalCost;

    // Only offer incentive if savings justify the $100 fee
    if (potentialSavings >= minimumSavingsRequired) {
      shouldOfferIncentive = true;
      console.log(`💰 Incentive APPROVED: Current cost=$${costBreakdown.totalCost}, Counter cost=$${counterOfferCostBreakdown.totalCost}, Savings=$${potentialSavings} (>= $${minimumSavingsRequired})`);
    } else {
      console.log(`💰 Incentive SKIPPED: Savings=$${potentialSavings} < $${minimumSavingsRequired} required. Not worth offering $${incentiveAmount} fee.`);
    }
  }

  // Generate negotiation fields for humanized pushback with progressive escalation
  const otifImpactFriendly = generateOtifImpact(costBreakdown.otifPenalty);
  const hosImpactFriendly = generateHosImpact(
    hosEnabled,
    driverHOS,
    hosResult.hosFeasible,
    hosResult.hosBindingConstraint,
    hosResult.hosLatestLegalTime
  );
  const costImpactFriendly = formatCostFriendly(costBreakdown.totalCost);

  // Generate all possible trade-offs (will be filtered based on pushback count)
  const allTradeOffs = generateTradeOffs(
    offeredDayOffset > 0,
    costBreakdown.totalCost,
    costBreakdown.otifPenalty,
    1 // Pass 1 to get all trade-offs, actual filtering happens in generateNegotiationFields
  );

  const isAcceptable = evaluation.acceptable && hosResult.hosFeasible;

  // Generate negotiation fields with progressive escalation based on pushback count
  const negotiationFields = generateNegotiationFields(
    isAcceptable,
    costBreakdown.totalCost,
    otifImpactFriendly,
    hosImpactFriendly,
    offeredDayOffset > 0,
    delayDescription,
    pushbackCount,
    allTradeOffs
  );

  console.log('🗣️ [analyzeTimeOffer] Negotiation fields:', {
    pushbackCount,
    speakableReason: negotiationFields.speakableReason,
    reasonType: negotiationFields.reasonType,
    pushbackContext: negotiationFields.pushbackContext,
    costImpactFriendly,
    otifImpactFriendly,
    hosImpactFriendly,
    tradeOffs: negotiationFields.tradeOffs.length,
    isRepeatPushback: pushbackCount > 0,
  });

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
    combinedAcceptable: isAcceptable,
    dayOffset: offeredDayOffset,
    isNextDay: offeredDayOffset > 0,
    formattedTime: formatTimeWithDayOffset(offeredTimeText, offeredDayOffset),
    delayHours,
    delayDescription,
    shouldOfferIncentive,
    incentiveAmount,
    potentialSavings,
    // Negotiation fields - vary based on pushback count for progressive escalation
    speakableReason: negotiationFields.speakableReason,
    reasonType: negotiationFields.reasonType,
    costImpactFriendly,
    otifImpactFriendly,
    hosImpactFriendly,
    tradeOffs: negotiationFields.tradeOffs,
    pushbackContext: negotiationFields.pushbackContext,
    isRepeatPushback: pushbackCount > 0,
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
    shouldOfferIncentive: false,
    incentiveAmount: 0,
    potentialSavings: 0,
    // Negotiation fields
    speakableReason: '',
    reasonType: 'none',
    costImpactFriendly: '$0',
    otifImpactFriendly: null,
    hosImpactFriendly: null,
    tradeOffs: [],
    pushbackContext: '',
    isRepeatPushback: false,
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

// ============================================================================
// Negotiation Reason Helpers (for humanized pushback)
// ============================================================================

/**
 * Round a cost to a friendly, speakable format
 * $1,975 → "almost $2,000"
 * $1,234 → "about $1,200"
 * $856 → "around $850"
 * $2,500 → "$2,500"
 */
function formatCostFriendly(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 100) return `$${Math.round(cost / 10) * 10}`;

  // Round to nearest $50 for costs under $500
  if (cost < 500) {
    const rounded = Math.round(cost / 50) * 50;
    const diff = Math.abs(cost - rounded);
    if (diff < 25) return `$${rounded}`;
    return cost < rounded ? `about $${rounded}` : `almost $${rounded}`;
  }

  // Round to nearest $100 for costs $500+
  const rounded = Math.round(cost / 100) * 100;
  const diff = cost - rounded;

  if (Math.abs(diff) < 30) return `$${rounded.toLocaleString()}`;
  if (diff < 0) return `about $${rounded.toLocaleString()}`;
  return `almost $${rounded.toLocaleString()}`;
}

/**
 * Format minutes remaining into friendly speech
 * 120 → "about 2 hours"
 * 90 → "about an hour and a half"
 * 45 → "about 45 minutes"
 */
function formatMinutesFriendly(minutes: number): string {
  if (minutes < 60) {
    const rounded = Math.round(minutes / 15) * 15;
    return `about ${rounded} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (remainingMins < 15) {
    return hours === 1 ? 'about an hour' : `about ${hours} hours`;
  }
  if (remainingMins >= 15 && remainingMins < 45) {
    return hours === 1 ? 'about an hour and a half' : `about ${hours} and a half hours`;
  }
  return `almost ${hours + 1} hours`;
}

/**
 * Generate OTIF impact description if penalties apply.
 * Uses industry terminology that warehouse managers understand.
 */
function generateOtifImpact(otifPenalty: number): string | null {
  if (otifPenalty <= 0) return null;

  const friendlyCost = formatCostFriendly(otifPenalty);
  return `${friendlyCost} in OTIF chargebacks`;
}

/**
 * Generate HOS impact description if HOS is a constraint.
 * Uses industry terminology: "HOS" (Hours of Service), "drive time", "14-hour window".
 */
function generateHosImpact(
  hosEnabled: boolean | undefined,
  driverHOS: DriverHOSStatus | undefined,
  hosFeasible: boolean,
  hosBindingConstraint: HOSBindingConstraint | null,
  hosLatestLegalTime: string | null
): string | null {
  if (!hosEnabled || !driverHOS) return null;

  // Use the most restrictive remaining time
  const remainingMinutes = Math.min(
    driverHOS.remainingDriveMinutes,
    driverHOS.remainingWindowMinutes
  );

  const friendlyTime = formatMinutesFriendly(remainingMinutes);

  if (!hosFeasible && hosLatestLegalTime) {
    return `driver hits HOS limits after ${hosLatestLegalTime}`;
  }

  // If HOS is enabled but we're still feasible, mention the constraint if it's tight
  if (remainingMinutes < 180) { // Less than 3 hours
    return `driver only has ${friendlyTime} left on his HOS clock today`;
  }

  return null; // HOS is fine, no need to mention
}

/**
 * Generate trade-offs Mike can offer based on the situation.
 * IMPORTANT: Only return trade-offs on 2nd+ pushback to allow progressive escalation.
 * First pushback should just state the constraint, second pushback adds sweeteners.
 */
function generateTradeOffs(
  isNextDay: boolean,
  totalCost: number,
  otifPenalty: number,
  pushbackCount: number
): string[] {
  // First pushback (pushbackCount=0): No trade-offs yet - just state the constraint
  // This allows for escalation on the second pushback
  if (pushbackCount === 0) {
    return [];
  }

  // Second+ pushback: Now offer trade-offs to sweeten the deal
  const tradeOffs: string[] = [];

  // Drop-and-hook is the most valuable trade-off
  tradeOffs.push('We can do a drop-and-hook if that makes it easier for your team');

  // If significant cost, offer to be flexible
  if (totalCost > 500 || otifPenalty > 0) {
    tradeOffs.push("Driver will be staged at your gate ready to roll the minute you've got a door");
  }

  // If pushing for same-day vs next-day
  if (isNextDay) {
    tradeOffs.push("If you can squeeze us in today, we'll take any late-day door you've got");
  }

  // Quick unload guarantee
  tradeOffs.push("We can guarantee a quick 30-minute unload");

  return tradeOffs;
}

/**
 * Reason types in priority order (highest priority first)
 */
type ReasonType = 'hos' | 'otif' | 'cost' | 'delay' | 'none';

/**
 * Varied phrase templates using INDUSTRY TERMINOLOGY.
 * Warehouse managers understand: HOS compliance, OTIF penalties, detention fees.
 * These terms are standard in freight/logistics and add credibility.
 */
const HOS_PHRASES = [
  (impact: string) => `Here's the thing - my ${impact}. It's an HOS compliance issue.`,
  (impact: string) => `The challenge is my ${impact}. HOS regs don't give us any wiggle room.`,
  (impact: string) => `So here's my situation - ${impact}. Federal HOS limits.`,
  (impact: string) => `I'm up against HOS compliance - my ${impact}.`,
];

const OTIF_PHRASES = [
  (impact: string) => `Here's the deal - we're looking at ${impact} if we take that slot.`,
  (impact: string) => `That would put us at ${impact}. OTIF compliance is killing us here.`,
  (impact: string) => `We'd be hitting ${impact} - OTIF chargeback from the shipper.`,
  (impact: string) => `That slot would cost us ${impact}. The shipper's OTIF requirements are strict.`,
];

const COST_PHRASES = [
  (cost: string) => `That time would put us at ${cost} in detention fees.`,
  (cost: string) => `We'd be looking at ${cost} in detention charges with that slot.`,
  (cost: string) => `That's going to run us ${cost} in detention.`,
  (cost: string) => `We'd be hitting ${cost} in detention fees.`,
];

const DELAY_PHRASES = [
  (delay: string) => `Rolling to tomorrow puts us at a ${delay} - that's a big hit for us.`,
  (delay: string) => `Tomorrow would be a ${delay} - really tough on OTIF compliance.`,
  (delay: string) => `That's a ${delay} if we push to tomorrow - OTIF penalties would hurt.`,
];

/** Pick a phrase from an array by index (deterministic based on pushback count) */
function pickPhraseByIndex<T>(phrases: T[], index: number): T {
  return phrases[index % phrases.length];
}

/**
 * Phrases for repeat pushbacks - acknowledge we've said this before but emphasize urgency
 * Uses industry terminology: HOS, OTIF, detention
 */
const REPEAT_HOS_PHRASES = [
  (impact: string) => `I know I mentioned it, but HOS compliance is the hard constraint - my ${impact}.`,
  (impact: string) => `Look, I really need to stress this - my ${impact}. Federal HOS regs, it's a legal limit.`,
  (impact: string) => `I hear you, but I'm stuck on HOS - my ${impact}. No flexibility on compliance.`,
];

const REPEAT_OTIF_PHRASES = [
  (impact: string) => `I understand, but here's the reality - we're looking at ${impact}. OTIF compliance is strict.`,
  (impact: string) => `Look, I get scheduling is tough, but ${impact} in OTIF chargebacks is going to hurt us.`,
  (impact: string) => `I hear you - but ${impact} in OTIF penalties is going to be a problem on our end.`,
];

const REPEAT_COST_PHRASES = [
  (cost: string) => `I hear you, but ${cost} in detention fees is going to be tough for us.`,
  (cost: string) => `Look, I understand - but we're still looking at ${cost} in detention. Is there anything else available?`,
  (cost: string) => `I get it, but that's ${cost} in detention we're trying to avoid here.`,
];

/**
 * Generate negotiation fields including speakable reason and pushback context.
 *
 * Progressive escalation strategy:
 * - Pushback 1 (pushbackCount=0): State the primary constraint clearly
 * - Pushback 2 (pushbackCount=1): Vary phrasing, acknowledge repetition, add trade-offs
 *
 * Priority order:
 * 1. HOS - Hard legal constraint, most urgent
 * 2. OTIF - Concrete shipper penalty, very persuasive
 * 3. Cost - Detention/dwell charges
 * 4. Delay - Generic "that's a long delay"
 */
interface NegotiationFields {
  speakableReason: string;
  reasonType: ReasonType;
  tradeOffs: string[];
  pushbackContext: string;
}

function generateNegotiationFields(
  isAcceptable: boolean,
  totalCost: number,
  otifImpact: string | null,
  hosImpact: string | null,
  isNextDay: boolean,
  delayDescription: string,
  pushbackCount: number,
  allTradeOffs: string[]
): NegotiationFields {
  if (isAcceptable) {
    return {
      speakableReason: '',
      reasonType: 'none',
      tradeOffs: [],
      pushbackContext: 'Offer is acceptable - no pushback needed.',
    };
  }

  // Determine if this is a repeat pushback
  const isRepeat = pushbackCount > 0;

  // Generate pushback context for VAPI
  let pushbackContext: string;
  if (pushbackCount === 0) {
    pushbackContext = 'FIRST PUSHBACK: State your primary constraint clearly. Do NOT offer trade-offs yet - save those for the second pushback if needed.';
  } else if (pushbackCount === 1) {
    pushbackContext = 'SECOND PUSHBACK: You already stated your constraint once. Vary your phrasing - acknowledge you mentioned it but emphasize the urgency. NOW you can offer a trade-off (drop-and-hook, quick unload) to sweeten the deal.';
  } else {
    pushbackContext = 'FINAL ATTEMPT: You have pushed back twice. If this offer is still not acceptable, you must accept it reluctantly. Say something like "Alright, we\'ll make that work" and move on to get the dock number.';
  }

  // Only include trade-offs on 2nd+ pushback
  const tradeOffs = pushbackCount > 0 ? allTradeOffs : [];

  // Generate the speakable reason based on priority and pushback count
  let speakableReason: string;
  let reasonType: ReasonType;

  // Priority 1: HOS compliance (hard legal constraint)
  if (hosImpact) {
    reasonType = 'hos';
    if (isRepeat) {
      speakableReason = pickPhraseByIndex(REPEAT_HOS_PHRASES, pushbackCount)(hosImpact);
    } else {
      speakableReason = pickPhraseByIndex(HOS_PHRASES, 0)(hosImpact);
    }
  }
  // Priority 2: OTIF penalties (concrete shipper cost)
  else if (otifImpact) {
    reasonType = 'otif';
    if (isRepeat) {
      speakableReason = pickPhraseByIndex(REPEAT_OTIF_PHRASES, pushbackCount)(otifImpact);
    } else {
      speakableReason = pickPhraseByIndex(OTIF_PHRASES, 0)(otifImpact);
    }
  }
  // Priority 3: Significant cost impact (detention/dwell)
  else if (totalCost >= 200) {
    reasonType = 'cost';
    if (isRepeat) {
      speakableReason = pickPhraseByIndex(REPEAT_COST_PHRASES, pushbackCount)(formatCostFriendly(totalCost));
    } else {
      speakableReason = pickPhraseByIndex(COST_PHRASES, 0)(formatCostFriendly(totalCost));
    }
  }
  // Priority 4: Next-day delay (if nothing else)
  else if (isNextDay) {
    reasonType = 'delay';
    speakableReason = pickPhraseByIndex(DELAY_PHRASES, pushbackCount)(delayDescription);
  }
  // Fallback
  else if (totalCost > 0) {
    reasonType = 'cost';
    if (isRepeat) {
      speakableReason = pickPhraseByIndex(REPEAT_COST_PHRASES, pushbackCount)(formatCostFriendly(totalCost));
    } else {
      speakableReason = pickPhraseByIndex(COST_PHRASES, 0)(formatCostFriendly(totalCost));
    }
  } else {
    reasonType = 'none';
    speakableReason = 'That timing is a bit tight for us.';
  }

  return {
    speakableReason,
    reasonType,
    tradeOffs,
    pushbackContext,
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
