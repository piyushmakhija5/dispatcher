/**
 * Test script for multi-day time slot handling
 * Tests the Phase 11 implementation for handling "tomorrow" and next-day scenarios
 *
 * Run with: npx tsx tests/test-multi-day-slots.ts
 */

import {
  parseTimeToMinutes,
  toAbsoluteMinutes,
  getMultiDayTimeDifference,
  formatTimeWithDayOffset,
  minutesToTime12Hour,
} from '../lib/time-parser';

import {
  detectDateIndicator,
  extractTimeWithDateFromMessage,
  extractTimeFromMessage,
} from '../lib/message-extractors';

import {
  calculateTotalCostImpactMultiDay,
  calculateTotalCostImpactWithTermsMultiDay,
  convertExtractedTermsToRules,
} from '../lib/cost-engine';

import {
  createNegotiationStrategy,
  evaluateOffer,
  evaluateOfferMultiDay,
} from '../lib/negotiation-strategy';

import type { ExtractedContractTerms } from '../types/contract';
import { MINUTES_PER_DAY } from '../types/datetime';

// ============================================================================
// Test Utilities
// ============================================================================

let passed = 0;
let failed = 0;

function test(name: string, condition: boolean, expected?: string, actual?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    if (expected !== undefined) {
      console.log(`    Expected: ${expected}`);
      console.log(`    Actual: ${actual}`);
    }
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(title);
  console.log('='.repeat(60));
}

// Sample contract terms for cost calculations
const sampleTerms: ExtractedContractTerms = {
  parties: {
    shipper: 'ABC Logistics',
    consignee: 'Walmart Distribution Center',
  },
  complianceWindows: [
    {
      name: 'OTIF Delivery Window',
      windowMinutes: 30,
    },
  ],
  delayPenalties: [
    {
      name: 'Dwell Time Charges',
      freeTimeMinutes: 120,
      tiers: [
        { fromMinutes: 120, toMinutes: 240, ratePerHour: 50 },
        { fromMinutes: 240, toMinutes: 360, ratePerHour: 65 },
        { fromMinutes: 360, toMinutes: null, ratePerHour: 75 },
      ],
    },
  ],
  partyPenalties: [
    {
      partyName: 'Walmart',
      penaltyType: 'OTIF Violation',
      percentage: 3,
      flatFee: 200,
    },
  ],
  _meta: {
    documentName: 'test-contract.pdf',
    extractedAt: new Date().toISOString(),
    confidence: 'high',
  },
};

// ============================================================================
// Test 1: Time Parser Functions
// ============================================================================

section('Test 1: Time Parser - toAbsoluteMinutes()');

test(
  'Same day 14:00 = 840 minutes',
  toAbsoluteMinutes('14:00', 0) === 840,
  '840',
  String(toAbsoluteMinutes('14:00', 0))
);

test(
  'Tomorrow 06:00 = 360 + 1440 = 1800 minutes',
  toAbsoluteMinutes('06:00', 1) === 1800,
  '1800',
  String(toAbsoluteMinutes('06:00', 1))
);

test(
  'Day after tomorrow 08:00 = 480 + 2880 = 3360 minutes',
  toAbsoluteMinutes('08:00', 2) === 3360,
  '3360',
  String(toAbsoluteMinutes('08:00', 2))
);

test(
  'MINUTES_PER_DAY constant = 1440',
  MINUTES_PER_DAY === 1440,
  '1440',
  String(MINUTES_PER_DAY)
);

// ============================================================================
// Test 2: Multi-Day Time Difference
// ============================================================================

section('Test 2: Time Parser - getMultiDayTimeDifference()');

// Same-day scenarios
test(
  'Same day: 14:00 -> 15:30 = 90 min',
  getMultiDayTimeDifference('14:00', '15:30', 0) === 90,
  '90',
  String(getMultiDayTimeDifference('14:00', '15:30', 0))
);

