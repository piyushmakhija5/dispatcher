/**
 * Unit Tests: Cost Engine with Extracted Contract Terms
 * Phase 7.8: Testing & Validation
 *
 * Tests the cost calculation engine with dynamically extracted contract terms.
 * Run with: npx ts-node tests/test-cost-engine-with-terms.ts
 *
 * Test Cases:
 * 1. Validate extracted terms structure
 * 2. Convert extracted terms to legacy rules format
 * 3. Calculate costs with extracted terms
 * 4. Fallback to defaults when terms missing
 * 5. Partial terms handling
 * 6. Edge cases (negative values, missing tiers, etc.)
 */

import {
  calculateTotalCostImpact,
  calculateTotalCostImpactWithTerms,
  convertExtractedTermsToRules,
  validateExtractedTermsForCostCalculation,
} from '../lib/cost-engine';
import { DEFAULT_CONTRACT_RULES } from '../types/cost';
import type { ExtractedContractTerms } from '../types/contract';
import type { Retailer } from '../types/dispatch';

// ANSI color codes for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let passedTests = 0;
let failedTests = 0;

function printHeader(text: string) {
  console.log(`\n${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}  ${text}${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${RESET}\n`);
}

function printTest(name: string) {
  console.log(`${YELLOW}▶ TEST: ${name}${RESET}`);
}

function pass(message: string) {
  console.log(`${GREEN}  ✓ ${message}${RESET}`);
  passedTests++;
}

function fail(message: string) {
  console.log(`${RED}  ✗ ${message}${RESET}`);
  failedTests++;
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    pass(`${message}: ${actual}`);
  } else {
    fail(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition: boolean, message: string) {
  if (condition) {
    pass(message);
  } else {
    fail(message);
  }
}

// Sample extracted terms for testing
const sampleExtractedTerms: ExtractedContractTerms = {
  parties: {
    shipper: 'Global Foods Distribution LLC',
    carrier: 'Highway Express Transport Co.',
    consignee: 'Target Corporation',
    warehouse: 'Target DC #1234',
  },
  complianceWindows: [
    {
      name: 'OTIF Delivery',
      windowMinutes: 60, // ±30 min
      description: 'On-time in-full delivery window',
    },
  ],
  delayPenalties: [
    {
      name: 'Detention',
      freeTimeMinutes: 120, // 2 hours
      tiers: [
        { fromMinutes: 120, toMinutes: 240, ratePerHour: 75 },
        { fromMinutes: 240, toMinutes: null, ratePerHour: 100 },
      ],
    },
  ],
  partyPenalties: [
    {
      partyName: 'Target Corporation',
      penaltyType: 'OTIF Violation',
      percentage: 3,
      conditions: 'Applied to invoice value when OTIF target missed',
    },
    {
      partyName: 'Target Corporation',
      penaltyType: 'Late Delivery',
      perOccurrence: 250,
      conditions: 'Per late delivery occurrence',
    },
  ],
  otherTerms: [
    {
      name: 'Layover Fee',
      description: 'Driver layover compensation',
      financialImpact: '$300/day after 24 hours',
    },
  ],
  _meta: {
    documentName: 'target-contract.pdf',
    extractedAt: new Date().toISOString(),
    confidence: 'high',
    warnings: [],
  },
};

// ============================================
// Test 1: Validate Extracted Terms Structure
// ============================================
function testValidateExtractedTerms() {
  printTest('Validate extracted terms structure');

  // Valid terms
  const result = validateExtractedTermsForCostCalculation(sampleExtractedTerms);
  assertTrue(result.valid, 'Sample terms should be valid');
  
  if (result.warnings.length > 0) {
    console.log(`  Warnings: ${result.warnings.join(', ')}`);
  }

  // Terms without delay penalties
  const noDelayTerms: ExtractedContractTerms = {
    ...sampleExtractedTerms,
    delayPenalties: undefined,
  };
  const noDelayResult = validateExtractedTermsForCostCalculation(noDelayTerms);
  assertTrue(noDelayResult.warnings.length > 0, 'Missing delay penalties should generate warning');

  // Terms without compliance windows
  const noComplianceTerms: ExtractedContractTerms = {
    ...sampleExtractedTerms,
    complianceWindows: undefined,
  };
  const noComplianceResult = validateExtractedTermsForCostCalculation(noComplianceTerms);
  assertTrue(noComplianceResult.warnings.length > 0, 'Missing compliance windows should generate warning');
}

// ============================================
// Test 2: Convert Extracted Terms to Rules
// ============================================
function testConvertExtractedTermsToRules() {
  printTest('Convert extracted terms to legacy rules format');

  const rules = convertExtractedTermsToRules(sampleExtractedTerms);

  // Check OTIF window conversion (rules.otif.windowMinutes)
  assertEqual(rules.otif.windowMinutes, 30, 'OTIF window should be half of total window');

  // Check dwell rules conversion (rules.dwellTime)
  assertTrue(rules.dwellTime !== undefined, 'Dwell rules should be present');
  assertEqual(rules.dwellTime.freeHours, 2, 'Free time should be 2 hours');
  assertTrue(rules.dwellTime.tiers.length >= 1, 'Should have at least 1 tier');

  // Check retailer chargebacks
  const targetChargebacks = rules.retailerChargebacks?.['Target' as Retailer];
  assertTrue(targetChargebacks !== undefined, 'Target chargebacks should be present');
}

// ============================================
// Test 3: Cost Calculation with Extracted Terms
// ============================================
function testCostCalculationWithTerms() {
  printTest('Calculate costs with extracted terms');

  // Scenario 1: Small delay within OTIF
  const smallDelay = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '14:20', // 20 min late, within 30 min OTIF
    shipmentValue: 50000,
    extractedTerms: sampleExtractedTerms,
  });
  
  console.log(`  Small delay (20 min): $${smallDelay.totalCost}`);
  assertTrue(smallDelay.totalCost === 0 || smallDelay.totalCost < 100, 'Small delay should have minimal cost');

  // Scenario 2: Outside OTIF, within free time
  const mediumDelay = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '15:30', // 90 min late, outside OTIF but within 2hr free time
    shipmentValue: 50000,
    extractedTerms: sampleExtractedTerms,
  });
  
  console.log(`  Medium delay (90 min): $${mediumDelay.totalCost}`);
  // Should have OTIF violation cost (3% of $50k = $1,500) but no dwell
  assertTrue(mediumDelay.totalCost > 0, 'Medium delay should have cost');

  // Scenario 3: Large delay with dwell time
  const largeDelay = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '18:00', // 4 hours late, will have dwell time
    shipmentValue: 50000,
    extractedTerms: sampleExtractedTerms,
  });
  
  console.log(`  Large delay (4 hours): $${largeDelay.totalCost}`);
  assertTrue(largeDelay.totalCost > mediumDelay.totalCost, 'Large delay should cost more than medium');
}

