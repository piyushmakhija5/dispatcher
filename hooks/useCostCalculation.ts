'use client';

import { useMemo, useCallback } from 'react';
import type { Retailer } from '@/types/dispatch';
import type {
  ContractRules,
  TotalCostImpactResult,
  CostCalculationParams,
} from '@/types/cost';
import { DEFAULT_CONTRACT_RULES } from '@/types/cost';
import { calculateTotalCostImpact } from '@/lib/cost-engine';
import { minutesToTime } from '@/lib/time-parser';

interface UseCostCalculationParams {
  originalAppointment: string;
  delayMinutes: number;
  shipmentValue: number;
  retailer: Retailer;
  contractRules?: ContractRules;
}

interface UseCostCalculationReturn {
  /** Calculate cost for a specific new time */
  calculateCostForTime: (newTime: string) => TotalCostImpactResult;

  /** Calculate worst-case cost (full delay) */
  worstCaseCost: TotalCostImpactResult;

  /** Worst case arrival time string */
  worstCaseTime: string;

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
  retailer,
  contractRules = DEFAULT_CONTRACT_RULES,
}: UseCostCalculationParams): UseCostCalculationReturn {
  // Calculate actual arrival time (original appointment + delay)
  // This is when the truck will physically arrive at the warehouse
  const actualArrivalTime = useMemo(() => {
    const [hours, mins] = originalAppointment.split(':').map(Number);
    const totalMins = hours * 60 + mins + delayMinutes;
    return minutesToTime(totalMins);
  }, [originalAppointment, delayMinutes]);

  // Worst case time is the same as actual arrival time in this context
  const worstCaseTime = actualArrivalTime;

  // Memoized worst case cost
  const worstCaseCost = useMemo(() => {
    return calculateTotalCostImpact(
      {
        originalAppointmentTime: originalAppointment,
        newAppointmentTime: worstCaseTime,
        shipmentValue,
        retailer,
      },
      contractRules
    );
  }, [originalAppointment, worstCaseTime, shipmentValue, retailer, contractRules]);

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
    worstCaseCost,
    worstCaseTime,
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
