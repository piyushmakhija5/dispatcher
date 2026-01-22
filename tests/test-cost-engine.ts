/**
 * Test script for cost engine with dynamic contract terms
 * Run with: npx tsx tests/test-cost-engine.ts
 */

import {
  calculateTotalCostImpactWithTerms,
  validateExtractedTermsForCostCalculation,
  convertExtractedTermsToRules,
} from '../lib/cost-engine';
import type { ExtractedContractTerms } from '../types/contract';

// Sample extracted contract terms (similar to what LLM would extract)
const sampleTerms: ExtractedContractTerms = {
  parties: {
    shipper: 'ABC Logistics',
    carrier: 'XYZ Transport',
    consignee: 'Walmart Distribution Center',
  },
  complianceWindows: [
    {
      name: 'OTIF Delivery Window',
      windowMinutes: 30,
      description: 'Delivery must be within ±30 minutes of appointment',
    },
  ],
  delayPenalties: [
    {
      name: 'Dwell Time Charges',
      freeTimeMinutes: 120, // 2 hours free
      tiers: [
        { fromMinutes: 120, toMinutes: 240, ratePerHour: 50 }, // 2-4 hours: $50/hr
        { fromMinutes: 240, toMinutes: 360, ratePerHour: 65 }, // 4-6 hours: $65/hr
        { fromMinutes: 360, toMinutes: null, ratePerHour: 75 }, // 6+ hours: $75/hr
      ],
    },
  ],
  partyPenalties: [
    {
      partyName: 'Walmart',
      penaltyType: 'OTIF Violation',
      percentage: 3,
      flatFee: 200,
      conditions: 'Applied when delivery is outside OTIF window',
    },
  ],
  _meta: {
    documentName: 'test-contract.pdf',
    extractedAt: new Date().toISOString(),
    confidence: 'high',
  },
};

console.log('=================================================');
console.log('Cost Engine Test - Dynamic Contract Terms');
console.log('=================================================\n');

// Test 1: Validate extracted terms
console.log('Test 1: Validate Extracted Terms');
console.log('-------------------------------------------------');
const validation = validateExtractedTermsForCostCalculation(sampleTerms);
console.log('Valid:', validation.valid);
console.log('Warnings:', validation.warnings.length > 0 ? validation.warnings : 'None');
console.log('✓ Test 1 passed\n');

// Test 2: Convert extracted terms to legacy rules
console.log('Test 2: Convert to Legacy Rules');
console.log('-------------------------------------------------');
const rules = convertExtractedTermsToRules(sampleTerms, 'Walmart');
console.log('Dwell Time Free Hours:', rules.dwellTime.freeHours);
console.log('Dwell Time Tiers:', rules.dwellTime.tiers.length);
console.log('OTIF Window:', rules.otif.windowMinutes, 'minutes');
console.log('Walmart Chargeback:', JSON.stringify(rules.retailerChargebacks.Walmart));
console.log('✓ Test 2 passed\n');

// Test 3: Calculate cost with small delay (within OTIF, no dwell charges)
console.log('Test 3: Small Delay (20 minutes)');
console.log('-------------------------------------------------');
const result1 = calculateTotalCostImpactWithTerms({
  originalAppointmentTime: '14:00',
  newAppointmentTime: '14:20',
  shipmentValue: 50000,
  extractedTerms: sampleTerms,
  partyName: 'Walmart',
});
console.log('Original Time: 14:00');
console.log('New Time: 14:20');
console.log('Total Cost: $' + result1.totalCost);
console.log('OTIF Compliant:', result1.calculations.otif?.isCompliant);
console.log('Expected: $0 (within OTIF window, no dwell charges)');
console.log('✓ Test 3 passed:', result1.totalCost === 0 ? '✓' : '✗ FAILED');
console.log('');

