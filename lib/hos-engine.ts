/**
 * HOS Engine - Hours of Service Feasibility Calculations
 *
 * Determines if a proposed dock time is feasible given the driver's current HOS status.
 * Key insight: The 14-hour window is the critical constraint for dock scheduling
 * because it's a hard deadline that cannot be paused.
 *
 * @see /types/hos.ts for type definitions
 * @see 49 CFR Part 395 for FMCSA regulations
 */

import { parseTimeToMinutes, minutesToTime } from './time-parser';
import {
  DriverHOSStatus,
  HOSFeasibilityResult,
  HOSBindingConstraint,
  HOS_CONSTRAINT_DESCRIPTIONS,
  HOSStrategyConstraints,
  NextShiftCost,
  DEFAULT_DETENTION_RATE_PER_HOUR,
  DEFAULT_LAYOVER_DAILY_RATE,
  MAX_WINDOW_MINUTES,
  BREAK_THRESHOLD_MINUTES,
  RESET_OFF_DUTY_MINUTES,
  DEFAULT_DOCK_DURATION_MINUTES,
} from '../types/hos';

// ============================================================================
// Core Feasibility Check
// ============================================================================

/**
 * Check if a proposed dock time is feasible given driver's HOS status
 *
 * @param proposedDockTime - Proposed dock appointment time (HH:MM format)
 * @param currentTime - Current time (HH:MM format)
 * @param driverStatus - Driver's current HOS status
 * @param estimatedDockDurationMinutes - How long driver will be at dock (default: 60 min)
 * @param driverDetentionRate - Hourly rate for detention if next shift needed
 * @returns Feasibility result with constraints and alternatives
 */
