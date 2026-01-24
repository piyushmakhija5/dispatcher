#!/bin/bash
# Quick test to verify Google Sheets permissions are working
# Run this to test the permission fix before doing a full workflow test

set -e

echo "🧪 Testing Google Sheets Permissions..."
echo ""

API_URL="http://localhost:3000"

# Test data
TEST_DATA='{
  "timestamp": "2026-01-24T12:00:00Z",
  "originalAppointment": "14:00",
  "confirmedTime": "17:30",
  "confirmedDock": "1",
  "delayMinutes": 90,
  "shipmentValue": 50000,
  "totalCost": 75,
  "warehouseContact": "Piyush",
  "partyName": "Test Retailer",
  "contractFileName": "test.pdf",
  "status": "CONFIRMED"
}'

echo "Sending test schedule to ${API_URL}/api/schedule/save..."
echo ""

RESPONSE=$(curl -s -X POST "${API_URL}/api/schedule/save" \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA")

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo ""
  echo "✅ SUCCESS! Schedule saved to Google Sheets"
  SPREADSHEET_URL=$(echo "$RESPONSE" | jq -r '.spreadsheetUrl')
  echo "📊 Spreadsheet: $SPREADSHEET_URL"
  echo ""
  echo "Next: Open the spreadsheet and verify the test data appears in row 2"
else
  echo ""
  echo "❌ FAILED!"
  ERROR=$(echo "$RESPONSE" | jq -r '.error')
  echo "Error: $ERROR"
  echo ""
  echo "Troubleshooting:"
  echo "1. Verify service account has Editor access to the Drive folder"
  echo "2. Check that Google Sheets API is enabled"
  echo "3. Verify GOOGLE_DRIVE_FOLDER_ID in .env.local"
  exit 1
fi
