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
  CostCalculationParamsMultiDay,
  CostCalculationParamsWithTermsMultiDay,
} from '@/types/cost';
import type { Retailer } from '@/types/dispatch';
import type { ExtractedContractTerms } from '@/types/contract';
import { parseTimeToMinutes, parseTimeToMinutesWithExtraction, getMultiDayTimeDifference } from './time-parser';

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
 * 1. Find ONLY the Late Delivery / OTIF penalty from the contract
 * 2. DO NOT sum all penalties - each penalty type has specific conditions
 * 3. If NO late delivery penalty exists, return empty (no chargebacks = $0)
 *
 * IMPORTANT: Only applies the RELEVANT penalty for late delivery scenarios
 */
function convertPartyPenaltiesToChargebacks(
  terms: ExtractedContractTerms,
  partyName?: string
): RetailerChargebacks {
  if (!terms.partyPenalties || terms.partyPenalties.length === 0) {
    console.log('[Cost Engine] No party penalties in contract - chargeback cost will be $0');
    return EMPTY_RULES.retailerChargebacks; // No chargebacks if not specified
  }

  // Find the SPECIFIC late delivery penalty
  // Priority: "Late Delivery" > "OTIF" with values > any OTIF mention
  // IMPORTANT: Only match penalties that have actual numeric values

  // First, try exact "Late Delivery" match
  let lateDeliveryPenalty = terms.partyPenalties.find(penalty => {
    const penaltyType = penalty.penaltyType.toLowerCase();
    return penaltyType.includes('late delivery');
  });

  // If not found, try OTIF-related penalties that have actual values
  if (!lateDeliveryPenalty) {
    const otifKeywords = ['otif', 'on-time delivery', 'on time in full', 'delivery compliance'];
    lateDeliveryPenalty = terms.partyPenalties.find(penalty => {
      const penaltyType = penalty.penaltyType.toLowerCase();
      const hasValues = penalty.percentage || penalty.flatFee || penalty.perOccurrence;
      return hasValues && otifKeywords.some(keyword => penaltyType.includes(keyword));
    });
  }

  // Last resort: any OTIF mention (even without values - might be percentage-based)
  if (!lateDeliveryPenalty) {
    lateDeliveryPenalty = terms.partyPenalties.find(penalty => {
      const penaltyType = penalty.penaltyType.toLowerCase();
      return penaltyType.includes('otif') && penalty.percentage;
    });
  }

  // Build the chargeback from ONLY the late delivery penalty
  const chargeback: {
    otifPercentage?: number;
    flatFee?: number;
    perOccurrence?: number;
  } = {};

  if (lateDeliveryPenalty) {
    if (lateDeliveryPenalty.percentage) {
      let pct = lateDeliveryPenalty.percentage;
      // Sanity check: OTIF percentages are typically 1-10%, max 25% in extreme cases
      if (pct > 25) {
        console.warn(`[Cost Engine] ⚠️ Unusually high OTIF percentage: ${pct}% - capping at 25%.`);
        pct = 25;
      }
      chargeback.otifPercentage = pct;
    }
    if (lateDeliveryPenalty.flatFee) {
      chargeback.flatFee = lateDeliveryPenalty.flatFee;
    }
    if (lateDeliveryPenalty.perOccurrence) {
      chargeback.perOccurrence = lateDeliveryPenalty.perOccurrence;
    }

    console.log('[Cost Engine] Using Late Delivery penalty:', {
      penaltyType: lateDeliveryPenalty.penaltyType,
      otifPercentage: chargeback.otifPercentage,
      flatFee: chargeback.flatFee,
      perOccurrence: chargeback.perOccurrence,
    });
  } else {
    console.log('[Cost Engine] No Late Delivery penalty found in contract - OTIF cost will be $0');
    console.log('[Cost Engine] Available penalty types:',
      terms.partyPenalties.map(p => p.penaltyType).join(', ')
    );
  }

  // Build chargebacks keyed by party names
  const chargebacks: Record<string, typeof chargeback> = {};

  // Add under the parties extracted from contract header
  if (terms.parties) {
    if (terms.parties.shipper) chargebacks[terms.parties.shipper] = chargeback;
    if (terms.parties.carrier) chargebacks[terms.parties.carrier] = chargeback;
    if (terms.parties.consignee) chargebacks[terms.parties.consignee] = chargeback;
    if (terms.parties.warehouse) chargebacks[terms.parties.warehouse] = chargeback;
  }

  // If partyName was explicitly provided, also store under that key
  if (partyName) {
    chargebacks[partyName] = chargeback;
  }

  // Add under unique party names from penalties (for lookup flexibility)
  const uniquePartyNames = new Set(terms.partyPenalties.map(p => p.partyName));
  for (const name of uniquePartyNames) {
    chargebacks[name] = chargeback;
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
  // Use extraction fallback for newAppointmentTime (may be natural language from VAPI)
  const newT = parseTimeToMinutesWithExtraction(newAppointmentTime);

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
 * Extract a usable party name from contract terms for chargeback lookup.
 * Prioritizes: explicit partyName > first party penalty name > shipper > carrier > consignee > warehouse
 * Returns undefined if nothing found (will result in $0 OTIF penalty).
 */
function getPartyNameForLookup(
  extractedTerms: ExtractedContractTerms | undefined,
  partyName?: string
): string | undefined {
  // Use explicit partyName if provided
  if (partyName) return partyName;

  if (!extractedTerms) return undefined;

  // Use first party from penalties (most relevant for chargebacks)
  if (extractedTerms.partyPenalties && extractedTerms.partyPenalties.length > 0) {
    return extractedTerms.partyPenalties[0].partyName;
  }

  // Fall back to parties from contract header
  const parties = extractedTerms.parties;
  if (parties) {
    return parties.shipper || parties.carrier || parties.consignee || parties.warehouse;
  }

  return undefined;
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

  // Get party name from explicit param or extract from terms
  const effectivePartyName = getPartyNameForLookup(extractedTerms, partyName);

  // Convert extracted terms to legacy format (gracefully handles missing/invalid terms)
  const rules = convertExtractedTermsToRules(extractedTerms, effectivePartyName);

  // Use existing calculation logic with converted rules
  const legacyParams: CostCalculationParams = {
    originalAppointmentTime,
    newAppointmentTime,
    shipmentValue,
    retailer: effectivePartyName as Retailer, // Use extracted party name (may be undefined = $0 OTIF)
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

// ============================================================================
// Multi-Day Cost Calculation Functions (Phase 11)
// ============================================================================

/**
 * Calculate the total cost impact with multi-day support
 *
 * This function handles scenarios where the warehouse manager offers a time
 * slot for the next day or beyond. Unlike calculateTotalCostImpact which
 * assumes same-day, this function uses the dayOffset to correctly calculate
 * delays across day boundaries.
 *
 * @param params - Original and new appointment times, shipment details, day offset
 * @param rules - Contract rules for cost calculations
 * @returns Complete cost analysis with all calculations
 *
 * @example
 * // Same-day scenario (identical to calculateTotalCostImpact)
 * calculateTotalCostImpactMultiDay({
 *   originalAppointmentTime: "14:00",
 *   newAppointmentTime: "15:30",
 *   shipmentValue: 50000,
 *   retailer: "Walmart",
 *   offeredDayOffset: 0
 * }, rules)
 *
 * // Next-day scenario - tomorrow at 6 AM
 * calculateTotalCostImpactMultiDay({
 *   originalAppointmentTime: "14:00",
 *   newAppointmentTime: "06:00",
 *   shipmentValue: 50000,
 *   retailer: "Walmart",
 *   offeredDayOffset: 1  // Tomorrow
 * }, rules)
 * // → diffMin = 960 (16 hours), not -480 (negative)
 */
export function calculateTotalCostImpactMultiDay(
  params: CostCalculationParamsMultiDay,
  rules: ContractRules
): TotalCostImpactResult {
  const {
    originalAppointmentTime,
    newAppointmentTime,
    shipmentValue,
    retailer,
    offeredDayOffset = 0, // Default to same day for backward compatibility
  } = params;

  const results: TotalCostImpactResult = {
    calculations: {},
    totalCost: 0,
  };

  // Use multi-day time difference calculation
  const diffMin = getMultiDayTimeDifference(
    originalAppointmentTime,
    newAppointmentTime,
    offeredDayOffset
  );

  if (diffMin !== null) {
    const diffHrs = diffMin / 60;

    results.calculations.timeDifference = {
      originalTime: originalAppointmentTime,
      newTime: newAppointmentTime,
      differenceMinutes: diffMin,
      differenceHours: Math.round(diffHrs * 100) / 100,
      dayOffset: offeredDayOffset,
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
 * Calculate the total cost impact using extracted contract terms with multi-day support
 *
 * Combines dynamic contract term extraction (Phase 7) with multi-day support (Phase 11).
 *
 * @param params - Appointment times, shipment details, extracted terms, and day offset
 * @returns Complete cost analysis with all calculations
 *
 * @example
 * // Tomorrow at 6 AM with extracted contract terms
 * calculateTotalCostImpactWithTermsMultiDay({
 *   originalAppointmentTime: "14:00",
 *   newAppointmentTime: "06:00",
 *   shipmentValue: 50000,
 *   extractedTerms: contractTerms,
 *   partyName: "Walmart",
 *   offeredDayOffset: 1
 * })
 */
export function calculateTotalCostImpactWithTermsMultiDay(
  params: CostCalculationParamsWithTermsMultiDay
): TotalCostImpactResult {
  const {
    originalAppointmentTime,
    newAppointmentTime,
    shipmentValue,
    extractedTerms,
    partyName,
    offeredDayOffset = 0,
  } = params;

  // Get party name from explicit param or extract from terms
  const effectivePartyName = getPartyNameForLookup(extractedTerms, partyName);

  // Convert extracted terms to legacy format (gracefully handles missing/invalid terms)
  const rules = convertExtractedTermsToRules(extractedTerms, effectivePartyName);

  // Use multi-day calculation with converted rules
  const multiDayParams: CostCalculationParamsMultiDay = {
    originalAppointmentTime,
    newAppointmentTime,
    shipmentValue,
    retailer: effectivePartyName as Retailer, // Use extracted party name (may be undefined = $0 OTIF)
    offeredDayOffset,
  };

  return calculateTotalCostImpactMultiDay(multiDayParams, rules);
}
