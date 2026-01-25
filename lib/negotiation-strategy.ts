// Negotiation strategy engine for the Dispatcher AI
// GENERIC: Works with any contract rules, not hardcoded for OTIF

import {
  parseTimeToMinutes,
  minutesToTime,
  roundTimeToFiveMinutes,
  toAbsoluteMinutes,
  formatTimeWithDayOffset,
} from './time-parser';
import { calculateTotalCostImpact } from './cost-engine';
import type { NegotiationState, Retailer } from '@/types/dispatch';
import type { ContractRules } from '@/types/cost';

/** Quality rating for an offer */
export type OfferQuality = 'IDEAL' | 'ACCEPTABLE' | 'SUBOPTIMAL' | 'UNACCEPTABLE' | 'UNKNOWN';

/** Threshold definition for negotiation */
export interface NegotiationThreshold {
  maxMinutes: number;
  description: string;
  costImpact: string;
}

/** All thresholds for negotiation strategy */
export interface NegotiationThresholds {
  ideal: NegotiationThreshold;
  acceptable: NegotiationThreshold;
  problematic: NegotiationThreshold;
}

/** Cost thresholds for offer evaluation */
export interface CostThresholds {
  ideal: number;
  acceptable: number;
  reluctant: number;
}

/** Display-friendly time strings */
export interface StrategyDisplay {
  idealBefore: string;
  acceptableBefore: string;
  problematicAfter: string;
  actualArrivalTime: string;
}

/** Cost sample point along the time curve */
interface CostSample {
  timeMinutes: number;
  cost: number;
}

/** Step jump in cost function */
interface StepJump {
  timeMinutes: number;
  costBefore: number;
  costAfter: number;
  jumpAmount: number;
}

/** Analysis of the cost curve after arrival */
interface CostCurveAnalysis {
  actualArrivalMins: number;
  samples: CostSample[];
  lowestCost: number;
  zeroPenaltyEnd: number | null;
  stepJumps: StepJump[];
  hasStepJumps: boolean;
  isLinearGrowth: boolean;
  firstSignificantJump: StepJump | null;
}

/** HOS constraints for strategy (Phase 10) */
export interface HOSStrategyConstraints {
  /** Latest feasible dock time based on driver HOS */
  latestFeasibleTime: string;
  /** Latest feasible time in minutes from midnight */
  latestFeasibleTimeMinutes: number;
  /** If true, any dock time requires next shift (10h off-duty) */
  requiresNextShift: boolean;
  /** If next shift required, earliest available time */
  nextShiftEarliestTime?: string;
  /** Driver's remaining 14h window time */
  remainingWindowMinutes: number;
  /** Remaining time for the binding constraint (for accurate display) */
  bindingConstraintRemainingMinutes: number;
  /** Which HOS constraint is binding */
  bindingConstraint: string;
}

/** Complete negotiation strategy */
export interface NegotiationStrategy {
  thresholds: NegotiationThresholds;
  costThresholds: CostThresholds;
  maxPushbackAttempts: number;
  display: StrategyDisplay;
  /** HOS constraints (Phase 10) - undefined if HOS not enabled */
  hosConstraints?: HOSStrategyConstraints;
}

/** Result of evaluating an offer */
export interface OfferEvaluation {
  quality: OfferQuality;
  shouldAccept: boolean;
  shouldPushback: boolean;
  reason: string;
}

/** Driver HOS status for strategy creation (Phase 10) */
export interface DriverHOSForStrategy {
  remainingDriveMinutes: number;
  remainingWindowMinutes: number;
  remainingWeeklyMinutes: number;
  minutesSinceLastBreak: number;
  shortHaulExempt: boolean;
  weekRule: '60_in_7' | '70_in_8';
}

/**
 * Parameters for creating a negotiation strategy
 */
export interface StrategyParams {
  originalAppointment: string;
  delayMinutes: number;
  shipmentValue: number;
  retailer: Retailer;
  contractRules: ContractRules;
  /** Current time for HOS calculations (HH:MM format) - defaults to now */
  currentTime?: string;
  /** Driver HOS status (Phase 10) - undefined if HOS not enabled */
  driverHOS?: DriverHOSForStrategy;
  /** Estimated time at dock in minutes (default: 60) */
  estimatedDockDurationMinutes?: number;
}

