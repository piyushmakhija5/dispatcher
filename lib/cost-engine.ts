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
} from '@/types/cost';
import type { Retailer } from '@/types/dispatch';
import { parseTimeToMinutes } from './time-parser';

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
