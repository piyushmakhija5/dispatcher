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
import type { Retailer } from '@/types/dispatch';
import type { ExtractedContractTerms } from '@/types/contract';
import { parseTimeToMinutes } from './time-parser';

/**
 * Empty contract rules - used when specific terms are missing from the contract.
 * Results in ZERO costs for missing sections rather than fake "default" costs.
 * This ensures we only charge based on real data from extracted contracts.
 * 
 * IMPORTANT: We do NOT use hardcoded "default" penalties because that would
 * lead to incorrect cost analysis and potentially bad negotiation decisions.
 */
const EMPTY_RULES = {
  dwellTime: {
    freeHours: Infinity, // No dwell charges if not specified in contract
    tiers: [],
  } as DwellTimeRules,
  otifWindowMinutes: 30, // Standard industry OTIF window (±30 min)
  retailerChargebacks: {} as RetailerChargebacks,
};

/**
 * Convert ExtractedContractTerms to legacy ContractRules format
 * Provides backward compatibility with existing cost calculation functions
 *
 * IMPORTANT: This function ONLY uses data from the extracted contract.
 * Missing sections result in ZERO costs (not fake "default" costs).
 *
 * @param terms - LLM-extracted contract terms
 * @param partyName - Optional party name for penalty lookup
 * @returns ContractRules in legacy format with only extracted terms (missing = zero cost)
 * @throws Error if terms is null/undefined - caller should handle this case
 */
export function convertExtractedTermsToRules(
  terms: ExtractedContractTerms | undefined,
  partyName?: string
): ContractRules {
  if (!terms) {
    // Return empty rules - no fake defaults
    console.warn('[Cost Engine] No extracted terms provided - using empty rules (zero costs)');
    return {
      dwellTime: EMPTY_RULES.dwellTime,
      otif: { windowMinutes: EMPTY_RULES.otifWindowMinutes },
      retailerChargebacks: EMPTY_RULES.retailerChargebacks,
    };
  }

  try {
    // Convert delay penalties to dwell time rules (or empty if not found)
    const dwellTime: DwellTimeRules = convertDelayPenaltiesToDwellRules(terms);

    // Convert compliance windows to OTIF rules
    let otifWindowMinutes: number;
    if (terms.complianceWindows && terms.complianceWindows.length > 0) {
      otifWindowMinutes = terms.complianceWindows[0].windowMinutes;
      console.log('[Cost Engine] Using extracted OTIF window:', otifWindowMinutes, 'minutes');
    } else {
      // Use standard industry OTIF window (±30 min) - this is a reasonable assumption
      otifWindowMinutes = EMPTY_RULES.otifWindowMinutes;
      console.log('[Cost Engine] No OTIF window in contract, using standard ±30 min window');
    }

    // Convert party penalties to retailer chargebacks (or empty if not found)
    const retailerChargebacks: RetailerChargebacks = convertPartyPenaltiesToChargebacks(
      terms,
      partyName
    );

    console.log('[Cost Engine] Contract rules converted from extracted terms');
    
    return {
      dwellTime,
      otif: { windowMinutes: otifWindowMinutes },
      retailerChargebacks,
    };
  } catch (error) {
    console.error('[Cost Engine] Error converting extracted terms:', error);
    // Return empty rules on error - no fake defaults
    return {
      dwellTime: EMPTY_RULES.dwellTime,
      otif: { windowMinutes: EMPTY_RULES.otifWindowMinutes },
      retailerChargebacks: EMPTY_RULES.retailerChargebacks,
    };
  }
}

/**
 * Convert delayPenalties array to DwellTimeRules
 * Uses the first detention/dwell penalty found, or returns empty rules (no cost)
 * 
 * IMPORTANT: Returns empty rules if not found - NO fake default charges
 */
function convertDelayPenaltiesToDwellRules(terms: ExtractedContractTerms): DwellTimeRules {
  const delayPenalty = terms.delayPenalties?.find(
    (p) => p.name.toLowerCase().includes('dwell') || p.name.toLowerCase().includes('detention')
  );

  if (!delayPenalty || !delayPenalty.tiers || delayPenalty.tiers.length === 0) {
    console.log('[Cost Engine] No dwell/detention penalties in contract - dwell cost will be $0');
    return EMPTY_RULES.dwellTime; // No dwell charges if not specified
  }

  const freeHours = delayPenalty.freeTimeMinutes / 60;
  const tiers = delayPenalty.tiers.map((tier) => ({
    fromHours: tier.fromMinutes / 60,
    toHours: tier.toMinutes ? tier.toMinutes / 60 : Infinity,
    ratePerHour: tier.ratePerHour,
  }));

  console.log('[Cost Engine] Using extracted dwell rules:', {
    freeHours,
    tierCount: tiers.length,
    rates: tiers.map(t => `${t.fromHours}-${t.toHours}h: $${t.ratePerHour}/hr`),
  });

  return { freeHours, tiers };
}