test(
  'Same day: 14:00 -> 10:00 = -240 min (earlier, shouldn\'t happen)',
  getMultiDayTimeDifference('14:00', '10:00', 0) === -240,
  '-240',
  String(getMultiDayTimeDifference('14:00', '10:00', 0))
);

// Tomorrow scenarios (THE KEY FIX!)
const tomorrowMorning = getMultiDayTimeDifference('14:00', '06:00', 1);
test(
  'Tomorrow: 14:00 -> Tomorrow 06:00 = 960 min (16 hours)',
  tomorrowMorning === 960,
  '960',
  String(tomorrowMorning)
);

const tomorrowSameTime = getMultiDayTimeDifference('14:00', '14:00', 1);
test(
  'Tomorrow: 14:00 -> Tomorrow 14:00 = 1440 min (24 hours)',
  tomorrowSameTime === 1440,
  '1440',
  String(tomorrowSameTime)
);

const tomorrowEvening = getMultiDayTimeDifference('14:00', '18:00', 1);
test(
  'Tomorrow: 14:00 -> Tomorrow 18:00 = 1680 min (28 hours)',
  tomorrowEvening === 1680,
  '1680',
  String(tomorrowEvening)
);

// Day after tomorrow
const dayAfterTomorrow = getMultiDayTimeDifference('14:00', '08:00', 2);
test(
  'Day after: 14:00 -> Day+2 08:00 = 2520 min (42 hours)',
  dayAfterTomorrow === 2520,
  '2520',
  String(dayAfterTomorrow)
);

// ============================================================================
// Test 3: Format Time with Day Offset
// ============================================================================

section('Test 3: Time Parser - formatTimeWithDayOffset()');

test(
  'Same day format: "14:00", 0 -> "2 PM"',
  formatTimeWithDayOffset('14:00', 0) === '2 PM',
  '2 PM',
  formatTimeWithDayOffset('14:00', 0)
);

test(
  'Tomorrow format: "06:00", 1 -> "Tomorrow at 6 AM"',
  formatTimeWithDayOffset('06:00', 1) === 'Tomorrow at 6 AM',
  'Tomorrow at 6 AM',
  formatTimeWithDayOffset('06:00', 1)
);

test(
  'Day 2 format: "08:00", 2 -> "Day 3 at 8 AM"',
  formatTimeWithDayOffset('08:00', 2) === 'Day 3 at 8 AM',
  'Day 3 at 8 AM',
  formatTimeWithDayOffset('08:00', 2)
);

// ============================================================================
// Test 4: Date Indicator Detection
// ============================================================================

section('Test 4: Message Extractors - detectDateIndicator()');

const testCases = [
  { msg: 'How about tomorrow at 6 AM?', expected: 'tomorrow', dayOffset: 1 },
  { msg: 'We can fit you in tmrw morning', expected: 'tomorrow', dayOffset: 1 },
  { msg: 'Best I can do is next day at 8', expected: 'tomorrow', dayOffset: 1 },
  { msg: 'Maybe day after tomorrow?', expected: 'day_after', dayOffset: 2 },
  { msg: 'Come back in two days at noon', expected: 'day_after', dayOffset: 2 },
  { msg: 'First thing in the morning', expected: 'morning', dayOffset: -1 },
  { msg: 'How about 3 PM today?', expected: 'today', dayOffset: 0 },  // "today" is detected
  { msg: 'We have a slot at 4:30', expected: null, dayOffset: 0 },
];

for (const tc of testCases) {
  const result = detectDateIndicator(tc.msg);
  test(
    `"${tc.msg.substring(0, 30)}..." -> ${tc.expected || 'null'}, offset=${tc.dayOffset}`,
    result.indicator === tc.expected && result.dayOffset === tc.dayOffset,
    `indicator=${tc.expected}, dayOffset=${tc.dayOffset}`,
    `indicator=${result.indicator}, dayOffset=${result.dayOffset}`
  );
}

// ============================================================================
// Test 5: Time + Date Extraction from Messages
// ============================================================================

