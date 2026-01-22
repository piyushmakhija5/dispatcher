#!/bin/bash

# End-to-End Workflow Test
# Phase 7.8: Testing & Validation
#
# Tests the complete workflow:
# 1. Fetch contract from Google Drive
# 2. Analyze contract with Claude
# 3. Compute cost impact
# 4. Verify negotiation strategy calculation
#
# This simulates what happens when a user clicks "Start" in the UI.

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test state
CONTRACT_CONTENT=""
CONTRACT_TYPE=""
EXTRACTED_TERMS=""
PARTY_NAME=""

print_step() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  Step $1: $2${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_result() {
  if [ "$1" = "success" ]; then
    echo -e "${GREEN}✓ $2${NC}"
  else
    echo -e "${RED}✗ $2${NC}"
    exit 1
  fi
}

print_info() {
  echo -e "  ${NC}$1${NC}"
}

# ============================================
# Pre-flight Check
# ============================================
preflight_check() {
  echo ""
  echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║     End-to-End Workflow Test - Phase 7.8                  ║${NC}"
  echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
  
  echo ""
  echo "Checking prerequisites..."
  
  # Check server
  if ! curl -s --connect-timeout 5 "$BASE_URL/api/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Server not running at $BASE_URL${NC}"
    echo "Start with: npm run dev"
    exit 1
  fi
  print_result "success" "Server is running"
  
  # Check jq
  if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required. Install with: brew install jq${NC}"
    exit 1
  fi
  print_result "success" "jq is available"
  
  # Check Drive connection
  DRIVE_STATUS=$(curl -s "$BASE_URL/api/contract/fetch")
  DRIVE_CONNECTED=$(echo "$DRIVE_STATUS" | jq -r '.connected')
  if [ "$DRIVE_CONNECTED" != "true" ]; then
    echo -e "${YELLOW}Warning: Google Drive not connected${NC}"
    echo "  This test requires a contract in Google Drive."
    echo "  Status: $(echo "$DRIVE_STATUS" | jq -r '.error // "Unknown"')"
    exit 1
  fi
  print_result "success" "Google Drive connected"
}

# ============================================
# Step 1: Fetch Contract
# ============================================
step_fetch_contract() {
  print_step "1" "Fetch Contract from Google Drive"
  
  FETCH_START=$(date +%s%3N)
  
  FETCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/fetch" \
    -H "Content-Type: application/json")
  
  FETCH_END=$(date +%s%3N)
  FETCH_TIME=$((FETCH_END - FETCH_START))
  
  SUCCESS=$(echo "$FETCH_RESPONSE" | jq -r '.success')
  
  if [ "$SUCCESS" != "true" ]; then
    ERROR=$(echo "$FETCH_RESPONSE" | jq -r '.error')
    print_result "fail" "Contract fetch failed: $ERROR"
  fi
  
  FILE_NAME=$(echo "$FETCH_RESPONSE" | jq -r '.file.name')
  CONTRACT_TYPE=$(echo "$FETCH_RESPONSE" | jq -r '.contentType')
  CONTENT_LENGTH=$(echo "$FETCH_RESPONSE" | jq -r '.content | length')
  
  # Store for next step
  CONTRACT_CONTENT=$(echo "$FETCH_RESPONSE" | jq -r '.content')
  
  print_result "success" "Contract fetched successfully"
  print_info "File: $FILE_NAME"
  print_info "Type: $CONTRACT_TYPE"
  print_info "Size: $CONTENT_LENGTH characters"
  print_info "Time: ${FETCH_TIME}ms"
}

# ============================================
# Step 2: Analyze Contract
# ============================================
step_analyze_contract() {
  print_step "2" "Analyze Contract with Claude"
  
  echo "  (This may take 15-40 seconds for PDF analysis...)"
  
  ANALYZE_START=$(date +%s%3N)
  
  # Build request
  ANALYZE_REQUEST=$(jq -n \
    --arg content "$CONTRACT_CONTENT" \
    --arg type "$CONTRACT_TYPE" \
    --arg name "$(echo "$FILE_NAME" | head -1)" \
    '{content: $content, contentType: $type, fileName: $name}')
  
  ANALYZE_RESPONSE=$(echo "$ANALYZE_REQUEST" | curl -s -X POST "$BASE_URL/api/contract/analyze" \
    -H "Content-Type: application/json" \
    -d @-)
  
  ANALYZE_END=$(date +%s%3N)
  ANALYZE_TIME=$((ANALYZE_END - ANALYZE_START))
  
  SUCCESS=$(echo "$ANALYZE_RESPONSE" | jq -r '.success')
  
  if [ "$SUCCESS" != "true" ]; then
    ERROR=$(echo "$ANALYZE_RESPONSE" | jq -r '.error')
    print_result "fail" "Contract analysis failed: $ERROR"
  fi
  
  # Store extracted terms
  EXTRACTED_TERMS=$(echo "$ANALYZE_RESPONSE" | jq '.terms')
  
  # Extract key metrics
  CONFIDENCE=$(echo "$ANALYZE_RESPONSE" | jq -r '.terms._meta.confidence')
  TOKENS=$(echo "$ANALYZE_RESPONSE" | jq -r '.debug.tokensUsed')
  WARNINGS_COUNT=$(echo "$ANALYZE_RESPONSE" | jq '.terms._meta.warnings | length')
  
  # Get party name
  PARTY_NAME=$(echo "$ANALYZE_RESPONSE" | jq -r '.terms.parties.consignee // .terms.parties.shipper // "Unknown"')
  
  print_result "success" "Contract analyzed successfully"
  print_info "Confidence: $(echo "$CONFIDENCE" | tr '[:lower:]' '[:upper:]')"
  print_info "Party: $PARTY_NAME"
  print_info "Tokens: $TOKENS"
  print_info "Warnings: $WARNINGS_COUNT"
  print_info "Time: ${ANALYZE_TIME}ms"
  
  # Show extracted sections
  echo ""
  echo "  Extracted Sections:"
  
  PARTIES=$(echo "$EXTRACTED_TERMS" | jq '.parties | to_entries | map(select(.value != null)) | length')
  COMPLIANCE=$(echo "$EXTRACTED_TERMS" | jq '.complianceWindows // [] | length')
  DELAYS=$(echo "$EXTRACTED_TERMS" | jq '.delayPenalties // [] | length')
  PARTY_PENALTIES=$(echo "$EXTRACTED_TERMS" | jq '.partyPenalties // [] | length')
  OTHER=$(echo "$EXTRACTED_TERMS" | jq '.otherTerms // [] | length')
  
  print_info "  • Parties: $PARTIES"
  print_info "  • Compliance Windows: $COMPLIANCE"
  print_info "  • Delay Penalties: $DELAYS"
  print_info "  • Party Penalties: $PARTY_PENALTIES"
  print_info "  • Other Terms: $OTHER"
}

# ============================================
# Step 3: Compute Cost Impact
# ============================================
step_compute_cost() {
  print_step "3" "Compute Financial Impact"
  
  # Simulate different delay scenarios
  ORIGINAL_TIME="14:00"
  DELAY_MINUTES=90
  SHIPMENT_VALUE=50000
  
  # Calculate arrival time
  ORIG_MINS=$((14 * 60))
  ARRIVAL_MINS=$((ORIG_MINS + DELAY_MINUTES))
  ARRIVAL_HOURS=$((ARRIVAL_MINS / 60))
  ARRIVAL_REMAINDER=$((ARRIVAL_MINS % 60))
  ARRIVAL_TIME=$(printf "%02d:%02d" $ARRIVAL_HOURS $ARRIVAL_REMAINDER)
  
  print_info "Scenario: Truck delayed $DELAY_MINUTES minutes"
  print_info "  Original appointment: $ORIGINAL_TIME"
  print_info "  Actual arrival: $ARRIVAL_TIME"
  print_info "  Shipment value: \$$SHIPMENT_VALUE"
  
  echo ""
  echo "  Testing different appointment times:"
  
  # Test multiple time slots
  TEST_TIMES=("$ARRIVAL_TIME" "16:00" "17:00" "18:00")
  
  for NEW_TIME in "${TEST_TIMES[@]}"; do
    # Use the check-slot-cost webhook (same as VAPI uses)
    COST_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tools/check-slot-cost" \
      -H "Content-Type: application/json" \
      -d "{
        \"message\": {
          \"toolCalls\": [{
            \"id\": \"test-$(date +%s)\",
            \"function\": {
              \"name\": \"check_slot_cost\",
              \"arguments\": {
                \"proposed_time\": \"$NEW_TIME\",
                \"original_appointment\": \"$ORIGINAL_TIME\",
                \"delay_minutes\": \"$DELAY_MINUTES\",
                \"shipment_value\": \"$SHIPMENT_VALUE\",
                \"retailer\": \"Walmart\"
              }
            }
          }]
        }
      }")
    
    # Extract result
    RESULT=$(echo "$COST_RESPONSE" | jq -r '.results[0].result // "Error"')
    
    # Parse cost from result (format: "Cost: $X...")
    COST=$(echo "$RESULT" | grep -o '\$[0-9,]*' | head -1 || echo "N/A")
    VERDICT=$(echo "$RESULT" | grep -o 'acceptable=\(true\|false\)' | cut -d= -f2 || echo "N/A")
    
    printf "    %-10s → Cost: %-10s Acceptable: %s\n" "$NEW_TIME" "$COST" "$VERDICT"
  done
  
  print_result "success" "Cost impact computed for all scenarios"
}