export function checkHOSFeasibility(
  proposedDockTime: string,
  currentTime: string,
  driverStatus: DriverHOSStatus,
  estimatedDockDurationMinutes: number = DEFAULT_DOCK_DURATION_MINUTES,
  driverDetentionRate: number = DEFAULT_DETENTION_RATE_PER_HOUR
): HOSFeasibilityResult {
  const proposedMins = parseTimeToMinutes(proposedDockTime) ?? 0;
  const currentMins = parseTimeToMinutes(currentTime) ?? 0;

  // Calculate time until proposed dock (handle next day wraparound)
  let minutesUntilDock = proposedMins - currentMins;
  if (minutesUntilDock < 0) {
    // Proposed time is tomorrow
    minutesUntilDock += 24 * 60;
  }

  // Calculate when driver's HOS clocks expire
  const windowEndsAt = currentMins + driverStatus.remainingWindowMinutes;
  const driveEndsAt = currentMins + driverStatus.remainingDriveMinutes;
  const weeklyEndsAt = currentMins + driverStatus.remainingWeeklyMinutes;

  // Determine which constraint is most limiting
  const constraints: { constraint: HOSBindingConstraint; endsAtMinutes: number }[] = [
    { constraint: '14H_WINDOW', endsAtMinutes: windowEndsAt },
    { constraint: '11H_DRIVE', endsAtMinutes: driveEndsAt },
    {
      constraint: driverStatus.config.weekRule === '70_in_8' ? '70_IN_8' : '60_IN_7',
      endsAtMinutes: weeklyEndsAt,
    },
  ];

  // Check if break is required (8h driving without 30-min break)
  const breakRequired =
    !driverStatus.config.shortHaulExempt &&
    driverStatus.minutesSinceLastBreak >= BREAK_THRESHOLD_MINUTES;

  if (breakRequired) {
    constraints.push({
      constraint: 'BREAK_REQUIRED',
      // Break adds 30 minutes to effective window, but doesn't extend it
      endsAtMinutes: currentMins, // Effectively, can't drive now
    });
  }

  // Sort by most limiting (earliest expiration)
  constraints.sort((a, b) => a.endsAtMinutes - b.endsAtMinutes);
  const bindingConstraint = constraints[0];

  // Calculate latest legal dock time
  // Driver must be DONE at dock before window expires
  const latestLegalDockTimeMinutes = Math.max(
    0,
    bindingConstraint.endsAtMinutes - estimatedDockDurationMinutes
  );

  // Normalize to 24-hour format
  const normalizedLatestDockMinutes = latestLegalDockTimeMinutes % (24 * 60);
  const latestLegalDockTime = minutesToTime(normalizedLatestDockMinutes);

  // Calculate when driver would finish at dock
  const dockEndTime = proposedMins + estimatedDockDurationMinutes;

  // Check if proposed time is feasible
  const feasible = dockEndTime <= bindingConstraint.endsAtMinutes && !breakRequired;

  // Calculate available time at dock
  const availableTimeAtDockMinutes = Math.max(
    0,
    bindingConstraint.endsAtMinutes - proposedMins
  );

  // Build warnings
  const warnings: string[] = [];

  // Warning: Break will be needed soon
  if (
    !driverStatus.config.shortHaulExempt &&
    driverStatus.minutesSinceLastBreak >= BREAK_THRESHOLD_MINUTES - 60
  ) {
    const minsUntilBreakNeeded = BREAK_THRESHOLD_MINUTES - driverStatus.minutesSinceLastBreak;
    if (minsUntilBreakNeeded > 0) {
      warnings.push(
        `30-minute break required after ${minsUntilBreakNeeded} more minutes of driving`
      );
    } else {
      warnings.push('30-minute break required before any more driving');
    }
  }

  // Warning: Window ending soon
  if (driverStatus.remainingWindowMinutes <= 120 && driverStatus.remainingWindowMinutes > 0) {
    warnings.push(
      `14-hour window ends in ${formatMinutesToHuman(driverStatus.remainingWindowMinutes)}`
    );
  }

  // Warning: Weekly limit approaching
  if (driverStatus.remainingWeeklyMinutes <= 300) {
    warnings.push(
      `Weekly limit: only ${formatMinutesToHuman(driverStatus.remainingWeeklyMinutes)} remaining`
    );
  }

  // Check if next shift is required
  const requiresNextShift = !feasible;
  let nextShiftEarliestStart: string | undefined;
  let nextShiftCostPremium: number | undefined;

  if (requiresNextShift) {
    // Driver needs 10 hours off-duty to reset
    const nextShiftStartMins = currentMins + RESET_OFF_DUTY_MINUTES;
    const normalizedNextShiftMins = nextShiftStartMins % (24 * 60);
    nextShiftEarliestStart = minutesToTime(normalizedNextShiftMins);

    // Calculate wait time and cost
    const waitTimeMinutes = Math.max(0, proposedMins - currentMins);
    nextShiftCostPremium = estimateNextShiftCost(
      waitTimeMinutes,
      driverDetentionRate,
      DEFAULT_LAYOVER_DAILY_RATE
    ).totalNextShiftPremium;
  }

  return {
    feasible,
    bindingConstraint: feasible ? undefined : bindingConstraint.constraint,
    bindingConstraintDescription: feasible
      ? undefined
      : HOS_CONSTRAINT_DESCRIPTIONS[bindingConstraint.constraint],
    latestLegalDockTime,
    latestLegalDockTimeMinutes: normalizedLatestDockMinutes,
    availableTimeAtDockMinutes,
    warnings,
    requiresNextShift,
    nextShiftEarliestStart,
    nextShiftCostPremium,
  };
}

// ============================================================================
// Strategy Constraints
// ============================================================================

/**
 * Calculate HOS constraints to apply to negotiation strategy
 *
 * @param currentTime - Current time (HH:MM format)
 * @param driverStatus - Driver's current HOS status
 * @param estimatedDockDurationMinutes - Expected time at dock
 * @returns HOS constraints for strategy creation
 */
