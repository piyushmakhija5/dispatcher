#!/bin/bash
# Test Google Sheets schedule save functionality
# Prerequisites:
# - Dev server running (npm run dev)
# - Google Sheets API enabled
# - Service account has Editor access to Drive folder
# - GOOGLE_SHEETS_SCHEDULE_NAME configured in .env.local

set -e

echo "===================="
echo "Google Sheets Save Test"
echo "===================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000"

echo -e "${BLUE}Test 1: Health Check${NC}"
echo "Testing Google Sheets connection..."
HEALTH_RESPONSE=$(curl -s "${API_URL}/api/schedule/save")
echo "$HEALTH_RESPONSE" | jq '.'

if echo "$HEALTH_RESPONSE" | jq -e '.connected == true' > /dev/null; then
  echo -e "${GREEN}✓ Google Sheets connection successful${NC}"
else
  echo -e "${YELLOW}⚠ Google Sheets connection failed${NC}"
  echo "Make sure:"
  echo "  1. Google Sheets API is enabled in Google Cloud Console"
  echo "  2. Service account has Editor access to the Drive folder"
  echo "  3. GOOGLE_DRIVE_FOLDER_ID is configured in .env.local"
  exit 1
fi

echo ""
echo -e "${BLUE}Test 2: Save Test Schedule${NC}"
echo "Saving a test schedule entry..."

TEST_DATA=$(cat <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "originalAppointment": "14:00",
  "confirmedTime": "15:30",
  "confirmedDock": "B5",
  "delayMinutes": 90,
  "shipmentValue": 50000,
  "totalCost": 1750,
  "warehouseContact": "Test Manager",
  "partyName": "Test Retailer",
  "contractFileName": "test_contract.pdf",
  "status": "CONFIRMED"
}
EOF
)

SAVE_RESPONSE=$(curl -s -X POST "${API_URL}/api/schedule/save" \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA")

echo "$SAVE_RESPONSE" | jq '.'

if echo "$SAVE_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test schedule saved successfully${NC}"

  SPREADSHEET_URL=$(echo "$SAVE_RESPONSE" | jq -r '.spreadsheetUrl')
  ROW_NUMBER=$(echo "$SAVE_RESPONSE" | jq -r '.rowNumber')

  echo ""
  echo -e "${GREEN}Results:${NC}"
  echo "  Spreadsheet URL: $SPREADSHEET_URL"
  echo "  Row Number: $ROW_NUMBER"
  echo ""
  echo -e "${GREEN}✓ Open the spreadsheet to verify the data was saved:${NC}"
  echo "  $SPREADSHEET_URL"
else
  echo -e "${YELLOW}⚠ Failed to save test schedule${NC}"
  ERROR=$(echo "$SAVE_RESPONSE" | jq -r '.error')
  echo "  Error: $ERROR"
  exit 1
fi

echo ""
echo "===================="
echo -e "${GREEN}All tests passed!${NC}"
echo "===================="
echo ""
echo "Next steps:"
echo "  1. Check the Google Sheets spreadsheet to verify the test entry"
echo "  2. Run a complete voice call workflow to test auto-save on call end"
echo "  3. Verify the UI shows the success indicator with spreadsheet link"