/**
 * Analyze the cost curve after truck arrival to detect penalty structure.
 *
 * Samples costs at regular intervals to identify:
 * - Flat zones (no penalty increase)
 * - Step jumps (sudden penalty increases)
 * - Linear growth (gradual penalty increases)
 *
 * This is GENERIC - works with any contract penalty structure.
 *
 * @param actualArrivalMins - When truck will physically arrive
 * @param calculateCostFn - Function to calculate cost at a given time
 * @returns Analysis of cost curve structure
 */
function analyzeCostCurve(
  actualArrivalMins: number,
  calculateCostFn: (timeMinutes: number) => number
): CostCurveAnalysis {
  // Sample costs every 15 minutes for 6 hours after arrival
  const SAMPLE_INTERVAL = 15; // minutes
  const SAMPLE_DURATION = 360; // 6 hours
  const STEP_JUMP_THRESHOLD = 100; // $100+ increase = significant step

  const samples: CostSample[] = [];

  // Sample from arrival time onwards
  for (let offset = 0; offset <= SAMPLE_DURATION; offset += SAMPLE_INTERVAL) {
    const timeMinutes = actualArrivalMins + offset;
    const cost = calculateCostFn(timeMinutes);
    samples.push({ timeMinutes, cost });
  }

  const lowestCost = samples[0].cost;

  // Find where zero penalty zone ends (if it exists)
  let zeroPenaltyEnd: number | null = null;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].cost === lowestCost) {
      zeroPenaltyEnd = samples[i].timeMinutes;
    } else {
      break; // Cost increased, zero penalty zone ended
    }
  }

  // Detect step jumps in cost function
  const stepJumps: StepJump[] = [];
  for (let i = 1; i < samples.length; i++) {
    const costDelta = samples[i].cost - samples[i - 1].cost;

    if (costDelta >= STEP_JUMP_THRESHOLD) {
      stepJumps.push({
        timeMinutes: samples[i].timeMinutes,
        costBefore: samples[i - 1].cost,
        costAfter: samples[i].cost,
        jumpAmount: costDelta,
      });
    }
  }

  const hasStepJumps = stepJumps.length > 0;
  const isLinearGrowth = !hasStepJumps && samples[samples.length - 1].cost > lowestCost;
  const firstSignificantJump = stepJumps[0] || null;

  return {
    actualArrivalMins,
    samples,
    lowestCost,
    zeroPenaltyEnd,
    stepJumps,
    hasStepJumps,
    isLinearGrowth,
    firstSignificantJump,
  };
}

/**
 * Create a negotiation strategy by ANALYZING the cost curve after truck arrival.
 *
 * This is GENERIC - it works with any contract penalty structure:
 * - Detects flat zones (no penalty increase)
 * - Detects step jumps (sudden penalty increases)
 * - Detects linear growth (gradual penalty increases)
 *
 * Strategy is based on actual arrival time and cost curve analysis,
 * not hardcoded assumptions about OTIF or dwell time.
 *
 * @param params - All parameters needed to calculate costs
 * @returns Complete negotiation strategy with thresholds derived from cost curve analysis
 */
