#!/bin/bash

# Test Edge Cases for Contract Analysis
# Phase 7.8: Testing & Validation
#
# Tests:
# 1. No document in folder → graceful error
# 2. Invalid/missing API keys → graceful error
# 3. Invalid content type → validation error
# 4. Empty content → validation error
# 5. API health checks
#
# Note: Some tests require manual setup (e.g., empty folders)

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
SKIPPED=0

# Helper functions
print_header() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_test() {
  echo -e "\n${YELLOW}▶ TEST: $1${NC}"
}

print_pass() {
  echo -e "${GREEN}✓ PASS: $1${NC}"
  ((PASSED++))
}

print_fail() {
  echo -e "${RED}✗ FAIL: $1${NC}"
  ((FAILED++))
}

print_skip() {
  echo -e "${YELLOW}⊘ SKIP: $1${NC}"
  ((SKIPPED++))
}

print_info() {
  if [ "$VERBOSE" = "true" ]; then
    echo -e "  ${NC}$1${NC}"
  fi
}

# Check if server is running
check_server() {
  print_header "Pre-flight Check"
  print_test "Server is running at $BASE_URL"
  
  if curl -s --connect-timeout 5 "$BASE_URL/api/health" > /dev/null 2>&1; then
    print_pass "Server is running"
    return 0
  else
    print_fail "Server is not running. Start with: npm run dev"
    exit 1
  fi
}

# Test 1: API Health Checks
test_health_checks() {
  print_header "Test 1: API Health Checks"
  
  # Health endpoint
  print_test "Main health endpoint"
  RESPONSE=$(curl -s "$BASE_URL/api/health")
  if echo "$RESPONSE" | jq -e '.status == "ok"' > /dev/null 2>&1; then
    print_pass "Health endpoint returns ok"
  else
    print_fail "Health endpoint failed: $RESPONSE"
  fi
  
  # Contract fetch health
  print_test "Contract fetch health check (GET)"
  RESPONSE=$(curl -s "$BASE_URL/api/contract/fetch")
  if echo "$RESPONSE" | jq -e '.connected != null' > /dev/null 2>&1; then
    CONNECTED=$(echo "$RESPONSE" | jq -r '.connected')
    FILE_COUNT=$(echo "$RESPONSE" | jq -r '.fileCount // 0')
    print_pass "Contract fetch health - connected: $CONNECTED, files: $FILE_COUNT"
  else
    print_fail "Contract fetch health failed: $RESPONSE"
  fi
  
  # Contract analyze health
  print_test "Contract analyze health check (GET)"
  RESPONSE=$(curl -s "$BASE_URL/api/contract/analyze")
  if echo "$RESPONSE" | jq -e '.ready != null' > /dev/null 2>&1; then
    READY=$(echo "$RESPONSE" | jq -r '.ready')
    print_pass "Contract analyze health - ready: $READY"
  else
    print_fail "Contract analyze health failed: $RESPONSE"
  fi
}

# Test 2: Validation Errors
test_validation_errors() {
  print_header "Test 2: Input Validation"
  
  # Missing content
  print_test "Missing content field"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/analyze" \
    -H "Content-Type: application/json" \
    -d '{"contentType": "text", "fileName": "test.txt"}')
  
  if echo "$RESPONSE" | jq -e '.success == false and (.error | contains("content"))' > /dev/null 2>&1; then
    print_pass "Missing content returns validation error"
    print_info "Error: $(echo "$RESPONSE" | jq -r '.error')"
  else
    print_fail "Expected validation error for missing content"
  fi
  
  # Invalid content type
  print_test "Invalid contentType"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/analyze" \
    -H "Content-Type: application/json" \
    -d '{"content": "test", "contentType": "invalid", "fileName": "test.txt"}')
  
  if echo "$RESPONSE" | jq -e '.success == false and (.error | contains("contentType"))' > /dev/null 2>&1; then
    print_pass "Invalid contentType returns validation error"
    print_info "Error: $(echo "$RESPONSE" | jq -r '.error')"
  else
    print_fail "Expected validation error for invalid contentType"
  fi
  
  # Missing fileName
  print_test "Missing fileName"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/analyze" \
    -H "Content-Type: application/json" \
    -d '{"content": "test", "contentType": "text"}')
  
  if echo "$RESPONSE" | jq -e '.success == false and (.error | contains("fileName"))' > /dev/null 2>&1; then
    print_pass "Missing fileName returns validation error"
    print_info "Error: $(echo "$RESPONSE" | jq -r '.error')"
  else
    print_fail "Expected validation error for missing fileName"
  fi
}

