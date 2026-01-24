import { NextRequest, NextResponse } from 'next/server';
import { extractSlotInformation } from '@/lib/anthropic-client';
import { detectDateIndicator } from '@/lib/message-extractors';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const result = await extractSlotInformation(message);

    // Detect date indicators (tomorrow, next day, etc.) from the message
    const { indicator, dayOffset } = detectDateIndicator(message);

    // Add day offset to the result
    return NextResponse.json({
      ...result,
      dayOffset,
      dateIndicator: indicator,
    });
  } catch (error) {
    console.error('Extract API error:', error);

    // Return safe fallback on error
    return NextResponse.json({
      time: null,
      dock: null,
      confidence: 'low',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