export function createNegotiationStrategy(params: StrategyParams): NegotiationStrategy {
  const {
    originalAppointment,
    delayMinutes,
    shipmentValue,
    retailer,
    contractRules,
    currentTime,
    driverHOS,
    estimatedDockDurationMinutes = 60,
  } = params;
  const origMins = parseTimeToMinutes(originalAppointment) || 0;

  // ==========================================================================
  // STEP 1: Calculate ACTUAL ARRIVAL TIME (when truck physically arrives)
  // ==========================================================================
  const actualArrivalMins = origMins + delayMinutes;

  // ==========================================================================
  // STEP 2: Create cost calculation function
  // ==========================================================================
  const calculateCostAt = (timeMinutes: number): number => {
    const result = calculateTotalCostImpact(
      {
        originalAppointmentTime: originalAppointment,
        newAppointmentTime: minutesToTime(timeMinutes),
        shipmentValue,
        retailer,
      },
      contractRules
    );
    return result.totalCost;
  };

  // ==========================================================================
  // STEP 3: Analyze cost curve to detect penalty structure
  // ==========================================================================
  const curveAnalysis = analyzeCostCurve(actualArrivalMins, calculateCostAt);

  // ==========================================================================
  // STEP 4: Set thresholds based on cost curve structure
  // ==========================================================================

  let idealTime: number;
  let idealDescription: string;
  let acceptableTime: number;
  let acceptableDescription: string;
  let problematicTime: number;
  let problematicDescription: string;

  if (curveAnalysis.hasStepJumps && curveAnalysis.firstSignificantJump) {
    // Strategy: Avoid crossing step jumps!
    const jump = curveAnalysis.firstSignificantJump;

    idealTime = curveAnalysis.zeroPenaltyEnd || actualArrivalMins;
    idealDescription = curveAnalysis.zeroPenaltyEnd
      ? 'No additional penalties'
      : 'Lowest achievable cost';

    // The "OK" zone extends until the step jump occurs
    // Use the jump time itself as the acceptable boundary (anything before is OK)
    // Ensure at least 15 minutes between ideal and acceptable thresholds
    acceptableTime = Math.max(jump.timeMinutes, idealTime + 15);
    acceptableDescription = 'Before major penalty increase';

    // Problematic zone: Look for NEXT step jump (like dwell time kicking in)
    // or use a reasonable default (2+ hours after first jump)
    const nextJump = curveAnalysis.stepJumps.length > 1
      ? curveAnalysis.stepJumps[1]
      : null;

    if (nextJump) {
      // There's another penalty tier (e.g., dwell time kicks in)
      problematicTime = nextJump.timeMinutes;
      problematicDescription = 'Multiple penalties stack';
    } else {
      // Use 2 hours after acceptable as worst case (dwell typically kicks in around here)
      problematicTime = Math.max(acceptableTime + 120, actualArrivalMins + 180);
      problematicDescription = 'Extended delay penalties';
    }

  } else if (curveAnalysis.isLinearGrowth) {
    // Strategy: Minimize linear cost growth - get close to arrival
    idealTime = actualArrivalMins + 30; // Small buffer after arrival
    idealDescription = 'Minimal delay cost';

    acceptableTime = actualArrivalMins + 120; // 2 hours tolerance
    acceptableDescription = 'Manageable cost increase';

    problematicTime = actualArrivalMins + 180; // Beyond 3 hours
    problematicDescription = 'High cumulative cost';

  } else {
    // Flat cost curve or minimal variation - any time is roughly equivalent
    idealTime = actualArrivalMins;
    idealDescription = 'Cost remains constant';

    acceptableTime = actualArrivalMins + 120;
    acceptableDescription = 'Flexible scheduling';

    problematicTime = actualArrivalMins + 240;
    problematicDescription = 'Extended delay';
  }

  // Calculate costs at threshold points
  // IMPORTANT: For step-jump scenarios, the "OK" cost should be the cost BEFORE the jump
  // (what you'd pay if you stay in OK zone), not the cost AT the boundary where penalties kick in
  const idealCost = calculateCostAt(idealTime);

  // For OK zone: if there's a step jump, show cost BEFORE the jump (typically same as ideal)
  // The acceptableTime is the boundary where penalties kick in, so subtract 1 minute to get pre-penalty cost
  const acceptableCost = curveAnalysis.hasStepJumps
    ? calculateCostAt(acceptableTime - 1)  // Cost just before the penalty threshold
    : calculateCostAt(acceptableTime);

  // For BAD zone: show the cost AT or AFTER the penalty threshold
  const problematicCost = calculateCostAt(problematicTime);

  // ==========================================================================
  // STEP 5: Calculate HOS constraints (Phase 10)
  // ==========================================================================

  let hosConstraints: HOSStrategyConstraints | undefined;

  if (driverHOS) {
    // HOS remaining should be measured from TRUCK ARRIVAL TIME, not current time
    // The user enters "remaining hours when driver arrives at warehouse"
    // So we calculate: arrival time + remaining - dock duration = latest feasible dock time

    // Find the binding HOS constraint
    const constraints: { name: string; remaining: number }[] = [
      { name: '14H_WINDOW', remaining: driverHOS.remainingWindowMinutes },
      { name: '11H_DRIVE', remaining: driverHOS.remainingDriveMinutes },
      { name: driverHOS.weekRule === '70_in_8' ? '70_IN_8' : '60_IN_7', remaining: driverHOS.remainingWeeklyMinutes },
    ];

    // Check if break is required
    const breakRequired = !driverHOS.shortHaulExempt && driverHOS.minutesSinceLastBreak >= 480;
    if (breakRequired) {
      constraints.push({ name: 'BREAK_REQUIRED', remaining: 0 });
    }

    // Sort by most limiting (lowest remaining time)
    constraints.sort((a, b) => a.remaining - b.remaining);
    const bindingConstraint = constraints[0];

    // Latest dock time = truck arrival time + remaining hours - dock duration
    // Example: Truck arrives 15:30, driver has 3h remaining, 1h dock time
    //          Latest dock = 15:30 + 3:00 - 1:00 = 17:30 (5:30 PM)
    const latestDockMinutes = Math.max(0, actualArrivalMins + bindingConstraint.remaining - estimatedDockDurationMinutes);
    const normalizedLatestMinutes = latestDockMinutes % (24 * 60);
    const latestFeasibleTime = minutesToTime(normalizedLatestMinutes);

    // Check if any dock time is feasible (HOS limit must be AFTER arrival)
    const requiresNextShift = latestDockMinutes <= actualArrivalMins;

    // Next shift earliest time (after 10h off-duty from arrival)
    let nextShiftEarliestTime: string | undefined;
    if (requiresNextShift) {
      const nextShiftMins = (actualArrivalMins + 600) % (24 * 60); // 10 hours off-duty
      nextShiftEarliestTime = minutesToTime(nextShiftMins);
    }

    hosConstraints = {
      latestFeasibleTime,
      latestFeasibleTimeMinutes: normalizedLatestMinutes,
      requiresNextShift,
      nextShiftEarliestTime,
      remainingWindowMinutes: driverHOS.remainingWindowMinutes,
      bindingConstraintRemainingMinutes: bindingConstraint.remaining,
      bindingConstraint: bindingConstraint.name,
    };

    // ==========================================================================
    // STEP 5.1: Apply HOS ceiling to cost-based thresholds
    // ==========================================================================

    if (!requiresNextShift) {
      // HOS provides an upper bound on all thresholds
      // If HOS limit is earlier than cost-based threshold, use HOS limit

      if (latestDockMinutes < idealTime) {
        idealTime = latestDockMinutes;
        idealDescription = `HOS limit: ${latestFeasibleTime}`;
      }

      if (latestDockMinutes < acceptableTime) {
        acceptableTime = Math.min(acceptableTime, latestDockMinutes);
        acceptableDescription = `HOS constrained: ${hosConstraints.bindingConstraint}`;
      }

      if (latestDockMinutes < problematicTime) {
        problematicTime = latestDockMinutes;
        problematicDescription = `HOS violation after ${latestFeasibleTime}`;
      }
    }
  }

  // ==========================================================================
  // STEP 6: Build strategy with dynamic descriptions
  // ==========================================================================

  return {
    thresholds: {
      ideal: {
        maxMinutes: idealTime,
        description: idealDescription,
        costImpact: `$${idealCost.toLocaleString()}`,
      },
      acceptable: {
        maxMinutes: acceptableTime,
        description: acceptableDescription,
        costImpact: `$${acceptableCost.toLocaleString()}`,
      },
      problematic: {
        maxMinutes: problematicTime,
        description: problematicDescription,
        costImpact: `Up to $${problematicCost.toLocaleString()}`,
      },
    },
    costThresholds: {
      ideal: idealCost,
      acceptable: acceptableCost,
      reluctant: acceptableCost + (problematicCost - acceptableCost) * 0.5,
    },
    maxPushbackAttempts: 2,
    display: {
      // Round all display times to 5-minute intervals for cleaner UI
      idealBefore: roundTimeToFiveMinutes(minutesToTime(idealTime)),
      acceptableBefore: roundTimeToFiveMinutes(minutesToTime(acceptableTime)),
      problematicAfter: roundTimeToFiveMinutes(minutesToTime(problematicTime)),
      actualArrivalTime: roundTimeToFiveMinutes(minutesToTime(actualArrivalMins)),
    },
    // Include HOS constraints if driver HOS was provided
    hosConstraints,
  };
}