section('Test 5: Message Extractors - extractTimeWithDateFromMessage()');

const extractionTests = [
  {
    msg: 'How about tomorrow at 6 AM?',
    expected: { time: '6:00', dayOffset: 1, confidence: 'high' },
  },
  {
    msg: 'Best I can do is 3:30 PM tomorrow',
    expected: { time: '15:30', dayOffset: 1, confidence: 'high' },
  },
  {
    msg: 'We have a slot at 4 PM today',
    expected: { time: '16:00', dayOffset: 0, confidence: 'high' },
  },
  {
    msg: 'How about next day at 8:00?',
    expected: { time: '8:00', dayOffset: 1, confidence: 'high' },
  },
  {
    msg: 'Day after tomorrow at 9 AM works',
    expected: { time: '9:00', dayOffset: 2, confidence: 'high' },
  },
  {
    msg: 'No slots today, try tmrw around 7 pm',  // Explicit PM for clarity
    expected: { time: '19:00', dayOffset: 1, confidence: 'high' },
  },
];

for (const tc of extractionTests) {
  const result = extractTimeWithDateFromMessage(tc.msg);
  const timeMatch = result.time === tc.expected.time;
  const dayMatch = result.dayOffset === tc.expected.dayOffset;
  test(
    `"${tc.msg.substring(0, 35)}..." -> ${tc.expected.time}, day+${tc.expected.dayOffset}`,
    timeMatch && dayMatch,
    `time=${tc.expected.time}, dayOffset=${tc.expected.dayOffset}`,
    `time=${result.time}, dayOffset=${result.dayOffset}`
  );
}

// ============================================================================
// Test 6: Multi-Day Cost Calculations
// ============================================================================

section('Test 6: Cost Engine - calculateTotalCostImpactMultiDay()');

const contractRules = convertExtractedTermsToRules(sampleTerms, 'Walmart');

// Same-day scenario (baseline)
const sameDayCost = calculateTotalCostImpactMultiDay(
  {
    originalAppointmentTime: '14:00',
    newAppointmentTime: '15:30',
    shipmentValue: 50000,
    retailer: 'Walmart',
    offeredDayOffset: 0,
  },
  contractRules
);

test(
  'Same day 14:00 -> 15:30: OTIF penalty only (~$1700)',
  sameDayCost.totalCost >= 1600 && sameDayCost.totalCost <= 1800,
  '$1600-1800',
  `$${sameDayCost.totalCost}`
);

// Tomorrow morning - THE KEY TEST
const tomorrowMorningCost = calculateTotalCostImpactMultiDay(
  {
    originalAppointmentTime: '14:00',
    newAppointmentTime: '06:00',
    shipmentValue: 50000,
    retailer: 'Walmart',
    offeredDayOffset: 1, // Tomorrow!
  },
  contractRules
);

console.log('\n  Detailed breakdown for "Tomorrow at 6 AM":');
console.log(`    Original: 14:00 (840 min)`);
console.log(`    Offered: 06:00 tomorrow (1800 min absolute)`);
console.log(`    Delay: ${1800 - 840} minutes = 16 hours`);
console.log(`    Total Cost: $${tomorrowMorningCost.totalCost}`);
console.log(`    Dwell: $${tomorrowMorningCost.calculations.dwellTime?.total || 0}`);
console.log(`    OTIF: $${tomorrowMorningCost.calculations.otif?.total || 0}`);

test(
  'Tomorrow 14:00 -> 06:00: Should have significant costs (16hr delay)',
  tomorrowMorningCost.totalCost > 2000,
  '> $2000',
  `$${tomorrowMorningCost.totalCost}`
);

// Verify the cost is significantly higher than same-day, indicating delay was calculated correctly
test(
  'Tomorrow cost should be significantly higher than $0 (correct delay calculation)',
  tomorrowMorningCost.totalCost > 2000 && tomorrowMorningCost.calculations.dwellTime?.total !== undefined,
  'cost > $2000 with dwell charges',
  `cost=$${tomorrowMorningCost.totalCost}, dwell=$${tomorrowMorningCost.calculations.dwellTime?.total || 0}`
);

