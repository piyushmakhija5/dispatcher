// Deterministic cost calculation engine for the Dispatcher AI
// Extracted from LiveDispatcherAgentVapi.jsx (lines 25-115)

import type {
  ContractRules,
  DwellTimeRules,
  DwellTimeCostResult,
  OTIFPenaltyResult,
  RetailerChargebacks,
  TotalCostImpactResult,
  CostCalculationParams,
  CostCalculationParamsWithTerms,
} from '@/types/cost';
import { DEFAULT_CONTRACT_RULES } from '@/types/cost';
import type { Retailer } from '@/types/dispatch';
import type { ExtractedContractTerms } from '@/types/contract';
import { parseTimeToMinutes } from './time-parser';

/**
 * Convert ExtractedContractTerms to legacy ContractRules format
 * Provides backward compatibility with existing cost calculation functions
 *
 * @param terms - LLM-extracted contract terms
 * @param partyName - Optional party name for penalty lookup
 * @returns ContractRules in legacy format, or DEFAULT_CONTRACT_RULES if conversion fails
 */
export function convertExtractedTermsToRules(
  terms: ExtractedContractTerms | undefined,
  partyName?: string
): ContractRules {
  if (!terms) {
    console.warn('[Cost Engine] No extracted terms provided, using DEFAULT_CONTRACT_RULES');
    return DEFAULT_CONTRACT_RULES;
  }

  try {
    // Convert delay penalties to dwell time rules
    const dwellTime: DwellTimeRules = convertDelayPenaltiesToDwellRules(terms);

    // Convert compliance windows to OTIF rules
    const otifWindowMinutes =
      terms.complianceWindows?.[0]?.windowMinutes ??
      DEFAULT_CONTRACT_RULES.otif.windowMinutes;

    // Convert party penalties to retailer chargebacks
    const retailerChargebacks: RetailerChargebacks = convertPartyPenaltiesToChargebacks(
      terms,
      partyName
    );

    return {
      dwellTime,
      otif: { windowMinutes: otifWindowMinutes },
      retailerChargebacks,
    };
  } catch (error) {
    console.error('[Cost Engine] Error converting extracted terms:', error);
    return DEFAULT_CONTRACT_RULES;
  }
}

/**
 * Convert delayPenalties array to DwellTimeRules
 * Uses the first detention/dwell penalty found, or creates empty rules
 */
function convertDelayPenaltiesToDwellRules(terms: ExtractedContractTerms): DwellTimeRules {
  const delayPenalty = terms.delayPenalties?.find(
    (p) => p.name.toLowerCase().includes('dwell') || p.name.toLowerCase().includes('detention')
  );

  if (!delayPenalty || !delayPenalty.tiers || delayPenalty.tiers.length === 0) {
    console.warn('[Cost Engine] No dwell/detention penalties found, using defaults');
    return DEFAULT_CONTRACT_RULES.dwellTime;
  }

  const freeHours = delayPenalty.freeTimeMinutes / 60;
  const tiers = delayPenalty.tiers.map((tier) => ({
    fromHours: tier.fromMinutes / 60,
    toHours: tier.toMinutes ? tier.toMinutes / 60 : Infinity,
    ratePerHour: tier.ratePerHour,
  }));

  return { freeHours, tiers };
}

/**
 * Convert partyPenalties array to RetailerChargebacks
 * Looks for penalties matching the given party name
 */