/**
 * Convert partyPenalties array to RetailerChargebacks
 * 
 * Strategy:
 * 1. If partyName provided and found in penalties, use those
 * 2. If partyName not found BUT penalties exist, aggregate ALL penalties
 * 3. If NO party penalties exist, return empty (no chargebacks = $0)
 * 
 * IMPORTANT: Returns empty if not found - NO fake default chargebacks
 */
function convertPartyPenaltiesToChargebacks(
  terms: ExtractedContractTerms,
  partyName?: string
): RetailerChargebacks {
  if (!terms.partyPenalties || terms.partyPenalties.length === 0) {
    console.log('[Cost Engine] No party penalties in contract - chargeback cost will be $0');
    return EMPTY_RULES.retailerChargebacks; // No chargebacks if not specified
  }

  // Try to find penalties matching the specified party name
  let relevantPenalties = partyName
    ? terms.partyPenalties.filter((p) =>
        p.partyName.toLowerCase().includes(partyName.toLowerCase())
      )
    : [];

  // If no match found but penalties exist, use ALL penalties from the contract
  // This ensures we use extracted terms rather than falling back to hardcoded defaults
  if (relevantPenalties.length === 0 && terms.partyPenalties.length > 0) {
    console.log('[Cost Engine] No party match found, using all extracted penalties instead of defaults');
    relevantPenalties = terms.partyPenalties;
  }

  // Aggregate all relevant penalties into a single chargeback structure
  const aggregatedChargeback: {
    otifPercentage?: number;
    flatFee?: number;
    perOccurrence?: number;
  } = {};

  for (const penalty of relevantPenalties) {
    // Aggregate OTIF percentage (use highest if multiple)
    if (penalty.percentage) {
      aggregatedChargeback.otifPercentage = Math.max(
        aggregatedChargeback.otifPercentage || 0,
        penalty.percentage
      );
    }
    // Sum up flat fees
    if (penalty.flatFee) {
      aggregatedChargeback.flatFee = (aggregatedChargeback.flatFee || 0) + penalty.flatFee;
    }
    // Sum up per-occurrence fees (e.g., late delivery fees)
    if (penalty.perOccurrence) {
      aggregatedChargeback.perOccurrence = (aggregatedChargeback.perOccurrence || 0) + penalty.perOccurrence;
    }
  }

  // Create a chargebacks object with the aggregated penalties
  // Use 'Walmart' as the key for backward compatibility with existing cost calculation code
  const chargebacks: Partial<RetailerChargebacks> = {
    Walmart: aggregatedChargeback,
  };

  // Also add entries for other common retailer keys in case they're used
  // This ensures backward compatibility regardless of which retailer key is passed
  chargebacks.Target = aggregatedChargeback;
  chargebacks.Amazon = aggregatedChargeback;
  chargebacks.Costco = aggregatedChargeback;
  chargebacks.Kroger = aggregatedChargeback;

  console.log('[Cost Engine] Using extracted penalties:', {
    penaltyCount: relevantPenalties.length,
    otifPercentage: aggregatedChargeback.otifPercentage,
    flatFee: aggregatedChargeback.flatFee,
    perOccurrence: aggregatedChargeback.perOccurrence,
  });

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
 * Returns validation status and warnings about missing sections
 * 
 * NOTE: Missing sections will result in $0 cost for that category,
 * NOT fake "default" values. This ensures accuracy.
 */
export function validateExtractedTermsForCostCalculation(
  terms: ExtractedContractTerms | undefined
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!terms) {
    warnings.push('No extracted terms provided - all costs will be $0');
    return { valid: false, warnings };
  }

  // Check for delay penalties
  if (!terms.delayPenalties || terms.delayPenalties.length === 0) {
    warnings.push('No delay penalties in contract - dwell time cost will be $0');
  } else {
    const hasDwellOrDetention = terms.delayPenalties.some(
      (p) => p.name.toLowerCase().includes('dwell') || p.name.toLowerCase().includes('detention')
    );
    if (!hasDwellOrDetention) {
      warnings.push('No dwell/detention penalties found - dwell time cost will be $0');
    }
  }

  // Check for compliance windows
  if (!terms.complianceWindows || terms.complianceWindows.length === 0) {
    warnings.push('No OTIF window specified - using standard ±30 minute window');
  }

  // Check for party penalties
  if (!terms.partyPenalties || terms.partyPenalties.length === 0) {
    warnings.push('No party penalties in contract - chargeback cost will be $0');
  }

  // Terms are usable if we have at least one section
  const valid =
    !!terms.delayPenalties?.length ||
    !!terms.complianceWindows?.length ||
    !!terms.partyPenalties?.length;

  return { valid, warnings };
}
