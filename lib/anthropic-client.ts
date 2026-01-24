// Anthropic API client for the Dispatcher AI
// Server-side only - do not import in client components

import Anthropic from '@anthropic-ai/sdk';
import type { SlotExtractionResult } from '@/types/dispatch';

// Lazy initialization to avoid issues during build
let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/** Message format for chat API */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Response from chat API */
export interface ChatResponse {
  response: string;
}

/**
 * Extract time and dock information from a warehouse message
 * Uses Claude Haiku for fast, accurate extraction
 *
 * @param message - The warehouse manager's message
 * @returns Extracted time, dock, and confidence level
 */
export async function extractSlotInformation(
  message: string
): Promise<SlotExtractionResult> {
  const prompt = `Extract the appointment TIME and DOCK NUMBER from this warehouse manager's message.
This is a scheduling conversation about DELIVERY APPOINTMENT TIMES.

Message: "${message}"

CRITICAL CONTEXT RULES:
1. This is primarily a TIME negotiation. Single numbers WITHOUT "dock/door/bay" are TIMES, not docks.
2. "I can do 4" = 4 PM (time), "I can do dock 4" = dock 4
3. "How about 4?" = 4 PM (time), "How about dock 4?" = dock 4
4. Numbers in response to "what time works?" are ALWAYS times
5. Numbers in response to "which dock?" are ALWAYS docks
6. DOCK must have explicit keywords: "dock", "doc", "door", "bay", "gate", "talk" (speech-to-text often mishears "dock" as "talk")
7. TIME can be implicit: bare numbers like "4" or "5:30" or "four" are times unless "dock/door/bay/talk" precedes them

RESPONSE FORMAT - ONLY valid JSON (no markdown):
{
  "time": "HH:MM" in 24-hour format or null,
  "dock": "number as string" or null,
  "confidence": "high" or "medium" or "low"
}

Examples:
- "5 PM at dock 3" → {"time": "17:00", "dock": "3", "confidence": "high"}
- "How about dock 3?" → {"time": null, "dock": "3", "confidence": "high"}
- "I can do 4" → {"time": "16:00", "dock": null, "confidence": "high"} (time context!)
- "How about 4?" → {"time": "16:00", "dock": null, "confidence": "high"} (time context!)
- "Dock 4" → {"time": null, "dock": "4", "confidence": "high"}
- "Sure, 5:30 works" → {"time": "17:30", "dock": null, "confidence": "high"}
- "5 30 doesn't work for you?" → {"time": "17:30", "dock": null, "confidence": "high"}
- "dock one" / "doc 1" / "talk 1" → {"time": null, "dock": "1", "confidence": "high"}
- "Got it" / "Sounds good" → {"time": null, "dock": null, "confidence": "low"}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    // Remove markdown code fences if present
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const result = JSON.parse(cleanText) as SlotExtractionResult;

    return result;
  } catch (error) {
    console.error('Extraction error:', error);
    return { time: null, dock: null, confidence: 'low' };
  }
}

/**
 * General chat with Claude for negotiation responses
 * Uses Claude Sonnet for higher quality responses
 *
 * @param messages - Conversation history
 * @param systemPrompt - System instructions for the assistant
 * @returns Claude's response text
 */
export async function chat(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      system: systemPrompt || 'You are a helpful assistant.',
      messages: messages,
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent?.type === 'text' ? textContent.text : '';
  } catch (error) {
    console.error('Chat error:', error);
    throw new Error('Failed to get response from Claude');
  }
}

/**
 * Generate a pushback message for negotiation
 *
 * @param offeredTime - The time offered by warehouse
 * @param cost - Calculated cost of the offer
 * @param quality - Quality evaluation of the offer
 * @param idealTime - Ideal time target
 * @param acceptableTime - Acceptable time target
 * @param pushbackAttempt - Current pushback attempt number
 * @param maxPushbacks - Maximum pushback attempts
 * @returns Generated pushback message
 */
export async function generatePushbackMessage(
  offeredTime: string,
  cost: number,
  quality: string,
  idealTime: string,
  acceptableTime: string,
  pushbackAttempt: number,
  maxPushbacks: number
): Promise<string> {
  const systemPrompt = `You are a professional dispatcher negotiating with a warehouse manager.
The offered time ${offeredTime} results in $${cost} in penalties (quality: ${quality}).
Your goal: ${idealTime} is ideal (no cost), ${acceptableTime} is acceptable.
Be professional but firm. Try to negotiate a better time. This is pushback attempt ${pushbackAttempt} of ${maxPushbacks}.`;

  const response = await chat(
    [
      {
        role: 'user',
        content: `Warehouse manager offered ${offeredTime}. Generate a professional negotiation response to get an earlier time. Keep it brief (1-2 sentences).`,
      },
    ],
    systemPrompt
  );

  return (
    response ||
    `I appreciate that, but ${offeredTime} would cost us $${cost} in penalties. Is there any chance of getting in earlier, maybe around ${acceptableTime}?`
  );
}