function convertPartyPenaltiesToChargebacks(
  terms: ExtractedContractTerms,
  partyName?: string
): RetailerChargebacks {
  const chargebacks: Partial<RetailerChargebacks> = {};

  if (!terms.partyPenalties || terms.partyPenalties.length === 0) {
    console.warn('[Cost Engine] No party penalties found, using defaults');
    return DEFAULT_CONTRACT_RULES.retailerChargebacks;
  }

  // Find penalties for the specified party
  const relevantPenalties = partyName
    ? terms.partyPenalties.filter((p) =>
        p.partyName.toLowerCase().includes(partyName.toLowerCase())
      )
    : terms.partyPenalties;

  // Group penalties by party name
  const penaltiesByParty: Record<string, typeof relevantPenalties> = {};
  for (const penalty of relevantPenalties) {
    if (!penaltiesByParty[penalty.partyName]) {
      penaltiesByParty[penalty.partyName] = [];
    }
    penaltiesByParty[penalty.partyName].push(penalty);
  }

  // Convert to RetailerChargebacks format
  for (const [party, penalties] of Object.entries(penaltiesByParty)) {
    const chargeback: {
      otifPercentage?: number;
      flatFee?: number;
      perOccurrence?: number;
    } = {};

    // Aggregate penalties for this party
    for (const penalty of penalties) {
      if (penalty.percentage) chargeback.otifPercentage = penalty.percentage;
      if (penalty.flatFee) chargeback.flatFee = (chargeback.flatFee || 0) + penalty.flatFee;
      if (penalty.perOccurrence) {
        chargeback.perOccurrence = (chargeback.perOccurrence || 0) + penalty.perOccurrence;
      }
    }

    // Map to Retailer type (use first matching party name or default)
    const retailerKey = party as Retailer;
    chargebacks[retailerKey] = chargeback;
  }

  // If no chargebacks found, return defaults
  if (Object.keys(chargebacks).length === 0) {
    console.warn('[Cost Engine] No matching party penalties found, using defaults');
    return DEFAULT_CONTRACT_RULES.retailerChargebacks;
  }

  return chargebacks as RetailerChargebacks;
}

/**
 * Calculate dwell time cost based on tiered rates
 *
 * @param totalDwellHours - Total hours of dwell time
 * @param dwellRules - Rules defining free hours and tier rates
 * @returns Total cost and breakdown by tier
 */
export function calculateDwellTimeCost(
  totalDwellHours: number,
  dwellRules: DwellTimeRules
): DwellTimeCostResult {
  if (!dwellRules?.tiers) {
    return { total: 0, breakdown: [] };
  }

  const freeHours = dwellRules.freeHours || 0;
  if (totalDwellHours <= freeHours) {
    return { total: 0, breakdown: [] };
  }

  let remaining = totalDwellHours - freeHours;
  let totalCost = 0;
  const breakdown: DwellTimeCostResult['breakdown'] = [];

  // Sort tiers by fromHours and calculate costs
  const sortedTiers = [...dwellRules.tiers].sort((a, b) => a.fromHours - b.fromHours);

  for (const tier of sortedTiers) {
    if (remaining <= 0) break;

    const tierSpan = (tier.toHours || Infinity) - tier.fromHours;
    const hours = Math.min(remaining, tierSpan);

    if (hours > 0) {
      const cost = hours * tier.ratePerHour;
      totalCost += cost;
      breakdown.push({
        hours: Math.round(hours * 100) / 100,
        rate: tier.ratePerHour,
        cost: Math.round(cost * 100) / 100,
      });
      remaining -= hours;
    }
  }

  return {
    total: Math.round(totalCost * 100) / 100,
    breakdown,
  };
}

/**
 * Calculate OTIF (On-Time In-Full) penalties based on retailer rules
 *
 * @param isLate - Whether the delivery is outside OTIF window
 * @param shipmentValue - Value of the shipment in dollars
 * @param retailer - Retailer name for chargeback lookup
 * @param retailerRules - Rules for each retailer's chargebacks
 * @returns Total penalty and breakdown
 */
export function calculateOTIFPenalty(
  isLate: boolean,
  shipmentValue: number,
  retailer: Retailer,
  retailerRules: RetailerChargebacks
): OTIFPenaltyResult {
  if (!isLate) {
    return { total: 0, breakdown: [], isCompliant: true };
  }

  const breakdown: OTIFPenaltyResult['breakdown'] = [];
  let total = 0;
  const rules = retailerRules?.[retailer];

  if (rules?.otifPercentage) {
    const cost = shipmentValue * (rules.otifPercentage / 100);
    total += cost;
    breakdown.push({
      description: `${retailer} ${rules.otifPercentage}%`,
      cost: Math.round(cost * 100) / 100,
    });
  }

  if (rules?.flatFee) {
    total += rules.flatFee;
    breakdown.push({
      description: `${retailer} flat`,
      cost: rules.flatFee,
    });
  }

  if (rules?.perOccurrence) {
    total += rules.perOccurrence;
    breakdown.push({
      description: `${retailer} occurrence`,
      cost: rules.perOccurrence,
    });
  }

  return {
    total: Math.round(total * 100) / 100,
    breakdown,
    isCompliant: false,
  };
}