// ============================================
// Test 4: Fallback to Defaults
// ============================================
function testFallbackToDefaults() {
  printTest('Fallback to defaults when terms missing');

  // No extracted terms
  const withoutTerms = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '16:00',
    shipmentValue: 50000,
    extractedTerms: undefined,
  });
  
  console.log(`  Without terms: $${withoutTerms.totalCost}`);
  assertTrue(withoutTerms.totalCost >= 0, 'Should calculate cost with defaults');

  // Compare to direct default calculation
  const withDefaults = calculateTotalCostImpact(
    {
      originalAppointmentTime: '14:00',
      newAppointmentTime: '16:00',
      shipmentValue: 50000,
      retailer: 'Walmart' as Retailer,
    },
    DEFAULT_CONTRACT_RULES
  );
  
  console.log(`  With defaults directly: $${withDefaults.totalCost}`);
  // Costs should be similar (may not be exact due to party matching)
  assertTrue(Math.abs(withoutTerms.totalCost - withDefaults.totalCost) < 500, 
    'Fallback should produce similar results to direct defaults');
}

// ============================================
// Test 5: Partial Terms Handling
// ============================================
function testPartialTermsHandling() {
  printTest('Partial terms handling');

  // Only compliance windows, no delay penalties
  const onlyComplianceTerms: ExtractedContractTerms = {
    parties: { shipper: 'Test Shipper', carrier: 'Test Carrier' },
    complianceWindows: [
      { name: 'Delivery Window', windowMinutes: 60 },
    ],
    _meta: {
      documentName: 'partial.pdf',
      extractedAt: new Date().toISOString(),
      confidence: 'medium',
    },
  };

  const partialResult = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '16:00',
    shipmentValue: 50000,
    extractedTerms: onlyComplianceTerms,
  });

  console.log(`  Partial terms (only compliance): $${partialResult.totalCost}`);
  assertTrue(partialResult.totalCost >= 0, 'Should handle partial terms gracefully');

  // Only delay penalties, no compliance windows
  const onlyDelayTerms: ExtractedContractTerms = {
    parties: { shipper: 'Test Shipper' },
    delayPenalties: [
      {
        name: 'Dwell Time',
        freeTimeMinutes: 60,
        tiers: [{ fromMinutes: 60, toMinutes: null, ratePerHour: 50 }],
      },
    ],
    _meta: {
      documentName: 'partial.pdf',
      extractedAt: new Date().toISOString(),
      confidence: 'medium',
    },
  };

  const onlyDelayResult = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '16:00',
    shipmentValue: 50000,
    extractedTerms: onlyDelayTerms,
  });

  console.log(`  Partial terms (only delays): $${onlyDelayResult.totalCost}`);
  assertTrue(onlyDelayResult.totalCost >= 0, 'Should handle delay-only terms gracefully');
}