/**
 * Get current time in minutes from midnight
 */
function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Evaluate an offered time slot against the negotiation strategy
 *
 * @param timeOffered - Time string offered by warehouse
 * @param cost - Calculated cost impact of this time
 * @param strategy - Current negotiation strategy
 * @param negotiationState - Current state (pushback count, etc.)
 * @returns Evaluation with recommendation
 */
export function evaluateOffer(
  timeOffered: string,
  cost: number,
  strategy: NegotiationStrategy,
  negotiationState: NegotiationState
): OfferEvaluation {
  const mins = parseTimeToMinutes(timeOffered);

  if (mins === null) {
    return {
      quality: 'UNKNOWN',
      shouldAccept: false,
      shouldPushback: false,
      reason: 'Could not parse offered time',
    };
  }

  const { thresholds, costThresholds, maxPushbackAttempts } = strategy;
  const pushbacksUsed = negotiationState.pushbackCount || 0;

  // IDEAL: Within compliance window and cost at/below ideal threshold
  if (mins <= thresholds.ideal.maxMinutes && cost <= costThresholds.ideal) {
    return {
      quality: 'IDEAL',
      shouldAccept: true,
      shouldPushback: false,
      reason: cost === 0 ? 'No cost impact' : 'Minimal cost impact',
    };
  }

  // ACCEPTABLE: Within acceptable range and reasonable cost
  if (mins <= thresholds.acceptable.maxMinutes && cost <= costThresholds.acceptable) {
    return {
      quality: 'ACCEPTABLE',
      shouldAccept: true,
      shouldPushback: false,
      reason: 'Acceptable timeframe and cost',
    };
  }

  // SUBOPTIMAL: Time is past acceptable deadline OR cost exceeds reluctant threshold
  // This is the key fix: we must check BOTH time AND cost, not just cost
  const timeTooLate = mins > thresholds.acceptable.maxMinutes;
  const costTooHigh = cost > costThresholds.reluctant;

  if ((timeTooLate || costTooHigh) && pushbacksUsed < maxPushbackAttempts) {
    return {
      quality: 'SUBOPTIMAL',
      shouldAccept: false,
      shouldPushback: true,
      reason: timeTooLate ? 'Time too late, attempting negotiation' : 'Cost too high, attempting negotiation',
    };
  }

  // UNACCEPTABLE but out of pushbacks: Must accept reluctantly
  if (timeTooLate || costTooHigh) {
    return {
      quality: 'UNACCEPTABLE',
      shouldAccept: true,
      shouldPushback: false,
      reason: 'No better options, must accept',
    };
  }

  // Default: Within acceptable range (time and cost both OK)
  return {
    quality: 'ACCEPTABLE',
    shouldAccept: true,
    shouldPushback: false,
    reason: 'Within acceptable range',
  };
}

