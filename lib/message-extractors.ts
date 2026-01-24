/**
 * Message Extraction Utilities
 * Pure functions to extract structured data from natural language messages
 */

import type { DateIndicator, ExtractedTimeWithDate } from '@/types/datetime';
import { parseTimeToMinutes } from './time-parser';

/**
 * Extract time from message (handles various formats)
 * @example "2pm" → "14:00"
 * @example "2:30 pm" → "14:30"
 * @example "14:00" → "14:00"
 * @example "around 3" → "15:00"
 */
export function extractTimeFromMessage(msg: string): string | null {
  // Match patterns like "2pm", "2:30 pm", "14:00", "2 o'clock", "around 3"
  const patterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)?/i,           // 2:30 pm, 14:00
    /(\d{1,2})\s*(am|pm)/i,                     // 2pm, 2 pm
    /around\s+(\d{1,2})/i,                      // around 2
    /(\d{1,2})\s*o'?clock/i,                    // 2 o'clock
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      const mins = match[2] && !isNaN(parseInt(match[2])) ? parseInt(match[2]) : 0;
      const period = (match[3] || match[2])?.toLowerCase();

      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      // If no AM/PM and hour <= 6, assume PM (business hours)
      if (!period && hours <= 6) hours += 12;

      return `${hours}:${mins.toString().padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * Extract dock number from message
 * @example "dock 5" → "5"
 * @example "bay number 12" → "12"
 * @example "pull up to 3" → "3"
 * @example "talk 1" → "1" (phonetic variation)
 */
export function extractDockFromMessage(msg: string): string | null {
  const patterns = [
    /(?:dock|bay|door|talk)\s*(?:number|#|num)?\s*(\w+)/i,  // Added "talk" for phonetic variation
    /(?:at|to)\s+(\d+)/i,  // "pull up to 5"
  ];
  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Format time for natural speech
 * @example "14:30" → "2:30 PM"
 * @example "09:00" → "9 AM"
 */
export function formatTimeForSpeech(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const period = h >= 12 ? 'PM' : 'AM';
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

// ============================================================================
// Date Detection Functions (Phase 11)
// ============================================================================

/**
 * Detect relative date indicators in a message
 *
 * Scans for natural language date phrases like "tomorrow", "next day", etc.
 * Also detects early morning times (midnight-6AM) which indicate tomorrow
 * even when said with "tonight" or "later".
 *
 * @param msg - Message to analyze
 * @returns Object with detected indicator and day offset
 *
 * @example
 * detectDateIndicator("How about tomorrow at 6 AM?")
 * // → { indicator: 'tomorrow', dayOffset: 1 }
 *
 * detectDateIndicator("Can we do 3 PM today?")
 * // → { indicator: 'today', dayOffset: 0 }
 *
 * detectDateIndicator("Later tonight at 2 AM")
 * // → { indicator: 'tonight_early_morning', dayOffset: 1 }
 *
 * detectDateIndicator("First thing in the morning")
 * // → { indicator: 'morning', dayOffset: -1 } // Needs context resolution
 */
export function detectDateIndicator(msg: string): {
  indicator: DateIndicator;
  dayOffset: number;
} {
  const lower = msg.toLowerCase();

  // Day after tomorrow - MUST check before "tomorrow" since it contains "tomorrow"
  if (/\b(day\s+after\s+tomorrow|day\s+after\s+next|in\s+two\s+days)\b/.test(lower)) {
    return { indicator: 'day_after', dayOffset: 2 };
  }

  // Explicit "tomorrow" or variations
  if (/\b(tomorrow|tmrw|tmr|next\s+day)\b/.test(lower)) {
    return { indicator: 'tomorrow', dayOffset: 1 };
  }

  // Check for "tonight" or "later" + early morning time (1 AM - 5 AM)
  // e.g., "later tonight at 2 AM", "tonight around 3", "later at 1 AM"
  // These times are AFTER midnight, so they're technically tomorrow
  const hasNightContext = /\b(tonight|later|later\s+tonight|this\s+evening)\b/.test(lower);
  if (hasNightContext) {
    // Extract the time to check if it's early morning (after midnight)
    const earlyMorningPattern = /\b([1-5])\s*(am|a\.m\.?)\b/i;
    const midnightPattern = /\b(12\s*(am|a\.m\.?|midnight)|midnight)\b/i;
    const genericEarlyPattern = /\b([1-5])\s*(o'?clock)?\b.*\b(am|morning|early)\b/i;

    if (earlyMorningPattern.test(lower) || midnightPattern.test(lower) || genericEarlyPattern.test(lower)) {
      // "Tonight at 2 AM" = tomorrow (after midnight)
      return { indicator: 'tonight_early_morning', dayOffset: 1 };
    }

    // Also catch plain numbers 1-5 in context of "tonight" without AM/PM
    // e.g., "later tonight, maybe around 2" when it's clearly early morning context
    const plainEarlyNumber = /\b(around|at|maybe)\s+([1-5])\b/i;
    const plainMatch = lower.match(plainEarlyNumber);
    if (plainMatch) {
      const hour = parseInt(plainMatch[2]);
      // If the hour is 1-5 and context suggests "tonight"/"later",
      // need to check if there's also PM context
      const hasPMContext = /\b(pm|p\.m\.?|afternoon|evening)\b/.test(lower);
      if (!hasPMContext && hour >= 1 && hour <= 5) {
        // Ambiguous - could be tonight at 2 (AM) or today at 2 (PM business hours)
        // When "tonight" is explicitly mentioned with 1-5, lean toward early AM
        return { indicator: 'tonight_early_morning', dayOffset: 1 };
      }
    }
  }

  // Explicit "today" or this afternoon/evening (without early morning time)
  if (/\b(today|this\s+afternoon|this\s+evening|tonight|later\s+today)\b/.test(lower)) {
    return { indicator: 'today', dayOffset: 0 };
  }

  // "in the morning" / "first thing" / "early morning" - ambiguous, needs context
  // If it's currently afternoon and someone says "in the morning", they likely mean tomorrow
  if (/\b(in\s+the\s+morning|first\s+thing|early\s+morning|early\s+am)\b/.test(lower)) {
    return { indicator: 'morning', dayOffset: -1 }; // -1 = needs resolution
  }

  // "next morning" explicitly means tomorrow morning
  if (/\b(next\s+morning)\b/.test(lower)) {
    return { indicator: 'tomorrow', dayOffset: 1 };
  }

  // No date indicator found
  return { indicator: null, dayOffset: 0 };
}

/**
 * Resolve ambiguous date indicators based on context
 *
 * When a phrase like "in the morning" is detected, we need context to know
 * if they mean today's morning or tomorrow's morning.
 *
 * @param indicator - Detected date indicator
 * @param offeredTimeMinutes - Offered time in minutes from midnight
 * @param currentTimeMinutes - Current time in minutes from midnight
 * @param originalTimeMinutes - Original appointment time in minutes from midnight
 * @returns Resolved day offset (0 = today, 1 = tomorrow)
 */
export function resolveDateIndicator(
  indicator: DateIndicator,
  offeredTimeMinutes: number,
  currentTimeMinutes: number,
  originalTimeMinutes: number
): number {
  // Explicit indicators don't need resolution
  if (indicator === 'tomorrow' || indicator === 'next_day') return 1;
  if (indicator === 'day_after') return 2;
  if (indicator === 'today') return 0;

  // "morning" indicator - resolve based on context
  if (indicator === 'morning') {
    // If current time is after noon and offered time is in the morning,
    // they probably mean tomorrow morning
    const isAfternoon = currentTimeMinutes >= 12 * 60;
    const isMorningTime = offeredTimeMinutes < 12 * 60;

    if (isAfternoon && isMorningTime) {
      return 1; // Tomorrow morning
    }
    return 0; // Today's morning (still possible if current time is early)
  }

  // No indicator - use heuristics
  if (indicator === null) {
    // If offered time is significantly before original appointment time
    // AND it's a morning time, it might be tomorrow
    const isMorningOffer = offeredTimeMinutes < 12 * 60;
    const isAfternoonOriginal = originalTimeMinutes >= 12 * 60;

    // If current time is past the offered time, it must be tomorrow
    if (currentTimeMinutes > offeredTimeMinutes) {
      return 1;
    }

    // If it's morning time and original was afternoon, flag as possibly tomorrow
    // but don't auto-assume (return 0 with low confidence in the parent function)
    if (isMorningOffer && isAfternoonOriginal) {
      // This is ambiguous - could be same day or next day
      // Conservative: return 0, but the parent function will mark low confidence
      return 0;
    }
  }

  return 0; // Default to today
}

/**
 * Extract time and date from a message with date indicator detection
 *
 * This is the primary function for extracting scheduling information from
 * natural language. It combines time extraction with date detection.
 *
 * @param msg - Message to parse
 * @param currentTimeMinutes - Current time for context (optional, for resolving "morning")
 * @param originalTimeMinutes - Original appointment time for context (optional)
 * @returns Extracted time with date information and confidence level
 *
 * @example
 * extractTimeWithDateFromMessage("How about tomorrow at 6 AM?")
 * // → { time: "6:00", dayOffset: 1, dateIndicator: 'tomorrow', confidence: 'high' }
 *
 * extractTimeWithDateFromMessage("We can do 3 PM", 14*60, 14*60)
 * // → { time: "15:00", dayOffset: 0, dateIndicator: null, confidence: 'high' }
 *
 * extractTimeWithDateFromMessage("6 AM works", 14*60, 14*60)
 * // → { time: "6:00", dayOffset: 0, dateIndicator: null, confidence: 'low' }
 * // Low confidence because 6 AM is before 2 PM original - might be tomorrow
 */
export function extractTimeWithDateFromMessage(
  msg: string,
  currentTimeMinutes?: number,
  originalTimeMinutes?: number
): ExtractedTimeWithDate {
  // First, extract the time using existing function
  const time = extractTimeFromMessage(msg);

  // Detect date indicator from the message
  const { indicator, dayOffset: rawDayOffset } = detectDateIndicator(msg);

  // Initialize result
  let dayOffset = rawDayOffset;
  let confidence: 'high' | 'medium' | 'low' = 'high';

  // If raw day offset is -1 (needs context resolution like "morning")
  if (rawDayOffset === -1 && time !== null) {
    const offeredMinutes = parseTimeToMinutes(time) ?? 0;
    const current = currentTimeMinutes ?? 12 * 60; // Default to noon if not provided
    const original = originalTimeMinutes ?? 12 * 60;

    dayOffset = resolveDateIndicator(indicator, offeredMinutes, current, original);
    confidence = 'medium'; // Resolved from context, not explicit
  } else if (rawDayOffset === -1) {
    // Can't resolve without a valid time
    dayOffset = 0;
    confidence = 'low';
  }

  // Check for ambiguous scenarios that lower confidence
  if (time !== null && indicator === null && originalTimeMinutes !== undefined) {
    const offeredMinutes = parseTimeToMinutes(time) ?? 0;

    // If offered time is earlier than original appointment and no explicit date
    // this is ambiguous - could be same day (earlier slot) or next day
    if (offeredMinutes < originalTimeMinutes) {
      // Check if it's a morning time when original was afternoon
      const isMorningOffer = offeredMinutes < 12 * 60;
      const isAfternoonOriginal = originalTimeMinutes >= 12 * 60;

      if (isMorningOffer && isAfternoonOriginal) {
        // Very likely tomorrow morning - upgrade confidence if we can infer
        if (currentTimeMinutes !== undefined && currentTimeMinutes > offeredMinutes) {
          // Current time is past offered time - must be tomorrow
          dayOffset = 1;
          confidence = 'medium';
        } else {
          confidence = 'low'; // Ambiguous - might be tomorrow
        }
      } else {
        confidence = 'low'; // Earlier same-day slot is unusual but possible
      }
    }
  }

  return {
    time,
    dayOffset,
    dateIndicator: indicator,
    confidence,
  };
}

/**
 * Extract name from warehouse manager greeting
 * @example "Hi, this is Sarah" → "Sarah"
 * @example "John speaking" → "John"
 */
export function extractNameFromMessage(msg: string): string | null {
  const patterns = [
    /(?:this is|i'm|i am|my name is|name's)\s+(\w+)/i,
    /^(\w+)\s+(?:here|speaking)/i,
    /^hi,?\s+(\w+)\s+here/i,
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match) {
      const name = match[1];
      // Filter out common non-name words
      const nonNames = ['the', 'a', 'an', 'this', 'that', 'here', 'there'];
      if (!nonNames.includes(name.toLowerCase())) {
        return name;
      }
    }
  }
  return null;
}