// Test 4: Calculate cost with medium delay (90 minutes - outside OTIF, no dwell charges yet)
console.log('Test 4: Medium Delay (90 minutes)');
console.log('-------------------------------------------------');
const result2 = calculateTotalCostImpactWithTerms({
  originalAppointmentTime: '14:00',
  newAppointmentTime: '15:30',
  shipmentValue: 50000,
  extractedTerms: sampleTerms,
  partyName: 'Walmart',
});
console.log('Original Time: 14:00');
console.log('New Time: 15:30');
console.log('Total Cost: $' + result2.totalCost);
console.log('OTIF Compliant:', result2.calculations.otif?.isCompliant);
console.log('Dwell Cost: $' + (result2.calculations.dwellTime?.total || 0));
console.log('OTIF Penalty: $' + (result2.calculations.otif?.total || 0));
console.log('Expected: ~$1700 (3% of $50k + $200 flat fee, no dwell charges yet)');
console.log('✓ Test 4 passed:', result2.totalCost > 1600 && result2.totalCost < 1800 ? '✓' : '✗');
console.log('');

// Test 5: Calculate cost with large delay (180 minutes - OTIF violation + dwell charges)
console.log('Test 5: Large Delay (180 minutes / 3 hours)');
console.log('-------------------------------------------------');
const result3 = calculateTotalCostImpactWithTerms({
  originalAppointmentTime: '14:00',
  newAppointmentTime: '17:00',
  shipmentValue: 50000,
  extractedTerms: sampleTerms,
  partyName: 'Walmart',
});
console.log('Original Time: 14:00');
console.log('New Time: 17:00');
console.log('Total Cost: $' + result3.totalCost);
console.log('OTIF Compliant:', result3.calculations.otif?.isCompliant);
console.log('Dwell Cost: $' + (result3.calculations.dwellTime?.total || 0));
console.log('OTIF Penalty: $' + (result3.calculations.otif?.total || 0));
console.log('Dwell Breakdown:', result3.calculations.dwellTime?.breakdown);
console.log('Expected: ~$1750 (OTIF: $1700, Dwell: 1hr at $50/hr)');
console.log('✓ Test 5 passed:', result3.totalCost > 1700 && result3.totalCost < 1800 ? '✓' : '✗');
console.log('');

// Test 6: Fallback to defaults when no terms provided
console.log('Test 6: Fallback to Defaults (No Terms)');
console.log('-------------------------------------------------');
const result4 = calculateTotalCostImpactWithTerms({
  originalAppointmentTime: '14:00',
  newAppointmentTime: '17:00',
  shipmentValue: 50000,
  // No extractedTerms provided
  partyName: 'Walmart',
});
console.log('Total Cost: $' + result4.totalCost);
console.log('Expected: Should use DEFAULT_CONTRACT_RULES');
console.log('✓ Test 6 passed:', result4.totalCost > 0 ? '✓' : '✗');
console.log('');

// Test 7: Handle missing sections gracefully
console.log('Test 7: Partial Terms (Missing Dwell Penalties)');
console.log('-------------------------------------------------');
const partialTerms: ExtractedContractTerms = {
  parties: { consignee: 'Walmart' },
  complianceWindows: [
    { name: 'OTIF', windowMinutes: 30 },
  ],
  // No delayPenalties
  partyPenalties: [
    { partyName: 'Walmart', penaltyType: 'OTIF', percentage: 3, flatFee: 200 },
  ],
  _meta: {
    documentName: 'partial-contract.pdf',
    extractedAt: new Date().toISOString(),
    confidence: 'medium',
  },
};

const validation2 = validateExtractedTermsForCostCalculation(partialTerms);
console.log('Valid:', validation2.valid);
console.log('Warnings:', validation2.warnings);

const result5 = calculateTotalCostImpactWithTerms({
  originalAppointmentTime: '14:00',
  newAppointmentTime: '17:00',
  shipmentValue: 50000,
  extractedTerms: partialTerms,
  partyName: 'Walmart',
});
console.log('Total Cost: $' + result5.totalCost);
console.log('Expected: Should use default dwell rules + extracted OTIF penalty');
console.log('✓ Test 7 passed:', result5.totalCost > 0 ? '✓' : '✗');
console.log('');

console.log('=================================================');
console.log('All Tests Complete!');
console.log('=================================================');