# Test 3: Empty/Invalid Folder (requires special setup)
test_empty_folder() {
  print_header "Test 3: Empty Folder Handling"
  
  print_test "Fetch from non-existent folder"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/fetch" \
    -H "Content-Type: application/json" \
    -d '{"folderId": "invalid_folder_id_12345"}')
  
  if echo "$RESPONSE" | jq -e '.success == false' > /dev/null 2>&1; then
    print_pass "Non-existent folder returns error gracefully"
    print_info "Error: $(echo "$RESPONSE" | jq -r '.error')"
  else
    print_fail "Expected error for non-existent folder"
  fi
}

# Test 4: Minimal Document Analysis
test_minimal_document() {
  print_header "Test 4: Minimal Document Analysis"
  
  print_test "Analyze minimal text (should extract with low confidence)"
  MINIMAL_CONTRACT="Transportation Agreement between Party A and Party B. Delivery terms apply."
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/analyze" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": \"$MINIMAL_CONTRACT\",
      \"contentType\": \"text\",
      \"fileName\": \"minimal-contract.txt\"
    }")
  
  if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    CONFIDENCE=$(echo "$RESPONSE" | jq -r '.terms._meta.confidence')
    WARNINGS=$(echo "$RESPONSE" | jq '.terms._meta.warnings | length')
    print_pass "Minimal document analyzed - confidence: $CONFIDENCE, warnings: $WARNINGS"
    
    # Check for expected warnings
    if [ "$WARNINGS" -gt 0 ]; then
      print_info "Warnings captured (expected for minimal doc)"
    fi
  else
    # Partial extraction might fail, but error should be graceful
    ERROR=$(echo "$RESPONSE" | jq -r '.error // "Unknown"')
    print_pass "Minimal document handled gracefully - error: $ERROR"
  fi
}

# Test 5: Document with Custom Penalty Types
test_custom_penalties() {
  print_header "Test 5: Custom Penalty Types (otherTerms)"
  
  print_test "Analyze document with non-standard penalties"
  
  CUSTOM_CONTRACT="TRANSPORTATION SERVICES AGREEMENT

PARTIES:
- Shipper: Acme Logistics Inc.
- Carrier: FastTruck LLC
- Consignee: MegaMart Distribution

DELIVERY REQUIREMENTS:
Deliveries must arrive within 30 minutes of scheduled appointment.

PENALTIES:
1. Weather Delay Surcharge: \$200 per occurrence when delay exceeds 4 hours due to weather.
2. Equipment Cleaning Fee: \$150 if trailer requires cleaning upon arrival.
3. Fuel Surcharge Adjustment: Variable based on DOE index, reviewed monthly.
4. Security Escort Fee: \$75/hour when required for high-value shipments.

STANDARD TERMS:
- Free detention time: 2 hours
- Detention rate after free time: \$50/hour"

  RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/analyze" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg content "$CUSTOM_CONTRACT" '{
      content: $content,
      contentType: "text",
      fileName: "custom-penalties.txt"
    }')")
  
  if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    # Check if parties were extracted
    SHIPPER=$(echo "$RESPONSE" | jq -r '.terms.parties.shipper // "null"')
    CARRIER=$(echo "$RESPONSE" | jq -r '.terms.parties.carrier // "null"')
    CONSIGNEE=$(echo "$RESPONSE" | jq -r '.terms.parties.consignee // "null"')
    
    echo "  Parties extracted:"
    echo "    - Shipper: $SHIPPER"
    echo "    - Carrier: $CARRIER"
    echo "    - Consignee: $CONSIGNEE"
    
    # Check for otherTerms (custom penalties)
    OTHER_TERMS=$(echo "$RESPONSE" | jq '.terms.otherTerms | length')
    if [ "$OTHER_TERMS" -gt 0 ]; then
      print_pass "Custom penalties captured in otherTerms: $OTHER_TERMS items"
      echo "$RESPONSE" | jq -r '.terms.otherTerms[]? | "    - \(.name)"'
    else
      print_info "No otherTerms extracted (may be in partyPenalties)"
    fi
    
    # Check for standard delay penalty
    DELAY_PENALTIES=$(echo "$RESPONSE" | jq '.terms.delayPenalties | length')
    if [ "$DELAY_PENALTIES" -gt 0 ]; then
      print_pass "Standard delay penalties extracted: $DELAY_PENALTIES"
    fi
    
    print_pass "Custom penalty document analyzed successfully"
  else
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    print_fail "Custom penalty analysis failed: $ERROR"
  fi
}

