// Negotiation strategy engine for the Dispatcher AI
// GENERIC: Works with any contract rules, not hardcoded for OTIF

import { parseTimeToMinutes, minutesToTime } from './time-parser';
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
  worstCaseArrival: string;
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

/** Complete negotiation strategy */
export interface NegotiationStrategy {
  thresholds: NegotiationThresholds;
  costThresholds: CostThresholds;
  maxPushbackAttempts: number;
  display: StrategyDisplay;
}

/** Result of evaluating an offer */
export interface OfferEvaluation {
  quality: OfferQuality;
  shouldAccept: boolean;
  shouldPushback: boolean;
  reason: string;
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
  const { originalAppointment, delayMinutes, shipmentValue, retailer, contractRules } = params;
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

    // Try to stay just before the first major step jump
    acceptableTime = jump.timeMinutes - 15; // 15 min before jump
    acceptableDescription = 'Before major penalty increase';

    problematicTime = jump.timeMinutes + 30; // After the jump
    problematicDescription = 'After penalty threshold';

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
  const idealCost = calculateCostAt(idealTime);
  const acceptableCost = calculateCostAt(acceptableTime);
  const problematicCost = calculateCostAt(problematicTime);

  // ==========================================================================
  // STEP 5: Build strategy with dynamic descriptions
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
      idealBefore: minutesToTime(idealTime),
      acceptableBefore: minutesToTime(acceptableTime),
      worstCaseArrival: minutesToTime(problematicTime),
      actualArrivalTime: minutesToTime(actualArrivalMins),
    },
  };
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