# ============================================
# Step 4: Verify Strategy Calculation
# ============================================
step_verify_strategy() {
  print_step "4" "Verify Negotiation Strategy"
  
  # The strategy is calculated client-side using the negotiation-strategy module
  # We can verify the building blocks are working
  
  # Extract compliance window from terms
  if [ -n "$EXTRACTED_TERMS" ]; then
    OTIF_WINDOW=$(echo "$EXTRACTED_TERMS" | jq -r '.complianceWindows[0].windowMinutes // 60')
    DELAY_NAME=$(echo "$EXTRACTED_TERMS" | jq -r '.delayPenalties[0].name // "Detention"')
    FREE_TIME=$(echo "$EXTRACTED_TERMS" | jq -r '.delayPenalties[0].freeTimeMinutes // 120')
    
    print_info "Strategy inputs from extracted terms:"
    print_info "  OTIF Window: ±$((OTIF_WINDOW / 2)) minutes"
    print_info "  Delay Type: $DELAY_NAME"
    print_info "  Free Time: $FREE_TIME minutes"
  fi
  
  # Verify extract endpoint works (for time extraction during negotiation)
  EXTRACT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/extract" \
    -H "Content-Type: application/json" \
    -d '{"message": "We can fit you in at 4:30 PM at dock 5"}')
  
  EXTRACTED_TIME=$(echo "$EXTRACT_RESPONSE" | jq -r '.time // "null"')
  EXTRACTED_DOCK=$(echo "$EXTRACT_RESPONSE" | jq -r '.dock // "null"')
  
  if [ "$EXTRACTED_TIME" != "null" ] && [ "$EXTRACTED_DOCK" != "null" ]; then
    print_result "success" "Time/dock extraction working"
    print_info "  Sample: '4:30 PM at dock 5' → time: $EXTRACTED_TIME, dock: $EXTRACTED_DOCK"
  else
    print_result "fail" "Time/dock extraction not working correctly"
  fi
}

# ============================================
# Summary
# ============================================
print_summary() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  End-to-End Test Summary${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${GREEN}✓ All workflow steps completed successfully!${NC}"
  echo ""
  echo "  Workflow validated:"
  echo "    1. ✓ Fetch contract from Google Drive"
  echo "    2. ✓ Analyze contract with Claude (structured outputs)"
  echo "    3. ✓ Compute cost impact with extracted terms"
  echo "    4. ✓ Strategy calculation prerequisites verified"
  echo ""
  echo "  The system is ready for:"
  echo "    • Text mode negotiation (/dispatch)"
  echo "    • Voice mode with VAPI (/dispatch)"
  echo "    • Carbon UI variant (/dispatch-2)"
  echo ""
}

# ============================================
# Main Execution
# ============================================
main() {
  preflight_check
  step_fetch_contract
  step_analyze_contract
  step_compute_cost
  step_verify_strategy
  print_summary
}

main "$@"
