# Tests

Test scripts for Dispatcher AI application - Phase 7.8: Testing & Validation.

## Prerequisites

- Dev server must be running: `npm run dev`
- Required: `jq` for JSON parsing (`brew install jq` on macOS)
- Environment variables configured in `.env.local`
- For TypeScript tests: `npx ts-node` or `npx tsx`

## Quick Start

```bash
# Run all tests (recommended order)
./tests/test-contract-flow.sh      # Basic contract analysis
./tests/test-edge-cases.sh         # Edge cases and validation
./tests/test-e2e-workflow.sh       # Full end-to-end workflow

# Run TypeScript unit tests
npx ts-node tests/test-cost-engine-with-terms.ts
```

## Available Tests

### 1. Contract Analysis Flow (`test-contract-flow.sh`)

Tests the basic contract analysis workflow:
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

---

### 2. Edge Cases (`test-edge-cases.sh`)

Tests error handling and edge cases:

```bash
./tests/test-edge-cases.sh

# With verbose output
VERBOSE=true ./tests/test-edge-cases.sh
```

**Test Cases:**
1. API health checks (all endpoints)
2. Input validation (missing fields, invalid types)
3. Empty/invalid folder handling
4. Minimal document analysis (low confidence)
5. Custom penalty types → `otherTerms` capture
6. Party name extraction (different consignees)
7. Partial extraction (missing sections)
8. Error response format consistency

**Expected Results:**
- All validation errors return consistent format
- Missing sections generate warnings, not failures
- Unknown penalty types captured in `otherTerms`
- Graceful degradation with informative messages

---

### 3. End-to-End Workflow (`test-e2e-workflow.sh`)

Simulates the complete user workflow from start to negotiation:

```bash
./tests/test-e2e-workflow.sh
```

**Workflow Steps:**
1. **Fetch Contract** - Get latest from Google Drive
2. **Analyze Contract** - Extract structured terms with Claude
3. **Compute Cost Impact** - Calculate costs for multiple time slots
4. **Verify Strategy** - Check negotiation prerequisites

**What it validates:**
- Complete integration of all Phase 7 components
- Cost calculation with extracted terms
- Time/dock extraction for negotiation
- Strategy calculation inputs

**Typical run time:** 30-60 seconds

---

### 4. Cost Engine Unit Tests (`test-cost-engine-with-terms.ts`)

TypeScript unit tests for the cost calculation engine:

```bash
npx ts-node tests/test-cost-engine-with-terms.ts
# or
npx tsx tests/test-cost-engine-with-terms.ts
```

**Test Cases:**
1. Validate extracted terms structure
2. Convert extracted terms to legacy rules format
3. Cost calculation with extracted terms
4. Fallback to defaults when terms missing
5. Partial terms handling
6. Edge cases (zero values, very large delays)
7. Party name matching (case-insensitive)

**What it validates:**
- `validateExtractedTermsForCostCalculation()`
- `convertExtractedTermsToRules()`
- `calculateTotalCostImpactWithTerms()`
- Backward compatibility with `DEFAULT_CONTRACT_RULES`

---

## Manual Testing with curl

### Health Checks

```bash
# Main health endpoint
curl -s http://localhost:3000/api/health | jq '.'

# Contract fetch health (Google Drive connection)
curl -s http://localhost:3000/api/contract/fetch | jq '.'

# Contract analyze health (Claude API ready)
curl -s http://localhost:3000/api/contract/analyze | jq '.'
```

### Contract Analysis Flow

```bash
# Step 1: Fetch contract from Google Drive
curl -s -X POST http://localhost:3000/api/contract/fetch > /tmp/contract.json

# Check what was fetched
cat /tmp/contract.json | jq '{success, fileName: .file.name, type: .contentType}'

# Step 2: Analyze contract with Claude
cat /tmp/contract.json | jq '{content: .content, contentType: .contentType, fileName: .file.name}' | \
curl -s -X POST http://localhost:3000/api/contract/analyze \
  -H "Content-Type: application/json" \
  -d @- | jq '.'
```

### Cost Calculation

```bash
# Test cost for a specific time slot
curl -s -X POST http://localhost:3000/api/tools/check-slot-cost \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCalls": [{
        "id": "test-1",
        "function": {
          "name": "check_slot_cost",
          "arguments": {
            "proposed_time": "16:00",
            "original_appointment": "14:00",
            "delay_minutes": "90",
            "shipment_value": "50000",
            "retailer": "Walmart"
          }
        }
      }]
    }
  }' | jq '.'
```

### Time/Dock Extraction

```bash
# Extract time and dock from natural language
curl -s -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"message": "We can fit you in at 4:30 PM at dock 5"}' | jq '.'
```

---

## Test Scenarios

### Scenario 1: Short Delay (30 min)
- Original: 2:00 PM, Delay: 30 min → Arrival: 2:30 PM
- Expected: IDEAL slots around 2:30-3:00 PM
- Strategy: Accept immediately if within OTIF window

### Scenario 2: Medium Delay (90 min)
- Original: 2:00 PM, Delay: 90 min → Arrival: 3:30 PM
- Expected: IDEAL 3:30-4:00 PM, OK before 5:00 PM
- Strategy: Negotiate for earlier times, accept reasonable offers

### Scenario 3: Long Delay (180 min)
- Original: 2:00 PM, Delay: 180 min → Arrival: 5:00 PM
- Expected: IDEAL 5:00-5:30 PM, dwell time concerns after
- Strategy: Minimize dwell time, accept first reasonable slot

---

## Troubleshooting

### Server Not Running
```
Error: Server not running at http://localhost:3000
```
**Solution:** Start the dev server with `npm run dev`

### Google Drive Not Connected
```
Warning: Google Drive not connected
```
**Solution:** Check `.env.local` has:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`

### No Contract Found
```
Error: No files found in the specified folder
```
**Solution:** Upload a PDF or Google Doc to the configured Drive folder

### Analysis Timeout
```
Error: Request timeout
```
**Solution:** Large PDFs can take 30-60 seconds. Wait or use smaller test documents.

### jq Not Found
```
jq: command not found
```
**Solution:** Install jq with `brew install jq` (macOS) or `apt install jq` (Linux)

---

## Notes

- Tests use real API calls and consume Claude tokens
- LLM output is non-deterministic (results may vary slightly)
- Tests validate infrastructure, not exact extraction results
- Run tests against local dev server, not production
- Edge case tests create synthetic contracts for validation