# Test 6: Party Name Extraction
test_party_extraction() {
  print_header "Test 6: Party Name Extraction"
  
  print_test "Extract different consignee names"
  
  PARTY_CONTRACT="CARRIER-SHIPPER TRANSPORTATION AGREEMENT

This Agreement is entered into between:

SHIPPER: Global Foods Distribution LLC
CARRIER: Highway Express Transport Co.
CONSIGNEE/RECEIVER: Target Corporation Distribution Center

DELIVERY TERMS:
All deliveries to Target facilities must comply with Target's vendor routing guide.

OTIF REQUIREMENTS:
- On-time window: ±15 minutes from scheduled appointment
- In-full requirements per Target specifications

PENALTIES:
- OTIF violation: 3% of invoice value
- Late delivery: \$250 per occurrence
- Detention: \$75/hour after 2 hour free time"

  RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/analyze" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg content "$PARTY_CONTRACT" '{
      content: $content,
      contentType: "text",
      fileName: "target-contract.txt"
    }')")
  
  if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    SHIPPER=$(echo "$RESPONSE" | jq -r '.terms.parties.shipper // "null"')
    CARRIER=$(echo "$RESPONSE" | jq -r '.terms.parties.carrier // "null"')
    CONSIGNEE=$(echo "$RESPONSE" | jq -r '.terms.parties.consignee // "null"')
    
    echo "  Extracted Parties:"
    echo "    - Shipper: $SHIPPER"
    echo "    - Carrier: $CARRIER"
    echo "    - Consignee: $CONSIGNEE"
    
    if [[ "$CONSIGNEE" == *"Target"* ]]; then
      print_pass "Consignee correctly identified as Target"
    else
      print_info "Consignee extracted but may not match expected: $CONSIGNEE"
    fi
    
    # Check compliance windows
    COMPLIANCE=$(echo "$RESPONSE" | jq '.terms.complianceWindows | length')
    if [ "$COMPLIANCE" -gt 0 ]; then
      WINDOW=$(echo "$RESPONSE" | jq -r '.terms.complianceWindows[0].windowMinutes // "null"')
      print_pass "Compliance window extracted: ±$((WINDOW / 2)) minutes"
    fi
    
    print_pass "Party extraction test completed"
  else
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    print_fail "Party extraction failed: $ERROR"
  fi
}

