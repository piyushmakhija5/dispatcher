/**
 * Test HOS structure normalization
 * Run: npx tsx tests/test-hos-normalization.ts
 *
 * Tests that the webhook can handle both flat and nested HOS structures
 */

import { analyzeTimeOffer } from '../lib/vapi-offer-analyzer';
import type { DriverHOSStatus } from '../types/hos';

// Suppress console.log from the analyzer
const originalLog = console.log;
console.log = () => {};

// This is the FLAT structure sent by the UI (the problematic structure)
const flatHOS = {
  remainingDriveMinutes: 120,
  remainingWindowMinutes: 180,
  remainingWeeklyMinutes: 600,
  minutesSinceLastBreak: 420,
  weekRule: '70_in_8',
  shortHaulExempt: false,
};

// This is the NESTED structure expected by DriverHOSStatus type
const nestedHOS: DriverHOSStatus = {
  remainingDriveMinutes: 120,
  remainingWindowMinutes: 180,
  remainingWeeklyMinutes: 600,
  minutesSinceLastBreak: 420,
  config: {
    weekRule: '70_in_8',
    shortHaulExempt: false,
    canUseSplitSleeper: false,
    allow16HourException: false,
  },
};

// Normalization function (same as in webhook)
function normalizeDriverHOS(parsed: Record<string, unknown> | undefined): DriverHOSStatus | undefined {
  if (!parsed) return undefined;

  // Check if it already has the correct nested structure
  if (parsed.config && typeof parsed.config === 'object') {
    return parsed as unknown as DriverHOSStatus;
  }

  // Convert flat structure to nested
  const normalized: DriverHOSStatus = {
    remainingDriveMinutes: Number(parsed.remainingDriveMinutes) || 0,
    remainingWindowMinutes: Number(parsed.remainingWindowMinutes) || 0,
    remainingWeeklyMinutes: Number(parsed.remainingWeeklyMinutes) || 0,
    minutesSinceLastBreak: Number(parsed.minutesSinceLastBreak) || 0,
    config: {
      weekRule: (parsed.weekRule as '60_in_7' | '70_in_8') || '70_in_8',
      shortHaulExempt: Boolean(parsed.shortHaulExempt),
      canUseSplitSleeper: Boolean(parsed.canUseSplitSleeper),
      allow16HourException: Boolean(parsed.allow16HourException),
    },
  };

  return normalized;
}

console.log = originalLog;
console.log('\n' + '='.repeat(80));
console.log('HOS NORMALIZATION TESTS');
console.log('='.repeat(80));

// Test 1: Flat structure should be normalized
console.log('\n### Test 1: Flat HOS structure normalization');
const normalizedFlat = normalizeDriverHOS(flatHOS);
console.log('INPUT (flat):', JSON.stringify(flatHOS, null, 2));
console.log('OUTPUT (normalized):', JSON.stringify(normalizedFlat, null, 2));
const flatHasConfig = normalizedFlat?.config?.weekRule === '70_in_8';
console.log('✓ Has nested config.weekRule:', flatHasConfig ? 'PASS' : 'FAIL');

// Test 2: Nested structure should pass through
console.log('\n### Test 2: Nested HOS structure passthrough');
const passedNested = normalizeDriverHOS(nestedHOS as unknown as Record<string, unknown>);
console.log('INPUT (nested):', JSON.stringify(nestedHOS, null, 2));
console.log('OUTPUT (passthrough):', JSON.stringify(passedNested, null, 2));
const nestedHasConfig = passedNested?.config?.weekRule === '70_in_8';
console.log('✓ Has nested config.weekRule:', nestedHasConfig ? 'PASS' : 'FAIL');

// Test 3: Full integration - use normalized HOS with analyzeTimeOffer
console.log('\n### Test 3: Full integration with analyzeTimeOffer');
console.log = () => {}; // Suppress analyzer logs

const normalizedHOSForAnalyzer = normalizeDriverHOS(flatHOS);
let result;
let error: Error | null = null;

try {
  result = analyzeTimeOffer({
    offeredTimeText: '7 PM',
    originalAppointment: '14:00',
    delayMinutes: 90,
    shipmentValue: 50000,
    retailer: 'Walmart',
    hosEnabled: true,
    driverHOS: normalizedHOSForAnalyzer,
  });
} catch (e) {
  error = e as Error;
}

console.log = originalLog;

if (error) {
  console.log('ERROR:', error.message);
  console.log('✗ Integration test: FAIL');
} else {
  console.log('OUTPUT:');
  console.log(JSON.stringify({
    acceptable: result?.combinedAcceptable,
    reasonType: result?.reasonType,
    hosImpactFriendly: result?.hosImpactFriendly,
  }, null, 2));
  console.log('✓ Integration test: PASS (no config.weekRule error)');
}

console.log('\n' + '='.repeat(80));
console.log('All tests completed.');
console.log('='.repeat(80) + '\n');
