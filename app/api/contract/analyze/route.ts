// API endpoint for analyzing contracts with Claude
// POST - Analyze contract content and extract structured terms

import { NextResponse } from 'next/server';
import { analyzeContract } from '@/lib/contract-analyzer';
import type { ContractAnalysisRequest } from '@/types/contract';

/**
 * POST /api/contract/analyze
 * Analyze a contract document and extract structured terms
 *
 * Request body:
 * {
 *   content: string;          // Contract text or base64 PDF
 *   contentType: 'text' | 'pdf';
 *   fileName: string;
 *   options?: {
 *     includeRawText?: boolean;
 *     strictValidation?: boolean;
 *   }
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   terms?: ExtractedContractTerms;
 *   error?: string;
 *   debug?: {
 *     modelUsed: string;
 *     tokensUsed?: number;
 *     extractionTimeMs: number;
 *   };
 *   timestamp: string;
 * }
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: content',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!body.contentType || !['text', 'pdf'].includes(body.contentType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid contentType. Must be "text" or "pdf"',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!body.fileName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: fileName',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Build analysis request
    const analysisRequest: ContractAnalysisRequest = {
      content: body.content,
      contentType: body.contentType,
      fileName: body.fileName,
      options: body.options || {},
    };

    // Analyze the contract
    const result = await analyzeContract(analysisRequest);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          debug: result.debug,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Success - return extracted terms
    return NextResponse.json({
      success: true,
      terms: result.terms,
      debug: result.debug,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Contract analysis API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contract/analyze
 * Health check for contract analysis service
 */
export async function GET() {
  try {
    // Check if Anthropic API key is configured
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          status: 'error',
          ready: false,
          error: 'ANTHROPIC_API_KEY not configured',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ready',
      ready: true,
      model: 'claude-sonnet-4-5',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        status: 'error',
        ready: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
