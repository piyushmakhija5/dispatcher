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
