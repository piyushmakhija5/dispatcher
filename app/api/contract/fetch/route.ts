// API endpoint for fetching contracts from Google Drive
// GET - Health check for Google Drive connection
// POST - Fetch the most recent contract document

import { NextResponse } from 'next/server';
import { 
  checkDriveConnection, 
  fetchMostRecentContract 
} from '@/lib/google-drive';

/**
 * GET /api/contract/fetch
 * Health check for Google Drive connection
 */
export async function GET() {
  try {
    const status = await checkDriveConnection();
    
    return NextResponse.json({
      status: status.connected ? 'connected' : 'disconnected',
      ...status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        status: 'error',
        connected: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contract/fetch
 * Fetch the most recent contract from Google Drive
 * 
 * Optional body: { folderId?: string }
 */
export async function POST(request: Request) {
  try {
    // Parse optional folder ID from request body
    let folderId: string | undefined;
    
    try {
      const body = await request.json();
      folderId = body?.folderId;
    } catch {
      // No body or invalid JSON - use default folder
    }

    const result = await fetchMostRecentContract(folderId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          debug: result.debug,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      file: result.file,
      contentType: result.contentType,
      content: result.content,
      debug: result.debug,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