/**
 * Calculate the total cost impact of a schedule change
 *
 * @param params - Original and new appointment times, shipment details
 * @param rules - Contract rules for cost calculations
 * @returns Complete cost analysis with all calculations
 */
export function calculateTotalCostImpact(
  params: CostCalculationParams,
  rules: ContractRules
): TotalCostImpactResult {
  const { originalAppointmentTime, newAppointmentTime, shipmentValue, retailer } = params;

  const results: TotalCostImpactResult = {
    calculations: {},
    totalCost: 0,
  };

  const orig = parseTimeToMinutes(originalAppointmentTime);
  const newT = parseTimeToMinutes(newAppointmentTime);

  if (orig !== null && newT !== null) {
    const diffMin = newT - orig;
    const diffHrs = diffMin / 60;

    results.calculations.timeDifference = {
      originalTime: originalAppointmentTime,
      newTime: newAppointmentTime,
      differenceMinutes: diffMin,
      differenceHours: Math.round(diffHrs * 100) / 100,
    };

    // Calculate dwell time costs (only if delay is positive)
    if (rules.dwellTime && diffHrs > 0) {
      const dwell = calculateDwellTimeCost(diffHrs, rules.dwellTime);
      results.calculations.dwellTime = dwell;
      results.totalCost += dwell.total;
    }

    // Calculate OTIF penalties
    const otifWindow = rules.otif?.windowMinutes || 30;
    const isLate = diffMin > otifWindow;
    const otif = calculateOTIFPenalty(isLate, shipmentValue, retailer, rules.retailerChargebacks);

    results.calculations.otif = {
      ...otif,
      windowMinutes: otifWindow,
      outsideWindow: isLate,
    };
    results.totalCost += otif.total;
  }

  results.totalCost = Math.round(results.totalCost * 100) / 100;
  return results;
}

/**
 * Calculate the total cost impact using dynamically extracted contract terms
 * Phase 7.4+: Works with LLM-extracted terms from contract analysis
 *
 * @param params - Appointment times, shipment details, and extracted contract terms
 * @returns Complete cost analysis with all calculations
 */
export function calculateTotalCostImpactWithTerms(
  params: CostCalculationParamsWithTerms
): TotalCostImpactResult {
  const { originalAppointmentTime, newAppointmentTime, shipmentValue, extractedTerms, partyName } =
    params;

  // Convert extracted terms to legacy format (gracefully handles missing/invalid terms)
  const rules = convertExtractedTermsToRules(extractedTerms, partyName);

  // Use existing calculation logic with converted rules
  const legacyParams: CostCalculationParams = {
    originalAppointmentTime,
    newAppointmentTime,
    shipmentValue,
    retailer: (partyName || 'Walmart') as Retailer, // Fallback to Walmart if no party specified
  };

  return calculateTotalCostImpact(legacyParams, rules);
}

/**
 * Helper to check if extracted terms are usable for cost calculations
 * Returns validation status and warnings
 */
export function validateExtractedTermsForCostCalculation(
  terms: ExtractedContractTerms | undefined
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!terms) {
    warnings.push('No extracted terms provided - will use default contract rules');
    return { valid: false, warnings };
  }

  // Check for delay penalties
  if (!terms.delayPenalties || terms.delayPenalties.length === 0) {
    warnings.push('No delay penalties found - will use default dwell time rules');
  } else {
    const hasDwellOrDetention = terms.delayPenalties.some(
      (p) => p.name.toLowerCase().includes('dwell') || p.name.toLowerCase().includes('detention')
    );
    if (!hasDwellOrDetention) {
      warnings.push('No dwell/detention penalties found - will use default dwell time rules');
    }
  }

  // Check for compliance windows
  if (!terms.complianceWindows || terms.complianceWindows.length === 0) {
    warnings.push('No compliance windows found - will use default OTIF window (30 minutes)');
  }

  // Check for party penalties
  if (!terms.partyPenalties || terms.partyPenalties.length === 0) {
    warnings.push('No party penalties found - will use default retailer chargebacks');
  }

  // Terms are usable if we have at least one section
  const valid =
    !!terms.delayPenalties?.length ||
    !!terms.complianceWindows?.length ||
    !!terms.partyPenalties?.length;

  return { valid, warnings };
}
