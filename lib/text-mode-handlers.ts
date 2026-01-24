import type { ConversationPhase } from '@/types/dispatch';
import {
  extractTimeFromMessage,
  extractDockFromMessage,
  formatTimeForSpeech,
  extractTimeWithDateFromMessage,
} from './message-extractors';
import { parseTimeToMinutes, formatTimeWithDayOffset } from './time-parser';

/**
 * Text Mode Message Handlers
 * Implements the "Mike the Dispatcher" conversation flow for text mode
 */

/**
 * Generate suggested counter offer based on strategy
 * ALWAYS push for EARLIER times, never later!
 */
export function getSuggestedCounterOffer(idealTime?: string): string {
  if (idealTime) {
    return formatTimeForSpeech(idealTime);
  }
  return 'earlier';
}

interface TextModeContext {
  phase: ConversationPhase;
  warehouseManagerName: string | null;
  confirmedTime: string | null;
  confirmedDayOffset?: number;
  delayMinutes: number;
  originalAppointment: string;
  pushbackCount: number;
  /** Current time in minutes from midnight (for date resolution) */
  currentTimeMinutes?: number;
}

interface TextModeResponse {
  response: string;
  nextPhase: ConversationPhase;
  acceptedTime?: string;
  /** Day offset of accepted time (0 = today, 1 = tomorrow) */
  acceptedDayOffset?: number;
  acceptedDock?: string;
  shouldIncrementPushback?: boolean;
}

/**
 * Handle AWAITING_NAME phase
 */
export function handleAwaitingName(
  name: string,
  context: TextModeContext
): TextModeResponse {
  const theirName = name || context.warehouseManagerName || 'there';
  const delay = context.delayMinutes;
  const appt = context.originalAppointment;

  const response = `Hey ${theirName}, so I've got a truck that was supposed to be there at ${formatTimeForSpeech(appt)}, but my driver's running about ${delay} minutes behind. Any chance you can fit us in a bit later?`;

  return {
    response,
    nextPhase: 'negotiating_time',
  };
}

/**
 * Handle NEGOTIATING_TIME phase
 *
 * Now supports multi-day scenarios where warehouse offers "tomorrow" or "next day"
 */
export function handleNegotiatingTime(
  message: string,
  context: TextModeContext,
  evaluation: { shouldAccept: boolean; quality: string },
  suggestedCounter: string
): TextModeResponse {
  // Use date-aware extraction to detect "tomorrow", "next day", etc.
  const originalMinutes = parseTimeToMinutes(context.originalAppointment) ?? 0;
  const extracted = extractTimeWithDateFromMessage(
    message,
    context.currentTimeMinutes,
    originalMinutes
  );

  const offeredTime = extracted.time;
  const offeredDayOffset = extracted.dayOffset;
  const offeredDock = extractDockFromMessage(message);

  if (offeredTime) {
    // Format time with day offset (e.g., "Tomorrow at 6 AM" or just "6 AM")
    const timeFormatted = formatTimeWithDayOffset(offeredTime, offeredDayOffset);

    if (evaluation.shouldAccept) {
      // ACCEPT the time warmly
      if (offeredDock) {
        // Got both time and dock!
        const theirName = context.warehouseManagerName || '';
        return {
          response: `Got it — ${timeFormatted} at dock ${offeredDock}. Thanks${theirName ? `, ${theirName}` : ''}!`,
          nextPhase: 'confirming',
          acceptedTime: offeredTime,
          acceptedDayOffset: offeredDayOffset,
          acceptedDock: offeredDock,
        };
      } else {
        // Need dock number
        return {
          response: `Perfect — which dock should we pull into?`,
          nextPhase: 'awaiting_dock',
          acceptedTime: offeredTime,
          acceptedDayOffset: offeredDayOffset,
        };
      }
    } else {
      // NOT ACCEPTABLE - counter with suggested offer
      if (context.pushbackCount >= 2) {
        // Out of pushbacks, must accept
        if (offeredDock) {
          return {
            response: `Alright, ${timeFormatted} at dock ${offeredDock} it is. We'll make it work.`,
            nextPhase: 'confirming',
            acceptedTime: offeredTime,
            acceptedDayOffset: offeredDayOffset,
            acceptedDock: offeredDock,
          };
        } else {
          return {
            response: `Gotcha, ${timeFormatted} will have to do. Which dock?`,
            nextPhase: 'awaiting_dock',
            acceptedTime: offeredTime,
            acceptedDayOffset: offeredDayOffset,
          };
        }
      } else {
        // Push for earlier (or earlier tomorrow if already next-day)
        const counterMessage = offeredDayOffset > 0
          ? `Hmm, ${timeFormatted} is quite a wait. Any chance we could get in earlier tomorrow, maybe around ${suggestedCounter}?`
          : `Hmm, ${timeFormatted} is a bit tight for us. Anything closer to ${suggestedCounter} available?`;
        return {
          response: counterMessage,
          nextPhase: 'negotiating_time',
          shouldIncrementPushback: true,
        };
      }
    }
  } else if (offeredDock && context.confirmedTime) {
    // They gave dock but we already have time
    const theirName = context.warehouseManagerName || '';
    const existingDayOffset = context.confirmedDayOffset ?? 0;
    const timeFormatted = formatTimeWithDayOffset(context.confirmedTime, existingDayOffset);
    return {
      response: `Got it — ${timeFormatted} at dock ${offeredDock}. Thanks${theirName ? `, ${theirName}` : ''}!`,
      nextPhase: 'confirming',
      acceptedDock: offeredDock,
    };
  } else {
    // No time found - ask for one casually
    return {
      response: `Gotcha. So what time slots do you have open?`,
      nextPhase: 'negotiating_time',
    };
  }
}

/**
 * Handle AWAITING_DOCK phase
 */
export function handleAwaitingDock(
  message: string,
  context: TextModeContext
): TextModeResponse {
  const offeredDock = extractDockFromMessage(message);
  const offeredTime = extractTimeFromMessage(message);

  if (offeredDock) {
    const theirName = context.warehouseManagerName || '';
    const existingDayOffset = context.confirmedDayOffset ?? 0;
    const timeFormatted = context.confirmedTime
      ? formatTimeWithDayOffset(context.confirmedTime, existingDayOffset)
      : '';
    return {
      response: `Got it — ${timeFormatted} at dock ${offeredDock}. Thanks${theirName ? `, ${theirName}` : ''}!`,
      nextPhase: 'confirming',
      acceptedDock: offeredDock,
    };
  } else if (offeredTime) {
    // They changed the time? Extract with date awareness and ask for dock again
    const originalMinutes = parseTimeToMinutes(context.originalAppointment) ?? 0;
    const extracted = extractTimeWithDateFromMessage(
      message,
      context.currentTimeMinutes,
      originalMinutes
    );
    return {
      response: `Got the time, but which dock should we head to?`,
      nextPhase: 'awaiting_dock',
      acceptedTime: extracted.time || offeredTime,
      acceptedDayOffset: extracted.dayOffset,
    };
  } else {
    return {
      response: `Sorry, didn't catch the dock number. Which one should we use?`,
      nextPhase: 'awaiting_dock',
    };
  }
}

/**
 * Handle CONFIRMING phase
 */
export function handleConfirming(context: TextModeContext): TextModeResponse {
  const theirName = context.warehouseManagerName || '';
  return {
    response: `Alright, we'll see you then. Appreciate your help${theirName ? `, ${theirName}` : ''}!`,
    nextPhase: 'done',
  };
}
