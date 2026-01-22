# Tests

Test scripts for Dispatcher AI application.

## Prerequisites

- Dev server must be running: `npm run dev`
- Required: `jq` for JSON parsing (`brew install jq` on macOS)
- Environment variables configured in `.env.local`

## Available Tests

### Contract Analysis Flow

Tests the complete contract analysis workflow:
1. Fetch latest contract from Google Drive
2. Analyze with Claude Sonnet using structured outputs
3. Display extracted terms

```bash
./tests/test-contract-flow.sh
```

**What it tests:**
- Google Drive API integration
- PDF/document fetching
- Claude structured output extraction
- Contract term validation

**Expected output:**
- Parties (shipper, carrier, consignee)
- Compliance windows (OTIF, delivery windows)
- Delay penalties (dwell time, detention tiers)
- Party-specific penalties
- Extraction metadata (confidence, warnings)

**Typical run time:** 15-30 seconds (depends on PDF size)

## Manual Testing with curl

### Test Google Drive Connection

```bash
curl -s http://localhost:3000/api/contract/fetch | jq '.'
```

### Test Contract Analysis Health Check

```bash
curl -s http://localhost:3000/api/contract/analyze | jq '.'
```

### Full Flow (Manual)

```bash
# Step 1: Fetch contract
curl -s -X POST http://localhost:3000/api/contract/fetch > /tmp/contract.json

# Step 2: Analyze contract
cat /tmp/contract.json | jq '{content: .content, contentType: .contentType, fileName: .file.name}' | \
curl -s -X POST http://localhost:3000/api/contract/analyze \
  -H "Content-Type: application/json" \
  -d @- | jq '.'
```

## Notes

- Tests use real API calls (consume tokens)
- LLM output is non-deterministic (results may vary slightly)
- Tests validate infrastructure, not exact extraction results
