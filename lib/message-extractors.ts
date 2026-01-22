/**
 * Message Extraction Utilities
 * Pure functions to extract structured data from natural language messages
 */

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
 */
export function extractDockFromMessage(msg: string): string | null {
  const patterns = [
    /(?:dock|bay|door)\s*(?:number|#|num)?\s*(\w+)/i,
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
