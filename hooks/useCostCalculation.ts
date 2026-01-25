'use client';

import { useMemo, useCallback } from 'react';
import type { Retailer } from '@/types/dispatch';
import type {
  ContractRules,
  TotalCostImpactResult,
  CostCalculationParams,
} from '@/types/cost';
import { calculateTotalCostImpact, convertExtractedTermsToRules } from '@/lib/cost-engine';
import { minutesToTime } from '@/lib/time-parser';

/**
 * Empty contract rules for when no extracted terms are provided.
 * Results in $0 costs rather than fake "default" costs.
 */
const EMPTY_CONTRACT_RULES = convertExtractedTermsToRules(undefined);

interface UseCostCalculationParams {
  originalAppointment: string;
  delayMinutes: number;
  shipmentValue: number;
  retailer?: Retailer; // Optional - defaults to 'Walmart'
  contractRules?: ContractRules; // If not provided, uses empty rules ($0 costs)
}

interface UseCostCalculationReturn {
  /** Calculate cost for a specific new time */
  calculateCostForTime: (newTime: string) => TotalCostImpactResult;

  /** Base cost at arrival time (minimum unavoidable cost) */
  baseCost: TotalCostImpactResult;

  /** Actual arrival time (original appointment + delay) */
  actualArrivalTime: string;

  /** Contract rules being used */
  contractRules: ContractRules;
}

/**
 * Hook for cost calculation utilities
 * Provides memoized cost calculation functions based on setup parameters
 */
export function useCostCalculation({
  originalAppointment,
  delayMinutes,
  shipmentValue,
  retailer = 'Walmart',
  contractRules = EMPTY_CONTRACT_RULES, // No fake defaults - missing data = $0 cost
}: UseCostCalculationParams): UseCostCalculationReturn {
  // Calculate actual arrival time (original appointment + delay)
  // This is when the truck will physically arrive at the warehouse
  const actualArrivalTime = useMemo(() => {
    const [hours, mins] = originalAppointment.split(':').map(Number);
    const totalMins = hours * 60 + mins + delayMinutes;
    return minutesToTime(totalMins);
  }, [originalAppointment, delayMinutes]);

  // Memoized base cost (minimum unavoidable cost at arrival time)
  const baseCost = useMemo(() => {
    return calculateTotalCostImpact(
      {
        originalAppointmentTime: originalAppointment,
        newAppointmentTime: actualArrivalTime,
        shipmentValue,
        retailer,
      },
      contractRules
    );
  }, [originalAppointment, actualArrivalTime, shipmentValue, retailer, contractRules]);

  // Calculate cost for any given time
  const calculateCostForTime = useCallback(
    (newTime: string): TotalCostImpactResult => {
      return calculateTotalCostImpact(
        {
          originalAppointmentTime: originalAppointment,
          newAppointmentTime: newTime,
          shipmentValue,
          retailer,
        },
        contractRules
      );
    },
    [originalAppointment, shipmentValue, retailer, contractRules]
  );

  return {
    calculateCostForTime,
    baseCost,
    actualArrivalTime,
    contractRules,
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  return `$${cost.toLocaleString()}`;
}

/**
 * Get cost severity level for styling
 */
export function getCostSeverity(cost: number): 'low' | 'medium' | 'high' {
  if (cost <= 100) return 'low';
  if (cost <= 200) return 'medium';
  return 'high';
}

/**
 * Get color class for cost based on severity
 */
export function getCostColorClass(cost: number): string {
  const severity = getCostSeverity(cost);
  switch (severity) {
    case 'low':
      return 'text-emerald-400';
    case 'medium':
      return 'text-amber-400';
    case 'high':
      return 'text-red-400';
  }
}
