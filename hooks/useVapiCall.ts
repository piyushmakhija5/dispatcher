'use client';

import { useEffect } from 'react';
import type { VapiCallStatus } from '@/types/vapi';

/**
 * Auto-end call after conversation is complete
 * Triggers endCallFn after delayMs when shouldEnd becomes true and call is active
 */
export function useAutoEndCall(
  shouldEnd: boolean,
  callStatus: VapiCallStatus,
  endCallFn: (() => void) | null,
  delayMs: number = 2000
): void {
  useEffect(() => {
    if (shouldEnd && callStatus === 'active' && endCallFn) {
      const timer = setTimeout(() => {
        console.log('Auto-ending call - agreement reached and confirmed');
        endCallFn();
      }, delayMs);

      return () => clearTimeout(timer);
    }
  }, [shouldEnd, callStatus, endCallFn, delayMs]);
}

/**
 * Extract warehouse manager name from transcript
 * Matches patterns like "I'm Sarah", "I am John", "This is Mike"
 */
export function extractWarehouseManagerName(content: string): string | null {
  const match = content.match(/(?:i'm|i am|this is)\s+(\w+)/i);
  return match ? match[1] : null;
}