// Without day offset (old behavior - would be wrong)
const wrongCost = calculateTotalCostImpactMultiDay(
  {
    originalAppointmentTime: '14:00',
    newAppointmentTime: '06:00',
    shipmentValue: 50000,
    retailer: 'Walmart',
    offeredDayOffset: 0, // Same day - WRONG for "tomorrow"
  },
  contractRules
);

console.log('\n  Comparison - Same input WITHOUT day offset (old behavior):');
console.log(`    This would give: $${wrongCost.totalCost} (incorrect)`);
console.log(`    Delay calc: 6:00 - 14:00 = -480 min (negative!)`);

test(
  'Without day offset, cost would be wrong (low/zero)',
  wrongCost.totalCost < tomorrowMorningCost.totalCost,
  `< $${tomorrowMorningCost.totalCost}`,
  `$${wrongCost.totalCost}`
);

// ============================================================================
// Test 7: Multi-Day with Extracted Terms
// ============================================================================

section('Test 7: Cost Engine - calculateTotalCostImpactWithTermsMultiDay()');

const withTermsCost = calculateTotalCostImpactWithTermsMultiDay({
  originalAppointmentTime: '14:00',
  newAppointmentTime: '08:00',
  shipmentValue: 50000,
  extractedTerms: sampleTerms,
  partyName: 'Walmart',
  offeredDayOffset: 1, // Tomorrow
});

test(
  'Multi-day with extracted terms: Tomorrow 08:00 has costs',
  withTermsCost.totalCost > 1500,
  '> $1500',
  `$${withTermsCost.totalCost}`
);

// ============================================================================
// Test 8: Negotiation Strategy with Multi-Day
// ============================================================================

section('Test 8: Negotiation Strategy - evaluateOfferMultiDay()');

const strategy = createNegotiationStrategy({
  originalAppointment: '14:00',
  delayMinutes: 60,
  shipmentValue: 50000,
  retailer: 'Walmart',
  contractRules: contractRules,
});

// Same-day acceptable offer
const sameDayEval = evaluateOffer(
  '15:00',
  sameDayCost.totalCost,
  strategy,
  { pushbackCount: 0 }
);

test(
  'Same day 15:00: Should be acceptable',
  sameDayEval.shouldAccept === true,
  'shouldAccept=true',
  `shouldAccept=${sameDayEval.shouldAccept}`
);

// Tomorrow evaluation
const tomorrowEval = evaluateOfferMultiDay(
  '06:00',
  1, // Tomorrow
  tomorrowMorningCost.totalCost,
  strategy,
  { pushbackCount: 0 }
);

console.log('\n  Tomorrow 06:00 evaluation:');
console.log(`    shouldAccept: ${tomorrowEval.shouldAccept}`);
console.log(`    quality: ${tomorrowEval.quality}`);
console.log(`    isNextDay: ${tomorrowEval.isNextDay}`);
console.log(`    formattedTime: ${tomorrowEval.formattedTime}`);

test(
  'Tomorrow 06:00: isNextDay flag should be true',
  tomorrowEval.isNextDay === true,
  'true',
  String(tomorrowEval.isNextDay)
);

test(
  'Tomorrow 06:00: formattedTime should include "Tomorrow"',
  tomorrowEval.formattedTime.includes('Tomorrow'),
  'Contains "Tomorrow"',
  tomorrowEval.formattedTime
);

test(
  'Tomorrow 06:00: dayOffset should be 1',
  tomorrowEval.dayOffset === 1,
  '1',
  String(tomorrowEval.dayOffset)
);

// ============================================================================
// Test 9: Edge Cases
// ============================================================================

section('Test 9: Edge Cases');

