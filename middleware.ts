import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to intercept VAPI webhook events sent to root URL
 *
 * When using server.url override for VAPI tool calls (e.g., ngrok tunnels),
 * VAPI sends ALL webhook events to that URL, not just tool calls.
 * This middleware catches POST requests to `/` and rewrites them to
 * `/api/vapi-root-webhook` for proper handling.
 */
export function middleware(request: NextRequest) {
  // Only intercept POST requests to the root path
  if (request.method === 'POST' && request.nextUrl.pathname === '/') {
    console.log('[Middleware] Intercepting POST to / - rewriting to /api/vapi-root-webhook');

    // Rewrite to our dedicated webhook handler
    const url = request.nextUrl.clone();
    url.pathname = '/api/vapi-root-webhook';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// Only run middleware on the root path
export const config = {
  matcher: '/',
};