export function calculateHOSStrategyConstraints(
  currentTime: string,
  driverStatus: DriverHOSStatus,
  estimatedDockDurationMinutes: number = DEFAULT_DOCK_DURATION_MINUTES
): HOSStrategyConstraints {
  const currentMins = parseTimeToMinutes(currentTime) ?? 0;

  // Find the most limiting constraint
  const windowEndsAt = currentMins + driverStatus.remainingWindowMinutes;
  const driveEndsAt = currentMins + driverStatus.remainingDriveMinutes;
  const weeklyEndsAt = currentMins + driverStatus.remainingWeeklyMinutes;

  const constraints: { constraint: HOSBindingConstraint; endsAtMinutes: number }[] = [
    { constraint: '14H_WINDOW', endsAtMinutes: windowEndsAt },
    { constraint: '11H_DRIVE', endsAtMinutes: driveEndsAt },
    {
      constraint: driverStatus.config.weekRule === '70_in_8' ? '70_IN_8' : '60_IN_7',
      endsAtMinutes: weeklyEndsAt,
    },
  ];

  // Check break requirement
  if (
    !driverStatus.config.shortHaulExempt &&
    driverStatus.minutesSinceLastBreak >= BREAK_THRESHOLD_MINUTES
  ) {
    constraints.push({
      constraint: 'BREAK_REQUIRED',
      endsAtMinutes: currentMins, // Can't proceed now
    });
  }

  constraints.sort((a, b) => a.endsAtMinutes - b.endsAtMinutes);
  const bindingConstraint = constraints[0];

  // Latest dock time = constraint end - dock duration
  const latestFeasibleTimeMinutes = Math.max(
    0,
    bindingConstraint.endsAtMinutes - estimatedDockDurationMinutes
  );
  const normalizedLatestMinutes = latestFeasibleTimeMinutes % (24 * 60);
  const latestFeasibleTime = minutesToTime(normalizedLatestMinutes);

  // Check if any dock time is feasible in current shift
  const requiresNextShift = latestFeasibleTimeMinutes <= currentMins;

  let nextShiftEarliestTime: string | undefined;
  if (requiresNextShift) {
    const nextShiftMins = (currentMins + RESET_OFF_DUTY_MINUTES) % (24 * 60);
    nextShiftEarliestTime = minutesToTime(nextShiftMins);
  }

  return {
    latestFeasibleTime,
    latestFeasibleTimeMinutes: normalizedLatestMinutes,
    requiresNextShift,
    nextShiftEarliestTime,
    remainingWindowMinutes: driverStatus.remainingWindowMinutes,
    bindingConstraint: bindingConstraint.constraint,
  };
}

// ============================================================================
// Next Shift Cost Calculation
// ============================================================================

/**
 * Estimate cost when HOS requires waiting for next shift
 *
 * @param waitTimeMinutes - How long driver must wait
 * @param detentionRatePerHour - Hourly detention rate
 * @param layoverDailyRate - Daily rate for overnight stay
 * @returns Detailed cost breakdown
 */