// ============================================
// Test 6: Edge Cases
// ============================================
function testEdgeCases() {
  printTest('Edge cases');

  // Same time (no delay)
  const noDelay = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '14:00',
    shipmentValue: 50000,
    extractedTerms: sampleExtractedTerms,
  });
  assertEqual(noDelay.totalCost, 0, 'No delay should have zero cost');

  // Very large delay
  const veryLargeDelay = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '22:00', // 8 hours
    shipmentValue: 50000,
    extractedTerms: sampleExtractedTerms,
  });
  console.log(`  Very large delay (8 hours): $${veryLargeDelay.totalCost}`);
  assertTrue(veryLargeDelay.totalCost > 0, 'Large delay should have significant cost');

  // Zero shipment value
  const zeroValue = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '16:00',
    shipmentValue: 0,
    extractedTerms: sampleExtractedTerms,
  });
  console.log(`  Zero shipment value: $${zeroValue.totalCost}`);
  // Percentage-based penalties would be 0, but hourly fees may apply

  // High value shipment
  const highValue = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '15:30',
    shipmentValue: 500000, // $500k shipment
    extractedTerms: sampleExtractedTerms,
  });
  console.log(`  High value shipment ($500k): $${highValue.totalCost}`);
  assertTrue(highValue.totalCost > 0, 'High value with OTIF violation should have cost');
}

// ============================================
// Test 7: Party Name Matching
// ============================================
function testPartyNameMatching() {
  printTest('Party name matching');

  // Exact match
  const exactMatch = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '15:30',
    shipmentValue: 50000,
    extractedTerms: sampleExtractedTerms,
    partyName: 'Target Corporation',
  });
  console.log(`  Exact match (Target Corporation): $${exactMatch.totalCost}`);

  // Partial match (should still work with case-insensitive)
  const partialMatch = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '15:30',
    shipmentValue: 50000,
    extractedTerms: sampleExtractedTerms,
    partyName: 'target',
  });
  console.log(`  Partial match (target): $${partialMatch.totalCost}`);

  // Different party (should fallback to defaults)
  const differentParty = calculateTotalCostImpactWithTerms({
    originalAppointmentTime: '14:00',
    newAppointmentTime: '15:30',
    shipmentValue: 50000,
    extractedTerms: sampleExtractedTerms,
    partyName: 'Costco',
  });
  console.log(`  Different party (Costco): $${differentParty.totalCost}`);
  
  // All should produce valid costs
  assertTrue(exactMatch.totalCost >= 0, 'Exact match should produce valid cost');
  assertTrue(partialMatch.totalCost >= 0, 'Partial match should produce valid cost');
  assertTrue(differentParty.totalCost >= 0, 'Different party should fallback gracefully');
}

// ============================================
// Main Execution
// ============================================
function main() {
  console.log(`\n${BLUE}╔═══════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║  Cost Engine Unit Tests - Phase 7.8                        ║${RESET}`);
  console.log(`${BLUE}╚═══════════════════════════════════════════════════════════╝${RESET}`);

  try {
    testValidateExtractedTerms();
    testConvertExtractedTermsToRules();
    testCostCalculationWithTerms();
    testFallbackToDefaults();
    testPartialTermsHandling();
    testEdgeCases();
    testPartyNameMatching();
  } catch (error) {
    console.error(`\n${RED}Test execution error:${RESET}`, error);
    process.exit(1);
  }

  printHeader('Test Summary');
  console.log(`  ${GREEN}Passed:${RESET} ${passedTests}`);
  console.log(`  ${RED}Failed:${RESET} ${failedTests}`);
  console.log('');

  if (failedTests === 0) {
    console.log(`${GREEN}All ${passedTests} tests passed!${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${RED}${failedTests} of ${passedTests + failedTests} tests failed${RESET}\n`);
    process.exit(1);
  }
}

main();
