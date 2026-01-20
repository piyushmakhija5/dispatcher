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
 * Create a negotiation strategy by CALCULATING actual costs at key time points.
 *
 * This is GENERIC - it doesn't assume any specific cost structure (OTIF, dwell, etc).
 * Instead, it calculates the real costs using the contract rules and sets thresholds
 * based on those actual calculations.
 *
 * @param params - All parameters needed to calculate costs
 * @returns Complete negotiation strategy with thresholds derived from actual costs
 */
export function createNegotiationStrategy(params: StrategyParams): NegotiationStrategy {
  const { originalAppointment, delayMinutes, shipmentValue, retailer, contractRules } = params;
  const origMins = parseTimeToMinutes(originalAppointment) || 0;

  // ==========================================================================
  // CALCULATE KEY TIME POINTS based on contract rules (not hardcoded)
  // ==========================================================================

  // Compliance window (could be OTIF, could be something else, could be 0)
  const complianceWindow = contractRules.otif?.windowMinutes || 0;
  const idealDeadline = origMins + complianceWindow;

  // Free dwell time period (time before dwell charges kick in)
  const freeDwellHours = contractRules.dwellTime?.freeHours || 2;
  const acceptableDeadline = origMins + (freeDwellHours * 60);

  // Worst case: if truck arrives at maximum expected delay
  const worstCaseTime = origMins + delayMinutes;

  // ==========================================================================
  // CALCULATE ACTUAL COSTS at each time point using the cost engine
  // ==========================================================================

  const calculateCostAt = (timeMinutes: number) => {
    return calculateTotalCostImpact(
      {
        originalAppointmentTime: originalAppointment,
        newAppointmentTime: minutesToTime(timeMinutes),
        shipmentValue,
        retailer,
      },
      contractRules
    );
  };

  // Cost at ideal deadline (should be $0 if within compliance window)
  const idealCostResult = calculateCostAt(idealDeadline);
  const idealCost = idealCostResult.totalCost;

  // Cost at acceptable deadline (after compliance window, before dwell charges)
  const acceptableCostResult = calculateCostAt(acceptableDeadline);
  const acceptableCost = acceptableCostResult.totalCost;

  // Cost at worst case time
  const worstCostResult = calculateCostAt(worstCaseTime);
  const worstCost = worstCostResult.totalCost;

  // ==========================================================================
  // SET THRESHOLDS based on ACTUAL calculated costs
  // ==========================================================================

  // IDEAL: No cost (or minimal cost at compliance deadline)
  const idealThreshold = idealCost;

  // ACCEPTABLE: Cost at acceptable deadline (penalties may apply, but no dwell charges)
  const acceptableThreshold = acceptableCost;

  // RELUCTANT: Halfway between acceptable and worst case
  // If acceptable and worst are the same, add 10% buffer
  const reluctantThreshold = acceptableCost === worstCost
    ? acceptableCost * 1.1
    : acceptableCost + (worstCost - acceptableCost) * 0.5;

  // ==========================================================================
  // BUILD STRATEGY with generic descriptions
  // ==========================================================================

  return {
    thresholds: {
      ideal: {
        maxMinutes: idealDeadline,
        description: idealCost === 0 ? 'No penalties' : 'Minimal cost',
        costImpact: idealCost === 0 ? '$0' : `$${idealCost.toLocaleString()}`,
      },
      acceptable: {
        maxMinutes: acceptableDeadline,
        description: 'Within tolerance',
        costImpact: `$${acceptableCost.toLocaleString()}`,
      },
      problematic: {
        maxMinutes: worstCaseTime,
        description: 'High cost impact',
        costImpact: `Up to $${worstCost.toLocaleString()}`,
      },
    },
    costThresholds: {
      ideal: idealThreshold,
      acceptable: acceptableThreshold,
      reluctant: reluctantThreshold,
    },
    maxPushbackAttempts: 2,
    display: {
      idealBefore: minutesToTime(idealDeadline),
      acceptableBefore: minutesToTime(acceptableDeadline),
      worstCaseArrival: minutesToTime(worstCaseTime),
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
