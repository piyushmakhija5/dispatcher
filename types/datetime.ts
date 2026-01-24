/**
 * Time and Date Types for Multi-Day Scheduling
 *
 * These types support scheduling scenarios where the warehouse manager
 * offers a time slot for the next day or beyond the original appointment day.
 */

/**
 * Time with optional day offset for multi-day scheduling
 * Day 0 = today (original appointment day)
 * Day 1 = tomorrow
 * Day 2+ = future days
 */
export interface TimeWithDate {
  /** Time string in HH:MM format */
  time: string;
  /** Day offset from original appointment day (0 = same day, 1 = tomorrow) */
  dayOffset: number;
}

/**
 * Parsed time with absolute minutes (can exceed 1440 for multi-day)
 * This allows simple math: delay = absoluteMinutes - originalAbsoluteMinutes
 */
export interface AbsoluteTime {
  /** Minutes from midnight of Day 0 (can be 0-2880+ for multi-day) */
  absoluteMinutes: number;
  /** Day offset (0, 1, 2, ...) */
  dayOffset: number;
  /** Original time string */
  timeString: string;
}

/**
 * Relative date indicators detected from natural language
 */
export type DateIndicator =
  | 'today'
  | 'tomorrow'
  | 'next_day'
  | 'morning' // Implies tomorrow if current time is afternoon
  | 'day_after'
  | null; // No date indicator found

/**
 * Result of extracting time and date from a message
 */
export interface ExtractedTimeWithDate {
  /** Extracted time in HH:MM format, or null if not found */
  time: string | null;
  /** Day offset from original appointment (0 = same day, 1 = tomorrow) */
  dayOffset: number;
  /** The date indicator phrase detected */
  dateIndicator: DateIndicator;
  /** Confidence level of the extraction */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Parameters for multi-day time difference calculation
 */
export interface MultiDayTimeParams {
  /** Original appointment time (HH:MM) */
  originalTime: string;
  /** Offered/new time (HH:MM) */
  offeredTime: string;
  /** Day offset of the offered time (0 = same day, 1 = tomorrow) */
  offeredDayOffset: number;
}

/**
 * Result of multi-day time difference calculation
 */
export interface MultiDayTimeDifference {
  /** Total difference in minutes (positive = later, can exceed 1440) */
  differenceMinutes: number;
  /** Difference in hours (for display) */
  differenceHours: number;
  /** Number of full days in the difference */
  fullDays: number;
  /** Remaining hours after full days */
  remainingHours: number;
  /** Human-readable description */
  description: string;
}

/**
 * Constants for time calculations
 */
export const MINUTES_PER_DAY = 24 * 60; // 1440
export const MINUTES_PER_HOUR = 60;
