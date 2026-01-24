/**
 * Hours of Service (HOS) Types
 *
 * FMCSA Hours of Service regulations (49 CFR Part 395) for property-carrying drivers.
 * These types support the simplified HOS input model for dock scheduling decisions.
 *
 * Key Clocks:
 * - 11-hour driving limit (max driving time in shift)
 * - 14-hour on-duty window (cannot drive after, even if driving time remains)
 * - 30-minute break after 8 hours of driving
 * - 60/70 hour weekly limit (7/8 day rolling)
 *
 * @see https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Week rule configuration for rolling weekly limits
 */
export type HOSWeekRule = '60_in_7' | '70_in_8';

/**
 * Driver-specific HOS configuration
 */
export interface DriverHOSConfig {
  /** Weekly limit rule: 60h/7d or 70h/8d */
  weekRule: HOSWeekRule;

  /** If true, driver is exempt from 30-min break requirement (150 air-mile radius) */
  shortHaulExempt: boolean;

  /** If true, driver can use split sleeper berth provisions */
  canUseSplitSleeper: boolean;

  /** If true, driver can use 16-hour short-haul exception (extends 14h window to 16h) */
  allow16HourException: boolean;
}

/**
 * Default configuration for most property-carrying drivers
 */
export const DEFAULT_HOS_CONFIG: DriverHOSConfig = {
  weekRule: '70_in_8',
  shortHaulExempt: false,
  canUseSplitSleeper: false,
  allow16HourException: false,
};

// ============================================================================
// HOS Status Types (Input from UI)
// ============================================================================

/**
 * Current driver HOS status - simplified for UI input
 * Instead of tracking full duty status timelines, we capture current state
 */
export interface DriverHOSStatus {
  /** Remaining driving time in current shift (0-660 minutes / 11 hours) */
  remainingDriveMinutes: number;

  /** Remaining on-duty window time (0-840 minutes / 14 hours) - KEY CONSTRAINT */
  remainingWindowMinutes: number;

  /** Remaining weekly on-duty time (0-3600/4200 minutes for 60/70 hour rules) */
  remainingWeeklyMinutes: number;

  /** Driving time since last qualifying 30-min break (0-480 minutes / 8 hours) */
  minutesSinceLastBreak: number;

  /** Driver configuration */
  config: DriverHOSConfig;
}

// ============================================================================
// HOS Presets
// ============================================================================

export type HOSPresetKey = 'fresh_shift' | 'mid_shift' | 'end_of_shift' | 'custom';

export interface HOSPreset {
  key: HOSPresetKey;
  label: string;
  description: string;
  remainingDriveMinutes: number;
  remainingWindowMinutes: number;
  remainingWeeklyMinutes: number;
  minutesSinceLastBreak: number;
}

/**
 * Pre-configured HOS scenarios for quick setup
 */
export const HOS_PRESETS: Record<HOSPresetKey, HOSPreset> = {
  fresh_shift: {
    key: 'fresh_shift',
    label: 'Fresh Shift',
    description: 'Driver just started their shift after 10+ hours off-duty',
    remainingDriveMinutes: 660, // 11 hours
    remainingWindowMinutes: 840, // 14 hours
    remainingWeeklyMinutes: 4200, // 70 hours (assuming 70/8 rule)
    minutesSinceLastBreak: 0,
  },
  mid_shift: {
    key: 'mid_shift',
    label: 'Mid-Shift',
    description: 'Driver is midway through their shift',
    remainingDriveMinutes: 360, // 6 hours
    remainingWindowMinutes: 480, // 8 hours
    remainingWeeklyMinutes: 2400, // 40 hours
    minutesSinceLastBreak: 240, // 4 hours since break
  },
  end_of_shift: {
    key: 'end_of_shift',
    label: 'End of Shift',
    description: 'Driver is running low on available hours',
    remainingDriveMinutes: 120, // 2 hours
    remainingWindowMinutes: 180, // 3 hours
    remainingWeeklyMinutes: 600, // 10 hours
    minutesSinceLastBreak: 420, // 7 hours - break needed soon
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    description: 'Enter specific HOS values',
    remainingDriveMinutes: 660,
    remainingWindowMinutes: 840,
    remainingWeeklyMinutes: 4200,
    minutesSinceLastBreak: 0,
  },
};

// ============================================================================
// Feasibility Result Types
// ============================================================================

/**
 * Binding constraint that prevents HOS compliance
 */
export type HOSBindingConstraint =
  | '14H_WINDOW' // Dock time exceeds 14-hour on-duty window
  | '11H_DRIVE' // Not enough driving time remaining
  | '70_IN_8' // 70-hour/8-day weekly limit exceeded
  | '60_IN_7' // 60-hour/7-day weekly limit exceeded
  | 'BREAK_REQUIRED'; // 30-min break required before more driving

/**
 * Human-readable descriptions for binding constraints
 */
export const HOS_CONSTRAINT_DESCRIPTIONS: Record<HOSBindingConstraint, string> = {
  '14H_WINDOW': '14-hour on-duty window',
  '11H_DRIVE': '11-hour driving limit',
  '70_IN_8': '70-hour weekly limit',
  '60_IN_7': '60-hour weekly limit',
  BREAK_REQUIRED: '30-minute break required',
};