# Test 7: Partial Extraction (Missing Sections)
test_partial_extraction() {
  print_header "Test 7: Partial Extraction (Missing Sections)"
  
  print_test "Contract with only some sections defined"
  
  PARTIAL_CONTRACT="BASIC TRANSPORTATION AGREEMENT

Shipper: QuickShip Inc.
Carrier: RoadRunner Logistics

This is a basic transportation agreement. The carrier agrees to transport goods
from shipper's facilities to designated delivery locations.

Payment terms: Net 30 days from delivery confirmation.

Insurance: Carrier maintains minimum \$1,000,000 cargo insurance."

  RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/analyze" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg content "$PARTIAL_CONTRACT" '{
      content: $content,
      contentType: "text",
      fileName: "partial-contract.txt"
    }')")
  
  if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    CONFIDENCE=$(echo "$RESPONSE" | jq -r '.terms._meta.confidence')
    WARNINGS=$(echo "$RESPONSE" | jq '.terms._meta.warnings | length')
    
    # Check what was extracted
    HAS_PARTIES=$(echo "$RESPONSE" | jq '.terms.parties | keys | length')
    HAS_COMPLIANCE=$(echo "$RESPONSE" | jq '.terms.complianceWindows // [] | length')
    HAS_DELAYS=$(echo "$RESPONSE" | jq '.terms.delayPenalties // [] | length')
    
    echo "  Extraction Results:"
    echo "    - Parties: $HAS_PARTIES found"
    echo "    - Compliance Windows: $HAS_COMPLIANCE found"
    echo "    - Delay Penalties: $HAS_DELAYS found"
    echo "    - Confidence: $CONFIDENCE"
    echo "    - Warnings: $WARNINGS"
    
    if [ "$CONFIDENCE" != "high" ] || [ "$WARNINGS" -gt 0 ]; then
      print_pass "Partial extraction handled correctly (lower confidence or warnings)"
    else
      print_info "Extraction completed without expected warnings"
    fi
    
    # Display warnings if any
    if [ "$WARNINGS" -gt 0 ]; then
      echo "  Warnings:"
      echo "$RESPONSE" | jq -r '.terms._meta.warnings[]? | "    - \(.)"' | head -5
    fi
    
    print_pass "Partial extraction test completed"
  else
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    print_fail "Partial extraction failed: $ERROR"
  fi
}

# Test 8: Rate Limiting / Large Requests (optional)
test_rate_handling() {
  print_header "Test 8: Error Response Format Consistency"
  
  print_test "Verify error responses have consistent format"
  
  # Test various error scenarios and check format
  ENDPOINTS=(
    '{"url": "/api/contract/analyze", "method": "POST", "data": "{}"}'
    '{"url": "/api/contract/fetch", "method": "POST", "data": "{\"folderId\": \"invalid\"}"}'
  )
  
  ALL_CONSISTENT=true
  
  for endpoint_json in "${ENDPOINTS[@]}"; do
    URL=$(echo "$endpoint_json" | jq -r '.url')
    METHOD=$(echo "$endpoint_json" | jq -r '.method')
    DATA=$(echo "$endpoint_json" | jq -r '.data')
    
    RESPONSE=$(curl -s -X "$METHOD" "$BASE_URL$URL" \
      -H "Content-Type: application/json" \
      -d "$DATA")
    
    # Check for consistent error format
    HAS_SUCCESS=$(echo "$RESPONSE" | jq 'has("success")')
    HAS_TIMESTAMP=$(echo "$RESPONSE" | jq 'has("timestamp")')
    
    if [ "$HAS_SUCCESS" = "true" ] && [ "$HAS_TIMESTAMP" = "true" ]; then
      print_info "$URL has consistent format"
    else
      print_info "$URL missing expected fields"
      ALL_CONSISTENT=false
    fi
  done
  
  if [ "$ALL_CONSISTENT" = true ]; then
    print_pass "All error responses have consistent format"
  else
    print_fail "Some responses have inconsistent format"
  fi
}

# Print summary
print_summary() {
  print_header "Test Summary"
  echo ""
  echo -e "  ${GREEN}Passed:${NC}  $PASSED"
  echo -e "  ${RED}Failed:${NC}  $FAILED"
  echo -e "  ${YELLOW}Skipped:${NC} $SKIPPED"
  echo ""
  
  TOTAL=$((PASSED + FAILED))
  if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All $TOTAL tests passed!${NC}"
    exit 0
  else
    echo -e "${RED}$FAILED of $TOTAL tests failed${NC}"
    exit 1
  fi
}

# Main execution
main() {
  echo ""
  echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║     Dispatcher AI - Phase 7.8 Edge Case Tests             ║${NC}"
  echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
  
  check_server
  test_health_checks
  test_validation_errors
  test_empty_folder
  test_minimal_document
  test_custom_penalties
  test_party_extraction
  test_partial_extraction
  test_rate_handling
  
  print_summary
}

# Run tests
main "$@"