/**
 * Get a human-readable summary of the offer evaluation
 *
 * @param evaluation - Offer evaluation result
 * @param cost - Cost impact
 * @returns Summary string for display
 */
export function getEvaluationSummary(evaluation: OfferEvaluation, cost: number): string {
  const action = evaluation.shouldAccept
    ? 'Accept'
    : evaluation.shouldPushback
      ? 'Negotiate'
      : 'Evaluate';

  return `${evaluation.quality} ($${cost}) - ${action}: ${evaluation.reason}`;
}

// ============================================================================
// Multi-Day Evaluation Functions (Phase 11)
// ============================================================================

/** Extended offer evaluation that includes day offset context */
export interface OfferEvaluationMultiDay extends OfferEvaluation {
  /** Day offset of the offered time (0 = today, 1 = tomorrow) */
  dayOffset: number;
  /** Formatted time string including day context */
  formattedTime: string;
  /** Is this a next-day offer? */
  isNextDay: boolean;
}

/**
 * Evaluate an offered time slot with multi-day support
 *
 * This function correctly handles scenarios where the warehouse offers
 * a time slot for the next day or beyond. It uses absolute minutes
 * for comparison to avoid negative time differences.
 *
 * @param timeOffered - Time string offered by warehouse (HH:MM)
 * @param dayOffset - Day offset of offered time (0 = today, 1 = tomorrow)
 * @param cost - Calculated cost impact (from calculateTotalCostImpactMultiDay)
 * @param strategy - Current negotiation strategy
 * @param negotiationState - Current state (pushback count, etc.)
 * @returns Extended evaluation with day context
 *
 * @example
 * // Same-day offer
 * evaluateOfferMultiDay("15:30", 0, 90, strategy, state)
 *
 * // Tomorrow morning offer
 * evaluateOfferMultiDay("06:00", 1, 960, strategy, state)
 */
