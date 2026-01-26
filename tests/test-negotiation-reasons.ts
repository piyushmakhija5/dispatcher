/**
 * Test negotiation reasons - clean input/output
 * Run: npx tsx tests/test-negotiation-reasons.ts
 */

import { analyzeTimeOffer } from '../lib/vapi-offer-analyzer';
import type { DriverHOSStatus } from '../types/hos';
import type { ExtractedContractTerms } from '../types/contract';

// Suppress console.log from the analyzer
const originalLog = console.log;
console.log = () => {};

const mockContract: ExtractedContractTerms = {
  parties: { shipper: 'Acme', carrier: 'Heartland', consignee: 'Walmart', warehouse: 'GreenCore' },
  complianceWindows: [{ name: 'OTIF', windowMinutes: 30, description: 'OTIF window' }],
  delayPenalties: [{ name: 'Dwell', freeTimeMinutes: 120, tiers: [{ fromMinutes: 120, toMinutes: 240, ratePerHour: 50 }, { fromMinutes: 240, toMinutes: null, ratePerHour: 75 }] }],
  partyPenalties: [{ partyName: 'Walmart', penaltyType: 'OTIF', percentage: 3 }],
  _meta: { documentName: 'Test', extractedAt: new Date().toISOString(), confidence: 'high' },
};

const hosLow: DriverHOSStatus = {
  remainingDriveMinutes: 120,
  remainingWindowMinutes: 150,
  remainingWeeklyMinutes: 2400,
  minutesSinceLastBreak: 60,
  config: { weekRule: '70_in_8', shortHaulExempt: false, canUseSplitSleeper: false, allow16HourException: false },
};

const tests = [
  { name: 'HOS constraint', params: { offeredTimeText: '7 PM', originalAppointment: '14:00', delayMinutes: 90, shipmentValue: 50000, retailer: 'Walmart' as const, extractedTerms: mockContract, hosEnabled: true, driverHOS: hosLow } },
  { name: 'OTIF penalty', params: { offeredTimeText: '6 PM', originalAppointment: '14:00', delayMinutes: 90, shipmentValue: 50000, retailer: 'Walmart' as const, extractedTerms: mockContract } },
  { name: 'Cost only (no OTIF)', params: { offeredTimeText: '8 PM', originalAppointment: '14:00', delayMinutes: 90, shipmentValue: 10000, retailer: 'Target' as const, extractedTerms: { ...mockContract, partyPenalties: [] } } },
  { name: 'Next-day offer', params: { offeredTimeText: '6 AM', originalAppointment: '14:00', delayMinutes: 90, shipmentValue: 50000, retailer: 'Walmart' as const, extractedTerms: mockContract, offeredDayOffset: 1 } },
  { name: 'Acceptable (in window)', params: { offeredTimeText: '2:25 PM', originalAppointment: '14:00', delayMinutes: 20, shipmentValue: 50000, retailer: 'Walmart' as const, extractedTerms: mockContract } },
  { name: '2nd pushback ($100 fee)', params: { offeredTimeText: '8 PM', originalAppointment: '14:00', delayMinutes: 90, shipmentValue: 50000, retailer: 'Walmart' as const, extractedTerms: mockContract, pushbackCount: 1 } },
];

console.log = originalLog;

console.log('\n' + '='.repeat(80));
console.log('NEGOTIATION REASON TESTS');
console.log('='.repeat(80));

for (const test of tests) {
  console.log(`\n### ${test.name}`);
  console.log('\nINPUT:');
  console.log(JSON.stringify({
    offeredTime: test.params.offeredTimeText,
    originalAppt: test.params.originalAppointment,
    delay: test.params.delayMinutes + ' min',
    shipmentValue: '$' + test.params.shipmentValue,
    hosEnabled: test.params.hosEnabled || false,
    pushbackCount: test.params.pushbackCount || 0,
  }, null, 2));

  // Suppress logs during execution
  console.log = () => {};
  const result = analyzeTimeOffer(test.params);
  console.log = originalLog;

  console.log('\nOUTPUT:');
  console.log(JSON.stringify({
    acceptable: result.combinedAcceptable,
    reasonType: result.reasonType,
    speakableReason: result.speakableReason,
    costImpactFriendly: result.costImpactFriendly,
    otifImpactFriendly: result.otifImpactFriendly,
    hosImpactFriendly: result.hosImpactFriendly,
    suggestedCounterOffer: result.suggestedCounterOffer,
    shouldOfferIncentive: result.shouldOfferIncentive,
    tradeOffs: result.tradeOffs,
  }, null, 2));
}

console.log('\n' + '='.repeat(80) + '\n');
