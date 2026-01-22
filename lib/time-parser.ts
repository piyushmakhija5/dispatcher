// Time parsing utilities for the Dispatcher AI
// Extracted from LiveDispatcherAgentVapi.jsx (lines 66-86)

/**
 * Parse a time string into total minutes from midnight
 *
 * Supports formats:
 * - 24-hour: "14:00", "9:30"
 * - 12-hour: "2:00pm", "9:30 AM", "2pm"
 *
 * @param timeStr - Time string to parse
 * @returns Total minutes from midnight, or null if invalid
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;

  const s = timeStr.toLowerCase().trim();

  // Try 24-hour format: "14:00" or "9:30"
  let match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }

  // Try 12-hour format: "2:00pm", "9:30 AM", "2pm"
  match = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match) {
    let h = parseInt(match[1]);
    const m = parseInt(match[2] || '0');

    if (match[3] === 'pm' && h !== 12) h += 12;
    if (match[3] === 'am' && h === 12) h = 0;

    return h * 60 + m;
  }

  return null;
}

/**
 * Convert total minutes from midnight to a time string
 *
 * @param mins - Total minutes from midnight
 * @returns Time string in "H:MM" format (24-hour)
 */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format minutes to a human-readable 12-hour time string
 *
 * @param mins - Total minutes from midnight
 * @returns Time string in "H:MM AM/PM" format
 */
export function minutesToTime12Hour(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Parse a time string and format it as 12-hour time
 *
 * @param timeStr - Time string to parse and format
 * @returns Formatted time string, or original if parsing fails
 */
export function formatTimeTo12Hour(timeStr: string): string {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr;
  return minutesToTime12Hour(mins);
}

/**
 * Calculate the difference between two times in minutes
 *
 * @param fromTime - Starting time string
 * @param toTime - Ending time string
 * @returns Difference in minutes, or null if either time is invalid
 */
export function getTimeDifferenceMinutes(
  fromTime: string,
  toTime: string
): number | null {
  const from = parseTimeToMinutes(fromTime);
  const to = parseTimeToMinutes(toTime);

  if (from === null || to === null) return null;
  return to - from;
}

/**
 * Add minutes to a time string
 *
 * @param timeStr - Starting time string
 * @param minutes - Minutes to add (can be negative)
 * @returns New time string, or original if parsing fails
 */
export function addMinutesToTime(timeStr: string, minutes: number): string {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr;
  return minutesToTime(mins + minutes);
}

/**
 * Format a time string for natural speech
 *
 * Returns conversational format:
 * - "14:00" → "2 PM" (whole hours omit :00)
 * - "14:30" → "2:30 PM"
 * - "09:15" → "9:15 AM"
 *
 * @param timeStr - Time string in 24-hour format (e.g., "14:00")
 * @returns Conversational time string for speech
 */
export function formatTimeForSpeech(timeStr: string): string {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr;

  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;

  // Omit :00 for whole hours (more natural speech)
  if (m === 0) {
    return `${h12} ${period}`;
  }
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Round a time string UP to the nearest 5-minute interval
 *
 * Always rounds UP (ceiling) to ensure the stated time is after actual arrival.
 * This is important because we don't want to tell the warehouse a time
 * before the truck can physically arrive.
 *
 * Examples:
 * - "16:38" → "16:40"
 * - "16:40" → "16:40" (already on 5-min boundary)
 * - "16:41" → "16:45"
 * - "16:42" → "16:45"
 * - "16:58" → "17:00"
 *
 * @param timeStr - Time string in 24-hour format (e.g., "16:38")
 * @returns Time string rounded UP to nearest 5 minutes
 */
export function roundTimeToFiveMinutes(timeStr: string): string {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr;

  // Round UP to nearest 5 minutes (ceiling)
  const roundedMins = Math.ceil(mins / 5) * 5;
  return minutesToTime(roundedMins);
}

/**
 * Format a delay in minutes to human-friendly speech
 *
 * Converts raw minutes to natural language:
 * - 15 → "about 15 minutes"
 * - 30 → "about half an hour"
 * - 45 → "about 45 minutes"
 * - 60 → "about an hour"
 * - 90 → "about an hour and a half"
 * - 120 → "about 2 hours"
 * - 150 → "about 2 and a half hours"
 * - 180 → "about 3 hours"
 * - 234 → "almost 4 hours"
 * - 240 → "about 4 hours"
 *
 * @param minutes - Delay in minutes
 * @returns Human-friendly delay description for speech
 */
export function formatDelayForSpeech(minutes: number): string {
  if (minutes < 0) minutes = Math.abs(minutes);

  // Less than an hour
  if (minutes < 60) {
    if (minutes <= 20) return `about ${minutes} minutes`;
    if (minutes <= 35) return "about half an hour";
    if (minutes <= 50) return "about 45 minutes";
    return "almost an hour";
  }

  // 1-2 hours
  if (minutes < 120) {
    if (minutes <= 70) return "about an hour";
    if (minutes <= 100) return "about an hour and a half";
    return "almost 2 hours";
  }

  // 2+ hours - calculate hours and remainder
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  // Check if we're close to the next hour
  if (remainder >= 45) {
    return `almost ${hours + 1} hours`;
  }

  // Check for half hour
  if (remainder >= 20 && remainder < 45) {
    return `about ${hours} and a half hours`;
  }

  // Close to the hour
  return `about ${hours} hours`;
}