export function evaluateOfferMultiDay(
  timeOffered: string,
  dayOffset: number,
  cost: number,
  strategy: NegotiationStrategy,
  negotiationState: NegotiationState
): OfferEvaluationMultiDay {
  const mins = parseTimeToMinutes(timeOffered);

  if (mins === null) {
    return {
      quality: 'UNKNOWN',
      shouldAccept: false,
      shouldPushback: false,
      reason: 'Could not parse offered time',
      dayOffset,
      formattedTime: timeOffered,
      isNextDay: dayOffset > 0,
    };
  }

  // Convert to absolute minutes for comparison
  const absoluteMins = toAbsoluteMinutes(timeOffered, dayOffset) ?? mins;

  const { thresholds, costThresholds, maxPushbackAttempts } = strategy;
  const pushbacksUsed = negotiationState.pushbackCount || 0;

  // Format time for display
  const formattedTime = formatTimeWithDayOffset(timeOffered, dayOffset);

  // For multi-day scenarios, thresholds are still in same-day minutes
  // We need to compare appropriately
  // If dayOffset > 0, the offer is for a future day, which means it's
  // definitely past all same-day thresholds

  // IDEAL: Within compliance window and cost at/below ideal threshold
  if (absoluteMins <= thresholds.ideal.maxMinutes && cost <= costThresholds.ideal) {
    return {
      quality: 'IDEAL',
      shouldAccept: true,
      shouldPushback: false,
      reason: cost === 0 ? 'No cost impact' : 'Minimal cost impact',
      dayOffset,
      formattedTime,
      isNextDay: dayOffset > 0,
    };
  }

  // ACCEPTABLE: Within acceptable range and reasonable cost
  if (absoluteMins <= thresholds.acceptable.maxMinutes && cost <= costThresholds.acceptable) {
    return {
      quality: 'ACCEPTABLE',
      shouldAccept: true,
      shouldPushback: false,
      reason: 'Acceptable timeframe and cost',
      dayOffset,
      formattedTime,
      isNextDay: dayOffset > 0,
    };
  }

  // SUBOPTIMAL: Time is past acceptable deadline OR cost exceeds reluctant threshold
  const timeTooLate = absoluteMins > thresholds.acceptable.maxMinutes;
  const costTooHigh = cost > costThresholds.reluctant;

  // For next-day offers, we may want to be more lenient if same-day is impossible
  // but still push back if we can get a better next-day time
  if ((timeTooLate || costTooHigh) && pushbacksUsed < maxPushbackAttempts) {
    const reason = dayOffset > 0
      ? 'Next-day offer, attempting to get earlier time'
      : timeTooLate
        ? 'Time too late, attempting negotiation'
        : 'Cost too high, attempting negotiation';

    return {
      quality: 'SUBOPTIMAL',
      shouldAccept: false,
      shouldPushback: true,
      reason,
      dayOffset,
      formattedTime,
      isNextDay: dayOffset > 0,
    };
  }

  // UNACCEPTABLE but out of pushbacks: Must accept reluctantly
  if (timeTooLate || costTooHigh) {
    return {
      quality: 'UNACCEPTABLE',
      shouldAccept: true,
      shouldPushback: false,
      reason: dayOffset > 0 ? 'Next-day is best available' : 'No better options, must accept',
      dayOffset,
      formattedTime,
      isNextDay: dayOffset > 0,
    };
  }

  // Default: Within acceptable range (time and cost both OK)
  return {
    quality: 'ACCEPTABLE',
    shouldAccept: true,
    shouldPushback: false,
    reason: 'Within acceptable range',
    dayOffset,
    formattedTime,
    isNextDay: dayOffset > 0,
  };
}

/**
 * Get suggested counter-offer time, potentially for next day if needed
 *
 * @param strategy - Current negotiation strategy
 * @param currentDayOffset - Day offset of current offer (to know context)
 * @returns Suggested counter-offer time and day offset
 */
export function getSuggestedCounterOfferMultiDay(
  strategy: NegotiationStrategy,
  currentDayOffset: number = 0
): { time: string; dayOffset: number; formatted: string } {
  // Prefer ideal threshold time
  const idealMins = strategy.thresholds.ideal.maxMinutes;
  const idealTime = roundTimeToFiveMinutes(minutesToTime(idealMins % (24 * 60)));

  // If ideal time requires next day (mins > 1440) or if we're already in next-day context
  const idealDayOffset = Math.floor(idealMins / (24 * 60));
  const effectiveDayOffset = Math.max(currentDayOffset, idealDayOffset);

  return {
    time: idealTime,
    dayOffset: effectiveDayOffset,
    formatted: formatTimeWithDayOffset(idealTime, effectiveDayOffset),
  };
}
