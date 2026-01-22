#!/bin/bash

# Test Contract Analysis Flow
# Tests: Google Drive fetch → Claude analysis with structured outputs

set -e

BASE_URL="http://localhost:3000"

echo "🔍 Testing Contract Analysis Flow"
echo "=================================="
echo ""

# Step 1: Fetch contract from Google Drive
echo "Step 1: Fetching contract from Google Drive..."
FETCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/contract/fetch")

# Check if fetch was successful
SUCCESS=$(echo "$FETCH_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
  echo "❌ Failed to fetch contract"
  echo "$FETCH_RESPONSE" | jq '.'
  exit 1
fi

FILE_NAME=$(echo "$FETCH_RESPONSE" | jq -r '.file.name')
CONTENT_TYPE=$(echo "$FETCH_RESPONSE" | jq -r '.contentType')
CONTENT_SIZE=$(echo "$FETCH_RESPONSE" | jq -r '.content | length')

echo "✅ Fetched: $FILE_NAME"
echo "   Type: $CONTENT_TYPE"
echo "   Size: $CONTENT_SIZE bytes"
echo ""

# Step 2: Analyze contract with Claude
echo "Step 2: Analyzing contract with Claude Sonnet..."
echo "   (This may take 15-30 seconds for PDF analysis)"
echo ""

ANALYZE_REQUEST=$(echo "$FETCH_RESPONSE" | jq '{
  content: .content,
  contentType: .contentType,
  fileName: .file.name
}')

ANALYZE_RESPONSE=$(echo "$ANALYZE_REQUEST" | curl -s -X POST "$BASE_URL/api/contract/analyze" \
  -H "Content-Type: application/json" \
  -d @-)

# Check if analysis was successful
SUCCESS=$(echo "$ANALYZE_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
  echo "❌ Failed to analyze contract"
  echo "$ANALYZE_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Analysis complete!"
echo ""

# Step 3: Display results
echo "📊 EXTRACTED CONTRACT TERMS"
echo "=================================="

# Parties
echo ""
echo "👥 PARTIES:"
echo "$ANALYZE_RESPONSE" | jq -r '.terms.parties | to_entries[] | select(.value != null) | "   \(.key): \(.value)"'

# Compliance Windows
COMPLIANCE_COUNT=$(echo "$ANALYZE_RESPONSE" | jq '.terms.complianceWindows // [] | length')
if [ "$COMPLIANCE_COUNT" -gt 0 ]; then
  echo ""
  echo "⏰ COMPLIANCE WINDOWS:"
  echo "$ANALYZE_RESPONSE" | jq -r '.terms.complianceWindows[] | "   • \(.name): ±\(.windowMinutes / 2) min (\(.windowMinutes) min total)"'
else
  echo ""
  echo "⏰ COMPLIANCE WINDOWS: None found"
fi

# Delay Penalties
PENALTY_COUNT=$(echo "$ANALYZE_RESPONSE" | jq '.terms.delayPenalties // [] | length')
if [ "$PENALTY_COUNT" -gt 0 ]; then
  echo ""
  echo "💰 DELAY PENALTIES:"
  echo "$ANALYZE_RESPONSE" | jq -r '
    .terms.delayPenalties[] |
    "   • \(.name) (Free time: \(.freeTimeMinutes) min)",
    (.tiers[] | "     └ \(.fromMinutes)-\(if .toMinutes == null then "∞" else "\(.toMinutes)" end) min → $\(.ratePerHour)/hour")
  '
else
  echo ""
  echo "💰 DELAY PENALTIES: None found"
fi

# Party Penalties
PARTY_PENALTY_COUNT=$(echo "$ANALYZE_RESPONSE" | jq '.terms.partyPenalties // [] | length')
if [ "$PARTY_PENALTY_COUNT" -gt 0 ]; then
  echo ""
  echo "🏢 PARTY-SPECIFIC PENALTIES:"
  echo "$ANALYZE_RESPONSE" | jq -r '
    .terms.partyPenalties[] |
    "   • \(.partyName) - \(.penaltyType)",
    (if .perOccurrence then "     Amount: $\(.perOccurrence) per occurrence" else empty end),
    (if .percentage then "     Amount: \(.percentage)% penalty" else empty end),
    (if .flatFee then "     Amount: $\(.flatFee) flat fee" else empty end),
    (if .conditions then "     Conditions: \(.conditions)" else empty end)
  '
fi

# Other Terms
OTHER_COUNT=$(echo "$ANALYZE_RESPONSE" | jq '.terms.otherTerms // [] | length')
if [ "$OTHER_COUNT" -gt 0 ]; then
  echo ""
  echo "📝 OTHER TERMS:"
  echo "$ANALYZE_RESPONSE" | jq -r '.terms.otherTerms[] | "   • \(.name): \(.description)"'
fi

# Metadata
echo ""
echo "📋 METADATA:"
CONFIDENCE=$(echo "$ANALYZE_RESPONSE" | jq -r '.terms._meta.confidence' | tr '[:lower:]' '[:upper:]')
echo "   Document: $FILE_NAME"
echo "   Confidence: $CONFIDENCE"
echo "   Extracted: $(echo "$ANALYZE_RESPONSE" | jq -r '.terms._meta.extractedAt')"

# Warnings
WARNING_COUNT=$(echo "$ANALYZE_RESPONSE" | jq '.terms._meta.warnings // [] | length')
if [ "$WARNING_COUNT" -gt 0 ]; then
  echo ""
  echo "⚠️  WARNINGS:"
  echo "$ANALYZE_RESPONSE" | jq -r '.terms._meta.warnings[] | "   - \(.)"'
fi

# Debug info
echo ""
echo "🔧 DEBUG INFO:"
echo "   Model: $(echo "$ANALYZE_RESPONSE" | jq -r '.debug.modelUsed')"
echo "   Tokens: $(echo "$ANALYZE_RESPONSE" | jq -r '.debug.tokensUsed')"
echo "   Time: $(echo "$ANALYZE_RESPONSE" | jq -r '.debug.extractionTimeMs')ms"

echo ""
echo "=================================="
echo "✅ Test completed successfully!"
