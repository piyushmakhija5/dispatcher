/**
 * Voice Transport Configuration Helper
 *
 * Manages configuration for voice transport modes:
 * - 'web': Browser WebRTC via VAPI Web SDK (existing flow)
 * - 'phone': Twilio outbound calls via VAPI API (new flow)
 */

import type { VoiceTransport } from '@/types/dispatch';

// =============================================================================
// ENVIRONMENT VARIABLE ACCESS
// =============================================================================

/**
 * Get the default voice transport from environment variable
 * Falls back to 'phone' if not set (as per user preference)
 */
export function getDefaultVoiceTransport(): VoiceTransport {
  const envValue = process.env.NEXT_PUBLIC_DEFAULT_VOICE_TRANSPORT;
  if (envValue === 'web' || envValue === 'phone') {
    return envValue;
  }
  return 'phone'; // Default to phone as requested
}

/**
 * Check if phone transport is properly configured
 * Requires VAPI_PRIVATE_KEY, VAPI_PHONE_NUMBER_ID, and WAREHOUSE_PHONE_NUMBER
 */
export function isPhoneTransportConfigured(): boolean {
  // These are server-side env vars, so this check only works server-side
  // For client-side, we'll expose a flag via API or build-time config
  if (typeof window === 'undefined') {
    // Server-side check
    return !!(
      process.env.VAPI_PRIVATE_KEY &&
      process.env.VAPI_PHONE_NUMBER_ID &&
      process.env.WAREHOUSE_PHONE_NUMBER
    );
  }
  // Client-side: Check the public flag
  return process.env.NEXT_PUBLIC_PHONE_CONFIGURED === 'true';
}

/**
 * Get the warehouse phone number for display (masked for privacy)
 * Example: +91 98XXX XXXXX
 */
export function getWarehousePhoneDisplay(): string {
  const phone = process.env.WAREHOUSE_PHONE_NUMBER || process.env.NEXT_PUBLIC_WAREHOUSE_PHONE_DISPLAY;
  if (!phone) return 'Not configured';

  // Mask middle digits for privacy
  // +91 98765 43210 → +91 98XXX XX210
  if (phone.length > 8) {
    const prefix = phone.slice(0, 6);  // +91 98
    const suffix = phone.slice(-4);     // 3210
    const masked = 'X'.repeat(phone.length - 10);
    return `${prefix}${masked}${suffix}`;
  }
  return phone;
}

/**
 * Get the full warehouse phone number (server-side only)
 */
export function getWarehousePhoneNumber(): string | null {
  if (typeof window !== 'undefined') {
    console.warn('getWarehousePhoneNumber should only be called server-side');
    return null;
  }
  return process.env.WAREHOUSE_PHONE_NUMBER || null;
}

// =============================================================================
// VAPI API CONFIGURATION (Server-side)
// =============================================================================

/**
 * Get VAPI API configuration for outbound calls (server-side only)
 */
export function getVapiOutboundConfig(): {
  privateKey: string;
  phoneNumberId: string;
  assistantId: string;
  warehousePhone: string;
} | null {
  if (typeof window !== 'undefined') {
    console.warn('getVapiOutboundConfig should only be called server-side');
    return null;
  }

  const privateKey = process.env.VAPI_PRIVATE_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
  const warehousePhone = process.env.WAREHOUSE_PHONE_NUMBER;

  if (!privateKey || !phoneNumberId || !assistantId || !warehousePhone) {
    return null;
  }

  return {
    privateKey,
    phoneNumberId,
    assistantId,
    warehousePhone,
  };
}

// =============================================================================
// TRANSPORT MODE UTILITIES
// =============================================================================

/**
 * Get display label for transport mode
 */
export function getTransportLabel(transport: VoiceTransport): string {
  return transport === 'web' ? 'Web' : 'Phone';
}

/**
 * Get description for transport mode
 */
export function getTransportDescription(transport: VoiceTransport): string {
  return transport === 'web'
    ? 'Use your browser microphone to speak with the AI agent'
    : 'AI agent will call the warehouse phone number';
}

// =============================================================================
// CONFIGURATION STATUS (for UI)
// =============================================================================

export interface VoiceTransportConfig {
  defaultTransport: VoiceTransport;
  isPhoneConfigured: boolean;
  warehousePhoneDisplay: string;
}

/**
 * Get complete voice transport configuration for client-side use
 * This should be called during page load to determine available options
 */
export function getVoiceTransportConfig(): VoiceTransportConfig {
  return {
    defaultTransport: getDefaultVoiceTransport(),
    isPhoneConfigured: isPhoneTransportConfigured(),
    warehousePhoneDisplay: getWarehousePhoneDisplay(),
  };
}