export function estimateNextShiftCost(
  waitTimeMinutes: number,
  detentionRatePerHour: number = DEFAULT_DETENTION_RATE_PER_HOUR,
  layoverDailyRate: number = DEFAULT_LAYOVER_DAILY_RATE
): NextShiftCost {
  const detentionHours = Math.ceil(waitTimeMinutes / 60);
  const detentionCost = detentionHours * detentionRatePerHour;

  // Layover required if wait time > 10 hours (driver needs to sleep)
  const layoverRequired = waitTimeMinutes >= RESET_OFF_DUTY_MINUTES;
  const layoverCost = layoverRequired ? layoverDailyRate : 0;

  return {
    driverDetentionHours: detentionHours,
    detentionRatePerHour,
    detentionCost,
    layoverRequired,
    layoverDailyRate,
    layoverCost,
    totalNextShiftPremium: detentionCost + layoverCost,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate latest legal dock time from current time and HOS status
 *
 * @param currentTime - Current time (HH:MM)
 * @param driverStatus - Driver's HOS status
 * @param estimatedDockDurationMinutes - Time at dock
 * @returns Latest legal dock time (HH:MM)
 */
export function calculateLatestLegalDockTime(
  currentTime: string,
  driverStatus: DriverHOSStatus,
  estimatedDockDurationMinutes: number = DEFAULT_DOCK_DURATION_MINUTES
): string {
  const constraints = calculateHOSStrategyConstraints(
    currentTime,
    driverStatus,
    estimatedDockDurationMinutes
  );
  return constraints.latestFeasibleTime;
}

/**
 * Check if driver needs a 30-minute break before more driving
 */
export function isBreakRequired(driverStatus: DriverHOSStatus): boolean {
  if (driverStatus.config.shortHaulExempt) {
    return false;
  }
  return driverStatus.minutesSinceLastBreak >= BREAK_THRESHOLD_MINUTES;
}

/**
 * Calculate remaining time before break is required
 */
export function getMinutesUntilBreakRequired(driverStatus: DriverHOSStatus): number {
  if (driverStatus.config.shortHaulExempt) {
    return Infinity;
  }
  return Math.max(0, BREAK_THRESHOLD_MINUTES - driverStatus.minutesSinceLastBreak);
}

/**
 * Get the binding HOS constraint for a driver
 */
export function getBindingConstraint(
  driverStatus: DriverHOSStatus
): { constraint: HOSBindingConstraint; remainingMinutes: number } {
  const constraints: { constraint: HOSBindingConstraint; remaining: number }[] = [
    { constraint: '14H_WINDOW', remaining: driverStatus.remainingWindowMinutes },
    { constraint: '11H_DRIVE', remaining: driverStatus.remainingDriveMinutes },
    {
      constraint: driverStatus.config.weekRule === '70_in_8' ? '70_IN_8' : '60_IN_7',
      remaining: driverStatus.remainingWeeklyMinutes,
    },
  ];

  if (isBreakRequired(driverStatus)) {
    constraints.push({ constraint: 'BREAK_REQUIRED', remaining: 0 });
  }

  constraints.sort((a, b) => a.remaining - b.remaining);

  return {
    constraint: constraints[0].constraint,
    remainingMinutes: constraints[0].remaining,
  };
}

/**
 * Format minutes into human-readable string
 * e.g., 390 -> "6h 30m", 45 -> "45m"
 */
export function formatMinutesToHuman(minutes: number): string {
  if (minutes < 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Format minutes into speech-friendly string
 * e.g., 390 -> "6 hours and 30 minutes", 120 -> "2 hours"
 */
export function formatMinutesForSpeech(minutes: number): string {
  if (minutes < 0) return '0 minutes';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const hourStr = hours === 1 ? '1 hour' : `${hours} hours`;
  const minStr = mins === 1 ? '1 minute' : `${mins} minutes`;

  if (hours === 0) {
    return minStr;
  }
  if (mins === 0) {
    return hourStr;
  }
  return `${hourStr} and ${minStr}`;
}

/**
 * Check if a time would cross midnight (next day)
 */
export function wouldCrossMidnight(currentTime: string, proposedTime: string): boolean {
  const currentMins = parseTimeToMinutes(currentTime) ?? 0;
  const proposedMins = parseTimeToMinutes(proposedTime) ?? 0;
  return proposedMins < currentMins;
}

/**
 * Validate driver HOS status has reasonable values
 */
export function validateHOSStatus(status: DriverHOSStatus): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (status.remainingDriveMinutes < 0 || status.remainingDriveMinutes > 660) {
    errors.push('Remaining drive time must be between 0 and 660 minutes (11 hours)');
  }

  if (status.remainingWindowMinutes < 0 || status.remainingWindowMinutes > 840) {
    errors.push('Remaining window time must be between 0 and 840 minutes (14 hours)');
  }

  if (status.minutesSinceLastBreak < 0 || status.minutesSinceLastBreak > 480) {
    errors.push('Time since last break must be between 0 and 480 minutes (8 hours)');
  }

  const weeklyLimit = status.config.weekRule === '70_in_8' ? 4200 : 3600;
  if (status.remainingWeeklyMinutes < 0 || status.remainingWeeklyMinutes > weeklyLimit) {
    errors.push(`Remaining weekly time must be between 0 and ${weeklyLimit} minutes`);
  }

  // Logical check: drive time can't exceed window time
  if (status.remainingDriveMinutes > status.remainingWindowMinutes) {
    errors.push('Remaining drive time cannot exceed remaining window time');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
