import { NextRequest, NextResponse } from 'next/server';
import { chat, type ChatMessage } from '@/lib/anthropic-client';

const DEFAULT_SYSTEM_PROMPT = `You are a professional truck dispatcher negotiating with a warehouse manager.
Be polite but firm. Focus on finding a mutually beneficial solution.
Keep responses concise (2-3 sentences max).
Always acknowledge the warehouse manager's constraints while advocating for your driver.`;

export async function POST(request: NextRequest) {
  try {
    const { messages, systemPrompt } = (await request.json()) as {
      messages: ChatMessage[];
      systemPrompt?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const response = await chat(messages, systemPrompt || DEFAULT_SYSTEM_PROMPT);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat API error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        response:
          "I apologize, but I'm having trouble processing that. Could you please repeat your last message?",
      },
      { status: 500 }
    );
  }
}