// Null handling
test(
  'toAbsoluteMinutes with invalid time returns null',
  toAbsoluteMinutes('invalid', 0) === null,
  'null',
  String(toAbsoluteMinutes('invalid', 0))
);

test(
  'getMultiDayTimeDifference with invalid time returns null',
  getMultiDayTimeDifference('invalid', '14:00', 0) === null,
  'null',
  String(getMultiDayTimeDifference('invalid', '14:00', 0))
);

// Message without time
const noTimeResult = extractTimeWithDateFromMessage('tomorrow sounds good');
test(
  'Message with date but no time: time should be null',
  noTimeResult.time === null,
  'null',
  String(noTimeResult.time)
);

test(
  'Message with date but no time: dayOffset still detected',
  noTimeResult.dayOffset === 1,
  '1',
  String(noTimeResult.dayOffset)
);

// Various time formats - note: extractTimeFromMessage returns "H:MM" format, not "HH:MM"
const formats = [
  { msg: 'tomorrow at 6am', expected: '6:00' },
  { msg: 'tomorrow at 6 am', expected: '6:00' },
  { msg: 'tomorrow at 6:00 AM', expected: '6:00' },
  { msg: 'tomorrow at 6:30 am', expected: '6:30' },
  { msg: 'tomorrow at 18:00', expected: '18:00' },
  { msg: 'tomorrow at 2 pm', expected: '14:00' },
];

for (const tc of formats) {
  const result = extractTimeWithDateFromMessage(tc.msg);
  test(
    `Time format "${tc.msg}" -> ${tc.expected}`,
    result.time === tc.expected,
    tc.expected,
    result.time || 'null'
  );
}

// ============================================================================
// Test 10: Real-World Scenarios
// ============================================================================

section('Test 10: Real-World Conversation Scenarios');

const realWorldTests = [
  {
    scenario: 'Warehouse offers tomorrow morning',
    message: "Sorry, we're booked solid today. Best I can do is tomorrow at 6 AM, dock 12.",
    originalAppt: '14:00',
    expected: { time: '6:00', dayOffset: 1, delayMin: 960 },
  },
  {
    scenario: 'Warehouse offers same-day later slot',
    message: "I can squeeze you in at 5:30 PM, dock 8.",
    originalAppt: '14:00',
    expected: { time: '17:30', dayOffset: 0, delayMin: 210 },
  },
  {
    scenario: 'Warehouse offers next day afternoon',
    message: "We've got an opening next day around 2 o'clock.",
    originalAppt: '14:00',
    expected: { time: '14:00', dayOffset: 1, delayMin: 1440 },
  },
  {
    scenario: 'Warehouse offers day after tomorrow',
    message: "Nothing until day after tomorrow. Can do 9 AM.",
    originalAppt: '14:00',
    expected: { time: '9:00', dayOffset: 2, delayMin: 2580 }, // Day+2 09:00 = 2*1440 + 540 = 3420 - 840 = 2580
  },
];

for (const tc of realWorldTests) {
  console.log(`\n  Scenario: ${tc.scenario}`);
  console.log(`    Message: "${tc.message}"`);

  const extracted = extractTimeWithDateFromMessage(tc.message);
  const delay = getMultiDayTimeDifference(tc.originalAppt, extracted.time || '', extracted.dayOffset);

  console.log(`    Extracted: ${extracted.time}, day+${extracted.dayOffset}`);
  console.log(`    Delay: ${delay} minutes`);

  test(
    `Time extracted correctly`,
    extracted.time === tc.expected.time,
    tc.expected.time,
    extracted.time || 'null'
  );

  test(
    `Day offset correct`,
    extracted.dayOffset === tc.expected.dayOffset,
    String(tc.expected.dayOffset),
    String(extracted.dayOffset)
  );
}

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${'='.repeat(60)}`);
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\n⚠️  Some tests failed. Please review the output above.');
  process.exit(1);
} else {
  console.log('\n✓ All tests passed!');
  process.exit(0);
}