/**
 * Result of HOS feasibility check for a proposed dock time
 */
export interface HOSFeasibilityResult {
  /** Can driver legally accept this dock time? */
  feasible: boolean;

  /** If not feasible, which constraint is binding? */
  bindingConstraint?: HOSBindingConstraint;

  /** Human-readable explanation of the constraint */
  bindingConstraintDescription?: string;

  /** Latest time driver can legally be at dock (HH:MM format) */
  latestLegalDockTime: string;

  /** Latest dock time in minutes from midnight */
  latestLegalDockTimeMinutes: number;

  /** How long driver can stay at dock before HOS violation (minutes) */
  availableTimeAtDockMinutes: number;

  /** Non-blocking warnings (e.g., "break will be needed soon") */
  warnings: string[];

  /** If true, proposed time requires waiting for next shift */
  requiresNextShift: boolean;

  /** If next shift required, earliest start time (HH:MM next day) */
  nextShiftEarliestStart?: string;

  /** Cost premium for using next shift (detention + layover) */
  nextShiftCostPremium?: number;
}

// ============================================================================
// Next Shift Cost Types
// ============================================================================

/**
 * Cost breakdown when HOS requires waiting for next shift
 */
export interface NextShiftCost {
  /** Hours driver must wait for next shift */
  driverDetentionHours: number;

  /** Hourly rate for driver detention ($/hour) */
  detentionRatePerHour: number;

  /** Total detention cost */
  detentionCost: number;

  /** If true, overnight stay required */
  layoverRequired: boolean;

  /** Daily rate for layover ($/day) */
  layoverDailyRate: number;

  /** Total layover cost */
  layoverCost: number;

  /** Total next shift premium (detention + layover) */
  totalNextShiftPremium: number;
}

/**
 * Default rates for next shift cost calculation
 */
export const DEFAULT_DETENTION_RATE_PER_HOUR = 50;
export const DEFAULT_LAYOVER_DAILY_RATE = 150;

// ============================================================================
// Combined Evaluation Types
// ============================================================================

/**
 * Extended offer quality that includes HOS infeasibility
 */
export type ExtendedOfferQuality =
  | 'IDEAL'
  | 'ACCEPTABLE'
  | 'SUBOPTIMAL'
  | 'UNACCEPTABLE'
  | 'INFEASIBLE'; // NEW: HOS violation

/**
 * Suggested action based on combined cost + HOS evaluation
 */
export type SuggestedAction =
  | 'ACCEPT' // Accept the offered time
  | 'COUNTER' // Counter-offer with earlier time
  | 'NEXT_SHIFT' // Propose next shift (after 10h off-duty)
  | 'REJECT'; // Cannot accommodate (rare)

/**
 * Combined evaluation of cost and HOS feasibility
 */
export interface CombinedEvaluation {
  /** Can we accept this time? (cost acceptable AND HOS feasible) */
  canAccept: boolean;

  /** Quality assessment including HOS */
  quality: ExtendedOfferQuality;

  /** Human-readable explanation */
  reason: string;

  /** Recommended action */
  suggestedAction: SuggestedAction;

  /** If countering, suggested alternative time */
  counterOfferTime?: string;

  /** If HOS is the binding constraint, show this info */
  hosInfo?: {
    constraint: HOSBindingConstraint;
    latestLegalTime: string;
    remainingWindowMinutes: number;
  };
}

// ============================================================================
// HOS Constraints for Strategy
// ============================================================================

/**
 * HOS constraints to apply to negotiation strategy
 */
export interface HOSStrategyConstraints {
  /** Latest feasible dock time (hard deadline) */
  latestFeasibleTime: string;

  /** Latest feasible time in minutes from midnight */
  latestFeasibleTimeMinutes: number;

  /** If true, any dock time requires next shift */
  requiresNextShift: boolean;

  /** If next shift required, earliest available time */
  nextShiftEarliestTime?: string;

  /** Driver's remaining window time for display */
  remainingWindowMinutes: number;

  /** Which constraint is binding */
  bindingConstraint: HOSBindingConstraint;
}

// ============================================================================
// Utility Constants
// ============================================================================

/** Maximum driving time per shift (11 hours = 660 minutes) */
export const MAX_DRIVE_MINUTES = 660;

/** Maximum on-duty window (14 hours = 840 minutes) */
export const MAX_WINDOW_MINUTES = 840;

/** Extended window with 16-hour exception (16 hours = 960 minutes) */
export const MAX_WINDOW_MINUTES_16H = 960;

/** Driving time before 30-min break required (8 hours = 480 minutes) */
export const BREAK_THRESHOLD_MINUTES = 480;

/** Required break duration (30 minutes) */
export const REQUIRED_BREAK_MINUTES = 30;

/** Required off-duty time to reset shift (10 hours = 600 minutes) */
export const RESET_OFF_DUTY_MINUTES = 600;

/** Weekly limit for 60/7 rule (60 hours = 3600 minutes) */
export const WEEKLY_LIMIT_60_7 = 3600;

/** Weekly limit for 70/8 rule (70 hours = 4200 minutes) */
export const WEEKLY_LIMIT_70_8 = 4200;

/** Default estimated dock duration (60 minutes) */
export const DEFAULT_DOCK_DURATION_MINUTES = 60;
