// Cost calculation types for the Dispatcher AI

import type { Retailer } from './dispatch';
import type { ExtractedContractTerms } from './contract';

/** A single tier in the dwell time charge structure */
export interface DwellTimeTier {
  fromHours: number;
  toHours: number;
  ratePerHour: number;
}

/** Dwell time rules from the contract */
export interface DwellTimeRules {
  freeHours: number;
  tiers: DwellTimeTier[];
}

/** OTIF (On-Time In-Full) rules */
export interface OTIFRules {
  windowMinutes: number;
}

/** Retailer-specific chargeback rules */
export interface RetailerChargebackRule {
  otifPercentage?: number;
  flatFee?: number;
  perOccurrence?: number;
}

/** Map of retailer names to their chargeback rules */
export type RetailerChargebacks = Record<Retailer, RetailerChargebackRule>;

/** Complete contract rules for cost calculations */
export interface ContractRules {
  dwellTime: DwellTimeRules;
  otif: OTIFRules;
  retailerChargebacks: RetailerChargebacks;
}

/** A single line item in the dwell time cost breakdown */
export interface DwellTimeCostItem {
  hours: number;
  rate: number;
  cost: number;
}

/** Result of dwell time cost calculation */
export interface DwellTimeCostResult {
  total: number;
  breakdown: DwellTimeCostItem[];
}

/** A single line item in the OTIF penalty breakdown */
export interface OTIFPenaltyItem {
  description: string;
  cost: number;
}

/** Result of OTIF penalty calculation */
export interface OTIFPenaltyResult {
  total: number;
  breakdown: OTIFPenaltyItem[];
  isCompliant: boolean;
}

/** Time difference calculation between original and new appointment */
export interface TimeDifferenceResult {
  originalTime: string;
  newTime: string;
  differenceMinutes: number;
  differenceHours: number;
  /** Day offset of the new time (0 = same day, 1 = tomorrow, etc.) */
  dayOffset?: number;
}

/** Extended OTIF result with window information */
export interface OTIFCalculationResult extends OTIFPenaltyResult {
  windowMinutes: number;
  outsideWindow: boolean;
}

/** All calculations that make up the total cost impact */
export interface CostCalculations {
  timeDifference?: TimeDifferenceResult;
  dwellTime?: DwellTimeCostResult;
  otif?: OTIFCalculationResult;
}

/** HOS impact on cost (when next shift required) */
export interface HOSCostImpact {
  /** Is the proposed time feasible in current shift? */
  feasibleInCurrentShift: boolean;
  /** If next shift required, additional costs */
  nextShiftCost?: {
    driverDetentionHours: number;
    detentionRatePerHour: number;
    detentionCost: number;
    layoverRequired: boolean;
    layoverCost: number;
    totalNextShiftPremium: number;
  };
  /** Adjusted total cost including HOS premium */
  adjustedTotalCost: number;
  /** Binding HOS constraint (if any) */
  bindingConstraint?: string;
  /** Latest legal dock time based on HOS */
  latestLegalDockTime?: string;
}

/** Complete result of total cost impact calculation */
export interface TotalCostImpactResult {
  calculations: CostCalculations;
  totalCost: number;
  /** HOS impact analysis (Phase 10) */
  hosImpact?: HOSCostImpact;
}

/** Parameters needed for cost impact calculation */
export interface CostCalculationParams {
  originalAppointmentTime: string;
  newAppointmentTime: string;
  shipmentValue: number;
  retailer: Retailer;
}

/**
 * Extended parameters with dynamic contract terms (Phase 7.4+)
 * Uses LLM-extracted terms instead of hardcoded rules
 */
export interface CostCalculationParamsWithTerms {
  originalAppointmentTime: string;
  newAppointmentTime: string;
  shipmentValue: number;
  /**
   * Extracted contract terms from LLM analysis.
   * If not provided, empty rules are used (missing sections = $0 cost).
   * We do NOT use fake "default" values as that leads to incorrect analysis.
   */
  extractedTerms?: ExtractedContractTerms;
  /** Optional: party name for penalty lookup (e.g., "Walmart", "Consignee") */
  partyName?: string;
}

/**
 * Parameters for multi-day cost calculation (Phase 11)
 * Extends CostCalculationParams with day offset support
 */
export interface CostCalculationParamsMultiDay extends CostCalculationParams {
  /** Day offset of the offered time (0 = same day, 1 = tomorrow) */
  offeredDayOffset?: number;
}

/**
 * Parameters for multi-day cost calculation with extracted terms
 */
export interface CostCalculationParamsWithTermsMultiDay extends CostCalculationParamsWithTerms {
  /** Day offset of the offered time (0 = same day, 1 = tomorrow) */
  offeredDayOffset?: number;
}

/**
 * @deprecated DO NOT USE - These are fake hardcoded values that lead to incorrect analysis.
 * 
 * This constant is ONLY kept for backward compatibility with old test files.
 * Production code should NEVER use this - use ExtractedContractTerms from LLM analysis.
 * 
 * If contract extraction fails or terms are missing, use EMPTY rules ($0 cost)
 * rather than these fake "defaults" that don't reflect the actual contract.
 */
export const DEFAULT_CONTRACT_RULES: ContractRules = {
  dwellTime: {
    freeHours: 2,
    tiers: [
      { fromHours: 2, toHours: 4, ratePerHour: 50 },
      { fromHours: 4, toHours: 6, ratePerHour: 65 },
      { fromHours: 6, toHours: Infinity, ratePerHour: 75 },
    ],
  },
  otif: { windowMinutes: 30 },
  retailerChargebacks: {
    Walmart: { otifPercentage: 3, flatFee: 200 },
    Target: { otifPercentage: 5, flatFee: 150 },
    Amazon: { perOccurrence: 500 },
    Costco: { otifPercentage: 2, flatFee: 100 },
    Kroger: { perOccurrence: 250 },
  },
};

/** Contract text for display purposes */
export const CONTRACT_TEXT = `3.3 Dwell Time Charges:
- 0-2 hours: Free Time
- 2:01-4 hours: $50/hour
- 4:01-6 hours: $65/hour
- Over 6 hours: $75/hour

3.1 OTIF: Arrival within 30 minutes of scheduled time

3.7 Retailer Chargebacks:
- Walmart: 3% of invoice + $200 missed MABD
- Target: 5% of PO + $150 rescheduling
- Amazon: $500 per occurrence
- Costco: 2% of invoice + $100 late arrival
- Kroger: $250 per occurrence`;
