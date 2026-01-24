# Dispatcher AI - Consolidation Progress

## Project Status: ✅ Phase 7-9 Complete | 🔄 Phase 10 (HOS Integration) In Progress

Last Updated: 2026-01-24

---

## Phase 1: Analysis & Planning ✅ COMPLETE

- [x] Analyzed `disptacher-workflow/` folder structure
- [x] Analyzed `tools/` folder structure
- [x] Identified tech stack and dependencies
- [x] Documented business logic (cost engine, negotiation)
- [x] Mapped API endpoints
- [x] Created CLAUDE.md context file
- [x] Created PROGRESS.md tracking file

---

## Phase 2: Project Setup ✅ COMPLETE

- [x] Create new Next.js project with App Router (upgraded to v16.1.4)
- [x] Configure TypeScript
- [x] Setup Tailwind CSS
- [x] Create `.env.example` with all required variables
- [x] Setup `.gitignore` (exclude .env.local, node_modules)
- [x] Move deprecated files to `/deprecated` folder
- [x] Create `.env.local` with placeholder values
- [x] Install dependencies and verify build works
- [x] Create API route stubs (health, extract, chat, tools/check-slot-cost)

---

## Phase 3: Core Infrastructure ✅ COMPLETE

### 3.1 Types & Interfaces
- [x] Create `/types/dispatch.ts` (workflow state, messages)
- [x] Create `/types/cost.ts` (cost calculation types)
- [x] Create `/types/vapi.ts` (VAPI event types)
- [x] Create `/types/index.ts` (re-exports)

### 3.2 Utility Libraries
- [x] Extract `/lib/cost-engine.ts` from LiveDispatcherAgentVapi.jsx
- [x] Extract `/lib/negotiation-strategy.ts`
- [x] Extract `/lib/time-parser.ts`
- [x] Create `/lib/anthropic-client.ts`

### 3.3 API Routes (Refactored)
- [x] `/app/api/health/route.ts` - Health check
- [x] `/app/api/extract/route.ts` - Uses shared anthropic-client
- [x] `/app/api/chat/route.ts` - Uses shared anthropic-client
- [x] `/app/api/tools/check-slot-cost/route.ts` - Uses shared cost-engine

---

## Phase 4: Components ✅ COMPLETE

### 4.1 Break Down Monolithic Component
Source: `disptacher-workflow/src/LiveDispatcherAgentVapi.jsx` (1,570 lines)

- [x] `/components/dispatch/SetupForm.tsx` - Initial parameters form
- [x] `/components/dispatch/ThinkingBlock.tsx` - Expandable reasoning
- [x] `/components/dispatch/CostBreakdown.tsx` - Cost visualization
- [x] `/components/dispatch/StrategyPanel.tsx` - Negotiation thresholds
- [x] `/components/dispatch/ChatInterface.tsx` - Text conversation
- [x] `/components/dispatch/VoiceCallInterface.tsx` - VAPI controls
- [x] `/components/dispatch/FinalAgreement.tsx` - Summary export
- [x] `/components/dispatch/index.ts` - Barrel export

### 4.2 Custom Hooks
- [x] `/hooks/useDispatchWorkflow.ts` - State machine
- [x] `/hooks/useCostCalculation.ts` - Cost computations
- [x] `/hooks/useVapiCall.ts` - Voice call management
- [x] `/hooks/index.ts` - Barrel export

### 4.3 Main Page
- [x] `/app/dispatch/page.tsx` - Assembles all components

### Files Created:
```
dispatcher/
├── components/
│   └── dispatch/
│       ├── index.ts              # Barrel export
│       ├── SetupForm.tsx         # Delay params, retailer, mode selection
│       ├── ThinkingBlock.tsx     # Expandable reasoning steps
│       ├── CostBreakdown.tsx     # Live cost impact display
│       ├── StrategyPanel.tsx     # IDEAL/ACCEPTABLE/BAD thresholds
│       ├── ChatInterface.tsx     # Messages + input area
│       ├── VoiceCallInterface.tsx # VAPI call controls
│       └── FinalAgreement.tsx    # Summary + CSV export
├── hooks/
│   ├── index.ts                  # Barrel export
│   ├── useDispatchWorkflow.ts    # Main state machine (350+ lines)
│   ├── useCostCalculation.ts     # Cost utilities
│   └── useVapiCall.ts            # VAPI call management
└── app/
    └── dispatch/
        └── page.tsx              # Main dispatch UI (485 lines)
```

### Build Status: ✅ Passing
```
npm run build - Success
Routes: /, /dispatch, /api/health, /api/extract, /api/chat, /api/tools/check-slot-cost
```

---

## Phase 5: Integration & Testing ✅ COMPLETE

- [x] Test text mode negotiation flow ✅ VALIDATED
  - Conversation flow matches VAPI "Mike the Dispatcher"
  - Greeting → Name → Explain → Negotiate → Dock → Confirm → Done
  - Cost thresholds aligned with strategy display
  - Counter-offers push for EARLIER times (not later)
  - No internal costs revealed to warehouse
- [x] Test voice mode with VAPI ✅ FIXED
- [x] Verify cost calculations match strategy ✅ FIXED
- [x] Test all API endpoints ✅ VALIDATED
  - `/api/health` - Returns health status with timestamp
  - `/api/extract` - Successfully extracts time/dock from messages
  - `/api/chat` - Claude conversation working with proper context
  - `/api/tools/check-slot-cost` - Cost calculation webhook functional
- [x] Mobile responsiveness check ✅ FIXED
  - **SetupForm.tsx**: Changed grid from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`
    - Form inputs now stack on mobile, side-by-side on tablet+
    - Fixed `col-span-2` to `sm:col-span-2` for delay slider and retailer selection
  - **StrategyPanel.tsx**: Changed from `grid-cols-3 text-[10px]` to `grid-cols-1 sm:grid-cols-3 text-xs`
    - Strategy cards stack vertically on mobile for better readability
    - Increased font size from 10px to 12px (text-xs) for accessibility
  - **dispatch/page.tsx**: Improved header responsiveness
    - Changed header from `flex items-center justify-between` to `flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`
    - Reduced horizontal padding from `px-6` to `px-4 sm:px-6` for better mobile margins
    - Header elements now stack on small screens, preventing overflow

---

## Phase 6: Negotiation Logic Fixes ✅ MOSTLY COMPLETE

**Issue Discovery**: Voice call testing revealed critical negotiation bugs where the dispatcher asks for appointment times BEFORE the truck can physically arrive.

### Critical Bugs Identified (2026-01-20)

**Example Scenario**: 2 PM appointment + 90 min delay = 3:30 PM actual arrival
- ❌ Dispatcher asks for 2:30 PM slot (impossible - truck arrives at 3:30 PM!)
- ❌ Strategy cards show "IDEAL: Before 14:30" (before actual arrival)
- ❌ Confirmed time updates on extraction, not acceptance
- ❌ Counter-offers ask for earlier times even when already optimal

---

### Fix 1: Calculate Actual Arrival Time ✅ COMPLETE (2026-01-20)

**Problem**: All calculations use `original_appointment` instead of `original_appointment + delay_minutes`

**Impact**:
- Strategy cards show impossible times
- Negotiation logic asks for times before truck arrives
- Cost calculations relative to wrong baseline

**Solution Implemented**: **Cost Curve Analysis Algorithm**

Instead of hardcoding assumptions about OTIF/dwell time, we now:
1. Calculate actual arrival time (`origMins + delayMinutes`)
2. Sample costs every 15 minutes for 6 hours after arrival
3. Analyze the cost curve to detect penalty structure:
   - Flat zones (no penalty increase)
   - Step jumps (sudden $100+ increases)
   - Linear growth (gradual increases)
4. Set thresholds dynamically based on detected structure

**Files Modified**:
- [x] `/lib/negotiation-strategy.ts` - Added `analyzeCostCurve()` function
  - New interfaces: `CostSample`, `StepJump`, `CostCurveAnalysis`
  - Completely rewrote `createNegotiationStrategy()` to use curve analysis
  - Thresholds now set based on actual penalty structure, not hardcoded rules
- [x] `/hooks/useCostCalculation.ts` - Returns `actualArrivalTime`
  - Calculates and exposes actual arrival time for components
- [x] `/components/dispatch/StrategyPanel.tsx` - Displays arrival time
  - Shows "Truck arrives at: 15:30" banner
  - Displays dynamic strategy descriptions from curve analysis
  - Shows arrival-relative time thresholds

**Test Results** (2 PM + 90 mins = 3:30 PM arrival, Walmart, $50K):
- ✅ **Truck arrives banner**: Shows 15:30 (3:30 PM)
- ✅ **IDEAL**: Around 15:30-16:00 (not 14:30!)
- ✅ **OK**: Before 17:15-17:30 (before step jump)
- ✅ **BAD**: After 17:30 (when dwell charges kick in)
- ✅ **Descriptions**: Dynamic based on penalty structure

**Key Achievement**: System is now truly GENERIC - works with any contract penalty structure without hardcoded assumptions.

---

### Fix 2: Update Strategy Thresholds to Use Arrival Time ⬜ NOT STARTED

**Problem**: Strategy calculation in `/lib/negotiation-strategy.ts` uses wrong baseline

**Current Logic** (WRONG):
```typescript
IDEAL: Before original_appointment + 30 mins
ACCEPTABLE: Before original_appointment + 2 hours
BAD: After original_appointment + 2 hours
```

**Correct Logic**:
```typescript
// actualArrival = 15:30 (3:30 PM)
IDEAL: 15:30-16:00 (arrival within OTIF window, minimal dwell)
ACCEPTABLE: 16:00-17:30 (up to 2hrs after arrival, manageable costs)
PROBLEMATIC: After 17:30 (>2hrs dwell time, max penalties)
```

**Files to Fix**:
- [ ] `/lib/negotiation-strategy.ts` - `determineNegotiationStrategy()` function
- [ ] `/hooks/useCostCalculation.ts` - Update threshold calculations

**Test Case**:
- Original: 14:00, Delay: 90 mins → Arrival: 15:30
- IDEAL threshold: 15:30-16:00 ($0-$50 cost)
- ACCEPTABLE threshold: 16:00-17:30 (≤$100 cost)
- PROBLEMATIC: After 17:30 (>$100 cost)

---

### Fix 3: Add Arrival Time to VAPI Dynamic Variables ✅ COMPLETE (2026-01-20)

**Problem**: VAPI assistant didn't know the actual arrival time, only delay minutes - could ask for times before truck physically arrives

**Solution Implemented**:

1. **Calculate Time Variables** (components/dispatch/VoiceCallInterface.tsx:130-146)
   - Calculate actual arrival time: `originalAppointment + delayMinutes`
   - Calculate OTIF window: `originalAppointment ± 30 minutes`
   - Convert all times to both 24h format and speech format

2. **Pass New Variables to VAPI** (components/dispatch/VoiceCallInterface.tsx:151-170)
   - Added `original_24h` - Original appointment in 24h format (e.g., "14:00")
   - Added `actual_arrival_time` - When truck arrives (e.g., "3:30 PM")
   - Added `actual_arrival_24h` - Arrival time in 24h (e.g., "15:30")
   - Added `otif_window_start` - OTIF window start (e.g., "1:30 PM")
   - Added `otif_window_end` - OTIF window end (e.g., "2:30 PM")

3. **Updated VAPI System Prompt** (VAPI_SYSTEM_PROMPT.md)
   - Added CRITICAL CONSTRAINT section - cannot accept times before arrival
   - Added time validation logic in conversation flow
   - Mike will now politely reject pre-arrival times

**New Variables Passed to VAPI**:
```javascript
{
  original_appointment: "2 PM",           // Speech format
  original_24h: "14:00",                  // 24h format
  actual_arrival_time: "3:30 PM",         // When truck physically arrives
  actual_arrival_24h: "15:30",            // Arrival in 24h format
  otif_window_start: "1:30 PM",           // OTIF window start
  otif_window_end: "2:30 PM",             // OTIF window end
  delay_minutes: "90",
  shipment_value: "50000",
  retailer: "Walmart"
}
```

**Files Modified**:
- [x] `/components/dispatch/VoiceCallInterface.tsx` - Calculate and pass new variables
- [x] `VAPI_SYSTEM_PROMPT.md` - New system prompt created

**User Action Required**:
- [ ] Copy `VAPI_SYSTEM_PROMPT.md` content into VAPI dashboard
- [ ] Navigate to: https://dashboard.vapi.ai → Assistants → Mike the Dispatcher → System Prompt

**Build Status**: ✅ Passing

---

### Fix 4: Only Update Confirmed Time on Acceptance ✅ COMPLETE (2026-01-20)

**Problem**: Voice mode updated `confirmedTime` when extracting warehouse offer, not when dispatcher accepts

**Root Cause**:
- Voice mode set confirmed time/dock immediately after extraction (lines 128-135)
- Text mode already handled this correctly (only set on `evaluation.shouldAccept`)

**Solution Implemented**:

1. **Removed Premature Updates** (app/dispatch/page.tsx:121-130)
   - Changed extraction logic to use local variables instead of setting state
   - Store `offeredTime` and `offeredDock` locally, not in confirmed state
   - Only confirmed values are set when offer is actually accepted

2. **Set Confirmed on Acceptance** (app/dispatch/page.tsx:185-187)
   - Added `workflow.setConfirmedTime(time)` and `workflow.setConfirmedDock(dock)`
   - Placed at start of `finishNegotiation()` function
   - This function is only called when `evaluation.shouldAccept` is true

**Fixed Behavior**:
```
Warehouse: "6 PM"
→ Extraction: {offeredTime: '18:00'} (stored in local variable)
→ Evaluation: shouldPushback = true
→ Mike: "6 PM is too late for us..." (REJECT)
→ State: confirmedTime remains null ✅

Warehouse: "3:45 PM"
→ Extraction: {offeredTime: '15:45'} (stored in local variable)
→ Evaluation: shouldAccept = true
→ finishNegotiation('15:45', 'B5', ...)
→ State: setConfirmedTime('15:45') ✅ CORRECT
→ Mike: "Perfect, 3:45 PM works for us"
```

**Files Modified**:
- [x] `/app/dispatch/page.tsx` - Fixed voice mode extraction handler
- [x] `/app/dispatch/page.tsx` - Updated finishNegotiation() to set confirmed values

**Build Status**: ✅ Passing

---

### Fix 4B: Voice Call Auto-End Bug ✅ COMPLETE (2026-01-20)

**Problem**: Voice call did not end automatically after collecting all information and Mike said closing phrase

**Root Cause**: React state closure bug
- Used `useState` for `pendingAcceptedTime`
- State updates are asynchronous - function closure captures initial value (`null`)
- When dock was extracted later, `pendingAcceptedTime` was still `null` in the closure
- `finishNegotiation()` never called → `confirmedTimeRef/confirmedDockRef` never set
- Auto-end check failed because refs were null

**Debug Logs Revealed**:
```
"Storing pending accepted time: 16:30 with cost: 1725" ✓
"⚠️ Got dock but no pending time! offeredDock: 1, pendingAcceptedTime: null" ✗
```

**Solution**: Changed from `useState` to `useRef`
- `useRef` updates synchronously - `ref.current` immediately reflects new value
- No closure issues - always reads latest value

**Files Modified**:
- [x] `/app/dispatch/page.tsx` - Changed `pendingAcceptedTime` and `pendingAcceptedCost` from state to refs

**Fixed Flow**:
```
1. Time extracted → pendingAcceptedTimeRef.current = '16:30' ✓
2. Dock extracted → Check pendingAcceptedTimeRef.current → Has value! ✓
3. Call finishNegotiation('16:30', '1', cost) ✓
4. Set confirmedTimeRef and confirmedDockRef ✓
5. Mike says closing phrase → Auto-end check passes ✓
6. Call ends automatically! ✓
```

**Build Status**: ✅ Passing

---

### Fix 4C: Graceful Call Ending with Silence Detection ✅ COMPLETE (2026-01-21)

**Problem**: Voice call ended immediately after Mike said closing phrase, not waiting for complete speech or user response

**Requirements**:
1. Mike must completely finish speaking the closing message
2. Wait for a few seconds of silence before closing the call
3. If warehouse manager speaks during silence period, continue conversation
4. After resolving their query, Mike says another closing phrase and cycle repeats

**Solution Implemented**:

1. **Track Assistant Speech State** (components/dispatch/VoiceCallInterface.tsx)
   - Added `speech-update` event listener to track when assistant starts/stops speaking
   - Added `onAssistantSpeechStart` and `onAssistantSpeechEnd` callbacks
   - Alternative tracking via `assistant-response` message type

2. **Wait for Speech to Finish** (app/dispatch/page.tsx)
   - Added `waitingForSpeechEndRef` to track if waiting for speech to complete
   - Added `isAssistantSpeakingRef` to track current speech state
   - `handleAssistantSpeechStart()` - cancels silence timer if assistant starts speaking
   - `handleAssistantSpeechEnd()` - starts silence timer after speech completes

3. **Silence Timer Logic** (app/dispatch/page.tsx)
   - `startSilenceTimer()` - starts 5-second countdown after assistant finishes speaking
   - If warehouse manager speaks during silence → timer cancelled, conversation continues
   - If silence period completes → call ends gracefully

4. **Updated Types** (types/vapi.ts)
   - Added `speech-update` to `VapiEventType`
   - Added optional `onAssistantSpeechStart` and `onAssistantSpeechEnd` to `VapiCallInterfaceProps`

5. **VAPI System Prompt** (VAPI_SYSTEM_PROMPT.md)
   - Added "CALL CLOSING BEHAVIOR" section
   - Guidance on handling follow-up questions after closing
   - Examples of natural conversation continuation

**Flow**:
```
1. Mike says closing phrase ("Alright, we'll see you then...")
2. System waits for Mike to finish speaking completely
3. 5-second silence timer starts
4. If user speaks during silence:
   → Timer cancelled
   → Mike addresses their query
   → Mike says new closing phrase
   → Back to step 2
5. If 5 seconds of silence pass:
   → Call ends gracefully
```

**Files Modified**:
- [x] `/app/dispatch/page.tsx` - Silence timer logic, speech state tracking
- [x] `/components/dispatch/VoiceCallInterface.tsx` - Speech state events
- [x] `/types/vapi.ts` - Added speech callback props
- [x] `VAPI_SYSTEM_PROMPT.md` - Added call closing behavior guidance

**Build Status**: ✅ Passing

---

### Fix 5: Validate Offered Times Against Arrival ⬜ NOT STARTED

**Problem**: No validation prevents accepting times before truck arrival

**Add Validation Layer**:
```typescript
function validateOfferedTime(
  offeredTime: string,
  actualArrivalTime: string
): { valid: boolean; reason?: string } {
  const offered = parseTime(offeredTime);
  const arrival = parseTime(actualArrivalTime);

  if (offered < arrival) {
    return {
      valid: false,
      reason: `Offered time ${offeredTime} is before truck arrival ${actualArrivalTime}`
    };
  }

  return { valid: true };
}
```

**Files to Create/Update**:
- [ ] `/lib/time-validation.ts` - New utility file
- [ ] `/app/dispatch/page.tsx` - Add validation on extraction
- [ ] `/hooks/useVapiCall.ts` - Log validation errors

---

### Fix 6: Improve Cost Communication in Negotiation ⬜ NOT STARTED

**Problem**: `check-slot-cost` tool is called but results don't inform Mike's responses

**Current**: Mike doesn't reference costs when negotiating

**Desired**: Mike should mention cost factors naturally
- "6 PM would mean 2+ hours of dwell time for us"
- "Anything closer to 3:30 PM would really help us avoid extra charges"
- "We're trying to stay within the 4 PM window if possible"

**VAPI Configuration**:
- [ ] Update function tool response handling
- [ ] System prompt should include cost interpretation guidance

**Note**: User must update VAPI assistant configuration

---

### Fix 7: Fix Counter-Offer Direction Logic ⏭️ SKIPPED

**Reason**: This is already addressed by Fix 1 (Cost Curve Analysis).

**Analysis (2026-01-21)**:
- Fix 1 rewrote `createNegotiationStrategy()` to calculate thresholds dynamically from cost curve
- `evaluateOffer()` correctly classifies offers within ACCEPTABLE range → `shouldAccept: true`
- Both text mode and voice mode only counter-offer when `shouldPushback: true`
- The `check-slot-cost` webhook uses the same strategy logic
- VAPI system prompt instructs: "If acceptable = true → accept warmly"

**The example bug ("5 PM → asks for earlier") cannot occur** because:
- 5 PM (17:00) is within ACCEPTABLE threshold (~17:15-17:30 for 3:30 PM arrival)
- Evaluation returns `shouldAccept: true, shouldPushback: false`
- No counter-offer is generated

**Times before arrival** are handled by Fix 5 (validation layer), not counter-offer direction.

---

### Fix 8: Duplicate Response Prevention ⏭️ SKIPPED

**Reason**: This is VAPI's internal LLM behavior, not a bug in our code.

**Analysis (2026-01-21)**:
- `model-output` is a VAPI internal event showing LLM generation, not final spoken output
- Our code only logs these events (VoiceCallInterface.tsx:145-147), doesn't process them
- Actual chat messages use `transcript` with `transcriptType === 'final'` - properly filtered
- The slight variations ("we'll" vs "let's") are normal LLM streaming/candidate generation
- If duplicates were actually SPOKEN, that's a VAPI-side issue (voice synthesis layer)
- We cannot add deduplication for VAPI's internal behavior - outside our codebase

---

### Testing Checklist (After All Fixes)

**Test Scenario 1**: Short Delay (30 mins)
- Original: 2:00 PM, Delay: 30 mins → Arrival: 2:30 PM
- [x] Strategy shows IDEAL: 2:30-3:00 PM
- [x] Mike accepts offers between 2:30-3:00 PM immediately
- [x] Mike rejects offers before 2:30 PM ("truck won't be there yet")
- [x] Mike negotiates for earlier if offered after 4:30 PM

**Test Scenario 2**: Medium Delay (90 mins)
- Original: 2:00 PM, Delay: 90 mins → Arrival: 3:30 PM
- [x] Strategy shows IDEAL: 3:30-4:00 PM
- [x] Mike accepts 3:45 PM immediately (in IDEAL range)
- [x] Mike accepts 5:00 PM after one pushback (in ACCEPTABLE range)
- [x] Mike rejects 2:30 PM ("driver arrives at 3:30 PM")

**Test Scenario 3**: Long Delay (180 mins)
- Original: 2:00 PM, Delay: 180 mins → Arrival: 5:00 PM
- [x] Strategy shows IDEAL: 5:00-5:30 PM
- [x] Mike explains OTIF already missed, negotiates minimal dwell time
- [x] Mike accepts 5:15 PM immediately
- [x] Mike pushes back on 7:00 PM (2hr+ dwell time)

---

## Phase 7: Dynamic Contract Analysis 🔄 IN PROGRESS

**Goal**: Replace hardcoded contract rules with real-time LLM-based extraction from Google Drive documents.

### 7.1 Architecture Design ✅ COMPLETE (2026-01-22)

**Problem Identified**:
- Contract terms were hardcoded in `types/cost.ts` as `DEFAULT_CONTRACT_RULES`
- "Analyzing Contract Terms" step was UI theater - no actual document analysis
- Retailers hardcoded to 5 options (Walmart, Target, Amazon, Costco, Kroger)
- System couldn't adapt to different contract structures

**Design Decisions**:
1. **Document Source**: Google Drive folder (service account auth)
2. **Document Selection**: Most recently modified file in folder
3. **Party Identification**: Extracted from contract (remove retailer dropdown)
4. **Analysis Timing**: Real-time on workflow trigger (no caching)
5. **Error Handling**: Graceful degradation with debug traces
6. **Schema**: Flexible structure with optional fields for unknown penalty types

**New Workflow Stages**:
```
setup → fetching_contract → analyzing_contract → computing_impact → negotiating → complete
```

### 7.2 Google Drive Integration ✅ COMPLETE (2026-01-22)

**Tasks**:
- [x] Install `googleapis` package
- [x] Create `/lib/google-drive.ts` service
  - [x] Service account authentication
  - [x] List files in folder (sorted by modified date)
  - [x] Fetch most recent document
  - [x] Return PDF as base64 (Claude handles PDF directly!)
  - [x] Export Google Docs as plain text
- [x] Create `/app/api/contract/fetch/route.ts` endpoint
- [x] Add environment variables to `.env.example`
- [x] Add error handling with debug traces

**Architecture Decision**: Claude can process PDFs natively via the `document` content type in the API. No need for `pdf-parse` library - Claude's PDF understanding is more sophisticated and handles complex layouts, tables, and formatting better.

**Files Created**:
- `/lib/google-drive.ts` - Google Drive service with:
  - `getClient()` - Service account authentication (internal)
  - `listFilesInFolder()` - List files sorted by modified time
  - `getFileContent()` - Returns base64 for PDFs, text for Google Docs
  - `fetchMostRecentContract()` - Main function to get latest contract
  - `checkDriveConnection()` - Health check function
- `/app/api/contract/fetch/route.ts` - API endpoint
  - `POST` - Fetch most recent contract (returns `contentType: 'pdf' | 'text'`)
  - `GET` - Health check for Drive connection

**Response Format**:
```typescript
{
  success: true,
  file: { id, name, mimeType, modifiedTime },
  contentType: 'pdf' | 'text',  // Tells Claude how to process
  content: string,              // base64 for PDF, plain text otherwise
  debug: { ... }
}
```

**Environment Variables** (added to `.env.example`):
```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_DRIVE_FOLDER_ID=1tvYYPUQlIC1AmBI-1lZrtmNAWzDk029g
```

**Supported File Types**:
- PDF → returned as base64 (Claude processes directly)
- Google Docs → exported as plain text
- Plain text files → returned as-is

**Tested**:
- `GET /api/contract/fetch` → `{"status":"connected","connected":true,"fileCount":1}`
- `POST /api/contract/fetch` → Returns PDF (183KB base64), file: `Sample_Shipper-Carrier_Transportation_Services_Agreement_US.pdf`

**Build Status**: ✅ Passing

### 7.3 Contract Analysis with Claude ✅ COMPLETE (2026-01-22)

**Tasks**:
- [x] Create `/types/contract.ts` with `ExtractedContractTerms` interface
- [x] Create `/lib/contract-analyzer.ts`
  - [x] Prompt engineering for structured extraction
  - [x] Self-validation in prompt (verify numbers exist in source)
  - [x] Handle partial extractions gracefully
- [x] Create `/app/api/contract/analyze/route.ts` endpoint
- [x] Use Claude structured outputs (tool_use with schema)
- [x] Build passing with all type errors fixed
- [x] End-to-end testing with real contract

**Files Created**:

1. **`/types/contract.ts`** (90 lines) - Type definitions
   - `ExtractedContractTerms` - Main interface with flexible schema
   - `ContractAnalysisRequest` - API request payload
   - `ContractAnalysisResponse` - API response format
   - `ContractValidationResult` - Validation results

2. **`/lib/contract-analyzer.ts`** (410 lines) - Core analysis engine
   - `analyzeContract()` - Main function using Claude Sonnet
   - `validateExtractedTerms()` - Validation with errors/warnings
   - `areTermsUsable()` - Quick usability check
   - Uses Claude structured outputs with tool_use
   - Native PDF processing (Claude handles PDFs directly)
   - Comprehensive system prompt with 6 instruction categories
   - Flexible schema supports various contract structures

3. **`/app/api/contract/analyze/route.ts`** (135 lines) - API endpoint
   - `POST /api/contract/analyze` - Analyze contract content
   - `GET /api/contract/analyze` - Health check
   - Request validation and error handling

4. **`/tests/test-contract-flow.sh`** (140 lines) - E2E test script
   - Tests: Google Drive fetch → Claude analysis → Display results
   - Formatted output with all penalty details
   - Run time: ~38 seconds for 184KB PDF

5. **`/tests/README.md`** - Test documentation
   - Prerequisites and usage instructions
   - Manual testing with curl examples

**Test Results** (Sample Transportation Agreement):

Successfully extracted:
- ✅ **3 Parties**: Shipper, Carrier, Consignee (with template warnings)
- ✅ **2 Compliance Windows**: OTIF Pickup/Delivery (±30 min)
- ✅ **1 Delay Penalty**: Detention $75/hour after 120 min free time
- ✅ **8 Party Penalties**:
  - Late Pickup: $150/occurrence (target ≥98%)
  - Late Delivery: $250/occurrence (target ≥98%)
  - Missed Appointment: $500/occurrence (target ≥99.5%)
  - Tracking Compliance: $50/load
  - POD Timeliness: $25/load
  - OTIF Chargebacks: Pass-through (capped at $2,500 or linehaul)
  - TONU: $250 flat fee
  - Dry Run: $250 flat fee
- ✅ **8 Other Terms**: Layover, Stop-Off, Reconsignment, After-hours, etc.
- ✅ **7 Warnings**: Template placeholders, variable costs, documentation requirements

**Performance**:
- Model: claude-sonnet-4-5
- Tokens: 28,664
- Extraction Time: 38 seconds
- Confidence: HIGH

**Build Status**: ✅ Build passing, all routes deployed

**Flexible Schema** (from `/types/contract.ts`):
```typescript
interface ExtractedContractTerms {
  parties: {
    shipper?: string;
    carrier?: string;
    consignee?: string;
    warehouse?: string;
    [key: string]: string | undefined;
  };
  complianceWindows?: { name: string; windowMinutes: number; description?: string }[];
  delayPenalties?: { name: string; freeTimeMinutes: number; tiers: {...}[] }[];
  partyPenalties?: { partyName: string; penaltyType: string; ... }[];
  otherTerms?: { name: string; description: string; financialImpact?: string }[];
  _meta: { documentName: string; extractedAt: string; confidence: string; warnings?: string[] };
}
```

### 7.4 Update Cost Engine ✅ COMPLETE (2026-01-22)

**Tasks**:
- [x] Generalize `/lib/cost-engine.ts` for dynamic terms
  - [x] Work with `delayPenalties[]` array (multiple types)
  - [x] Work with `partyPenalties[]` (dynamic parties)
  - [x] Handle missing sections gracefully
- [x] Update `/types/cost.ts` to support new structure
- [x] Deprecate `DEFAULT_CONTRACT_RULES` (keep for fallback)

**Implementation Details**:

1. **Updated Types** (`/types/cost.ts`)
   - Added `CostCalculationParamsWithTerms` interface for dynamic terms
   - Imported `ExtractedContractTerms` from contract types
   - Marked `DEFAULT_CONTRACT_RULES` as `@deprecated` with `@fallback` note
   - Maintained backward compatibility with existing `CostCalculationParams`

2. **Conversion Functions** (`/lib/cost-engine.ts`)
   - `convertExtractedTermsToRules()` - Main conversion function
     - Transforms `ExtractedContractTerms` → `ContractRules`
     - Gracefully falls back to `DEFAULT_CONTRACT_RULES` on errors
     - Logs warnings for missing sections
   - `convertDelayPenaltiesToDwellRules()` - Converts delay penalties
     - Finds first "dwell" or "detention" penalty
     - Converts minutes to hours for legacy format
     - Handles missing or empty penalty arrays
   - `convertPartyPenaltiesToChargebacks()` - Converts party penalties
     - Supports dynamic party name matching (case-insensitive)
     - Aggregates multiple penalties per party
     - Maps to `RetailerChargebacks` format for backward compatibility

3. **New Cost Calculation Function**
   - `calculateTotalCostImpactWithTerms()` - Uses extracted terms
     - Accepts `CostCalculationParamsWithTerms` with optional `extractedTerms`
     - Converts terms to legacy format internally
     - Delegates to existing `calculateTotalCostImpact()` for calculations
     - Maintains 100% backward compatibility

4. **Validation Helper**
   - `validateExtractedTermsForCostCalculation()` - Checks term usability
     - Returns `{ valid: boolean, warnings: string[] }`
     - Validates presence of delay penalties, compliance windows, party penalties
     - Provides actionable warnings for missing sections
     - Helps UI show extraction quality indicators

**Graceful Fallback Strategy**:
- No terms → Use `DEFAULT_CONTRACT_RULES` + log warning
- Missing dwell/detention → Use default dwell rules + warn
- Missing compliance windows → Use default 30-min OTIF window + warn
- Missing party penalties → Use default retailer chargebacks + warn
- Partial terms → Mix extracted + default values as needed

**Test Results** (`/tests/test-cost-engine.ts`):
- ✅ Test 1: Validate extracted terms
- ✅ Test 2: Convert to legacy rules format
- ✅ Test 3: Small delay (20 min) → $0 (within OTIF, no dwell)
- ✅ Test 4: Medium delay (90 min) → $1700 (OTIF violation only)
- ✅ Test 5: Large delay (180 min) → $1750 (OTIF + 1hr dwell at $50/hr)
- ✅ Test 6: No terms provided → Fallback to defaults
- ✅ Test 7: Partial terms → Mix extracted + defaults

**Backward Compatibility**:
- ✅ Existing `calculateTotalCostImpact()` unchanged
- ✅ All existing code continues to work
- ✅ New `calculateTotalCostImpactWithTerms()` for dynamic terms
- ✅ Conversion layer handles format differences

**Build Status**: ✅ Passing (`npm run build`)

### 7.5 Update SetupForm ✅ COMPLETE (2026-01-22)

**Tasks**:
- [x] Remove retailer/party dropdown from both SetupForm variants
- [x] Update types in `/types/dispatch.ts` to remove `retailer` from `SetupParams`
- [x] Update workflow hook to use fallback retailer value ('Walmart')
- [x] Update all references to use 'Walmart' fallback until Phase 7.6

**Implementation Details**:

Removed the hardcoded retailer dropdown UI and updated all code to use a fallback value until contract-based party extraction is implemented in Phase 7.6.

**Files Modified**:

1. **Types** (`/types/dispatch.ts`):
   - Removed `retailer: Retailer` from `SetupParams` interface
   - Kept `Retailer` type for backward compatibility with cost engine

2. **Workflow Hook** (`/hooks/useDispatchWorkflow.ts`):
   - Removed `retailer: 'Walmart'` from `DEFAULT_SETUP_PARAMS`
   - Updated `startAnalysis()` to not destructure `retailer` from setupParams
   - Changed thinking step from "Destination retailer" to generic party penalties
   - Added fallback comments: `retailer: 'Walmart' as Retailer // Fallback - will be replaced by extracted party in Phase 7.6`
   - Updated 3 cost calculation calls with fallback value

3. **Cost Calculation Hook** (`/hooks/useCostCalculation.ts`):
   - Made `retailer` parameter optional with default value 'Walmart'
   - Updated interface: `retailer?: Retailer; // Optional - defaults to 'Walmart' for backward compatibility`

4. **SetupForm Components** (both variants):
   - **`/components/dispatch/SetupForm.tsx`**:
     - Removed `Retailer` type import
     - Removed `RETAILERS` constant array
     - Removed `retailer` from params destructuring
     - Removed entire retailer selection section (lines 93-111)
   - **`/components/dispatch-carbon/SetupForm.tsx`**:
     - Same changes as original SetupForm
     - Maintained Carbon design system styling

5. **VAPI Integration**:
   - **`/hooks/useVapiIntegration.ts`**:
     - Removed `retailer` from setupParams destructuring
     - Updated vapiVariables to use hardcoded 'Walmart' with fallback comment
   - **`/app/dispatch/page.tsx`**:
     - Removed `retailer` from setupParams destructuring
     - Updated VAPI variables with fallback: `retailer: 'Walmart'`
   - **`/app/dispatch-2/page.tsx`**:
     - Same changes as original dispatch page

**Fallback Strategy**:

All cost calculations and VAPI calls now use 'Walmart' as the fallback retailer/party name:
- `retailer: 'Walmart' as Retailer // Fallback - will be replaced by extracted party in Phase 7.6`
- This maintains functionality while preparing for dynamic party extraction

**Why 'Walmart' as Fallback?**:
- Most comprehensive penalty structure in `DEFAULT_CONTRACT_RULES`
- Conservative approach - won't under-estimate costs
- Will be replaced by actual extracted party name in Phase 7.6

**Testing**:
- ✅ Build passes: `npm run build` successful
- ✅ No TypeScript errors
- ✅ Both `/dispatch` and `/dispatch-2` routes compiled
- ✅ All API routes functional

**Build Status**: ✅ Passing

**User Impact**:
- Setup form now has one less input field (cleaner UI)
- Party information will be automatically extracted from contracts in Phase 7.6
- Negotiation behavior unchanged (uses same Walmart contract rules as before)

### 7.6 Update Workflow Hook ✅ COMPLETE (2026-01-22)

**Tasks**:
- [x] Add `fetching_contract` stage to `/hooks/useDispatchWorkflow.ts`
- [x] Add `analyzing_contract` stage
- [x] Call `/api/contract/fetch` then `/api/contract/analyze`
- [x] Store extracted terms in workflow state
- [x] Pass extracted terms to cost calculations
- [x] Add thinking steps for actual analysis (not fake)
- [x] Add debug traces throughout

**Implementation Details**:

1. **Updated Types** (`/types/dispatch.ts`)
   - Added `'fetching_contract'` and `'analyzing_contract'` to `WorkflowStage` type
   - Stages now: `setup → fetching_contract → analyzing_contract → analyzing → negotiating → complete`

2. **Updated Workflow Hook** (`/hooks/useDispatchWorkflow.ts`)
   - Added new state variables:
     - `extractedTerms: ExtractedContractTerms | null` - Stored extracted contract terms
     - `contractError: string | null` - Error message if contract fetch/analysis fails
     - `contractFileName: string | null` - Name of fetched contract file
     - `partyName: string | null` - Extracted consignee/party name for cost calculations
   - Updated `INITIAL_TASKS` with contract-related steps:
     - `fetch-contract`, `analyze-contract`, `compute-impact`, `contact`, `negotiate`, `confirm-dock`, `finalize`
   - Completely rewrote `startAnalysis()` function with 3 phases:
     - **Phase 1**: Fetch contract from Google Drive (`/api/contract/fetch`)
     - **Phase 2**: Analyze contract with Claude (`/api/contract/analyze`)
     - **Phase 3**: Compute financial impact using extracted terms
   - Updated `evaluateTimeOffer()` to use `calculateTotalCostImpactWithTerms()` when extracted terms available
   - Updated `reset()` to clear contract-related state
   - Exposed new state in hook return type

3. **Graceful Degradation**
   - If contract fetch fails → Uses default contract rules + shows warning
   - If contract analysis fails → Uses default contract rules + shows warning
   - If extracted terms missing sections → Falls back to defaults for that section
   - Console logs throughout for debugging

**New Workflow Flow**:
```
User clicks "Start"
  ↓
Stage: fetching_contract
  - Thinking: "Fetching Contract"
  - Call POST /api/contract/fetch
  - Show file name on success
  ↓
Stage: analyzing_contract
  - Thinking: "Analyzing Contract Terms"
  - Call POST /api/contract/analyze
  - Extract parties, penalties, compliance windows
  - Show confidence level
  ↓
Stage: analyzing
  - Thinking: "Computing Financial Impact"
  - Use extracted terms (or defaults) for cost calculation
  - Create negotiation strategy with dynamic rules
  ↓
Stage: negotiating
  - Thinking: "Initiating Warehouse Contact"
  - Start text chat or voice call
```

**Files Modified**:
- `/types/dispatch.ts` - Added new workflow stages
- `/hooks/useDispatchWorkflow.ts` - Major rewrite of analysis workflow

**Build Status**: ✅ Passing (`tsc --noEmit` successful)

### 7.7 UI Updates ✅ COMPLETE (2026-01-22)

**Tasks**:
- [x] Create `/components/dispatch/ContractTermsDisplay.tsx`
  - [x] Show extracted parties
  - [x] Show penalty structure
  - [x] Show extraction confidence/warnings
- [x] Update `StrategyPanel.tsx` to show contract source indicator
- [x] Add ContractTermsDisplay to both dispatch pages

**Implementation Details**:

1. **ContractTermsDisplay Component** (both `/components/dispatch/` and `/components/dispatch-carbon/`)
   - Collapsible panel showing extracted contract details
   - **Header**: Shows confidence level (HIGH/MEDIUM/LOW) with color coding
   - **Parties Section**: Displays shipper, carrier, consignee, warehouse
   - **Compliance Windows**: Shows OTIF windows with ±minutes
   - **Delay Penalties**: Tiered rates with free time and hourly charges
   - **Party Penalties**: Flat fees, percentages, per-occurrence costs
   - **Warnings**: Displays extraction warnings from `_meta`
   - **States**: Loading, error, no-contract, and success states

2. **StrategyPanel Updates** (both styled versions)
   - Added optional `contractSource` prop ('extracted' | 'defaults' | null)
   - Added optional `partyName` prop to show extracted party
   - Shows small indicator in header:
     - ✓ Green "Contract" or party name when using extracted terms
     - ⚠ Amber "Defaults" when falling back to default rules

3. **Dispatch Pages Updated**
   - Both `/dispatch` and `/dispatch-2` pages now:
     - Import and use `ContractTermsDisplay` component
     - Pass contract source indicator to `StrategyPanel`
     - Show contract terms panel after strategy panel during negotiation

**Files Created**:
- `/components/dispatch/ContractTermsDisplay.tsx` - Original styled (245 lines)
- `/components/dispatch-carbon/ContractTermsDisplay.tsx` - Carbon styled (260 lines)

**Files Modified**:
- `/components/dispatch/index.ts` - Export ContractTermsDisplay
- `/components/dispatch-carbon/index.ts` - Export ContractTermsDisplay
- `/components/dispatch/StrategyPanel.tsx` - Added contractSource, partyName props
- `/components/dispatch-carbon/StrategyPanel.tsx` - Added contractSource, partyName props
- `/app/dispatch/page.tsx` - Added ContractTermsDisplay, updated StrategyPanel props
- `/app/dispatch-2/page.tsx` - Added ContractTermsDisplay, updated StrategyPanel props

**Build Status**: ✅ Passing (`tsc --noEmit` successful)

### 7.8 Testing & Validation ✅ COMPLETE (2026-01-22)

**Tasks Completed**:
- [x] Create comprehensive edge case test script
- [x] Create unit tests for cost engine with extracted terms
- [x] Create end-to-end workflow test
- [x] Update tests/README.md documentation

**Test Scripts Created**:

1. **`/tests/test-edge-cases.sh`** - Edge case validation (380+ lines)
   - API health checks (all endpoints)
   - Input validation (missing fields, invalid types)
   - Empty/invalid folder handling
   - Minimal document analysis (low confidence handling)
   - Custom penalty types → `otherTerms` capture
   - Party name extraction (different consignees)
   - Partial extraction (missing sections)
   - Error response format consistency

2. **`/tests/test-e2e-workflow.sh`** - End-to-end workflow test (250+ lines)
   - Complete workflow simulation (fetch → analyze → compute → verify)
   - Cost calculation for multiple time slots
   - Strategy calculation verification
   - Time/dock extraction validation

3. **`/tests/test-cost-engine-with-terms.ts`** - TypeScript unit tests (300+ lines)
   - Validate extracted terms structure
   - Convert extracted terms to legacy rules format
   - Cost calculation with extracted terms
   - Fallback to defaults when terms missing
   - Partial terms handling
   - Edge cases (zero values, very large delays)
   - Party name matching (case-insensitive)

**Test Coverage**:
- [x] No document in folder → graceful error with message
- [x] Invalid folder ID → graceful error
- [x] Contract with unknown penalty types → captured in `otherTerms`
- [x] Contract missing sections → partial extraction with warnings
- [x] Different party names → correctly identified and used
- [x] End-to-end: fetch → analyze → negotiate flow
- [x] Cost calculation with extracted terms vs defaults
- [x] Input validation for all API endpoints

**Running Tests**:
```bash
# All tests (recommended order)
./tests/test-contract-flow.sh      # Basic contract analysis
./tests/test-edge-cases.sh         # Edge cases and validation
./tests/test-e2e-workflow.sh       # Full end-to-end workflow

# TypeScript unit tests
npx ts-node tests/test-cost-engine-with-terms.ts
```

**Documentation Updated**:
- `/tests/README.md` - Comprehensive test documentation with:
  - Test descriptions and expected output
  - Manual curl commands for debugging
  - Test scenarios (short/medium/long delays)
  - Troubleshooting guide

**Build Status**: ✅ Passing

---

## Phase 10: Hours of Service (HOS) Integration 🔄 IN PROGRESS (2026-01-24)

**Goal**: Integrate FMCSA Hours of Service (49 CFR Part 395) constraints into dock rescheduling. Add **driver availability feasibility** as a new dimension alongside cost analysis when negotiating appointments.

### 10.1 Types & HOS Engine ✅ COMPLETE

**Problem Identified**:
- Dispatcher only considered **financial impact** (dwell time, OTIF penalties) when evaluating dock times
- Didn't consider whether the driver can **legally** work at that time under HOS regulations
- Example: Driver has 2 hours remaining in 14-hour window, but warehouse offers 7 PM slot → system would evaluate cost only, not HOS feasibility

**Design Decisions**:
1. **Simplified HOS Input Model**: Capture current state (remaining time) rather than full duty status timeline
2. **14-Hour Window is Critical**: Non-pausable constraint for dock scheduling
3. **HOS Presets**: Fresh Shift (11h/14h), Mid-Shift (6h/8h), End of Shift (2h/3h), Custom
4. **Driver Detention Rate**: User configurable for next-shift cost calculations

**Files Created**:

1. **`/types/hos.ts`** (250 lines) - HOS type definitions
   ```typescript
   interface DriverHOSStatus {
     remainingDriveMinutes: number;       // Out of 660 (11 hours)
     remainingWindowMinutes: number;      // Out of 840 (14 hours) - KEY CONSTRAINT
     remainingWeeklyMinutes: number;      // Out of 3600/4200 (60/70 hours)
     minutesSinceLastBreak: number;       // Driving time since last 30-min break
     config: DriverHOSConfig;
   }

   const HOS_PRESETS = {
     fresh_shift: { remainingDriveMinutes: 660, remainingWindowMinutes: 840, ... },
     mid_shift: { remainingDriveMinutes: 360, remainingWindowMinutes: 480, ... },
     end_of_shift: { remainingDriveMinutes: 120, remainingWindowMinutes: 180, ... },
     custom: { ... }
   };
   ```

2. **`/lib/hos-engine.ts`** (400 lines) - HOS calculation logic
   - `checkHOSFeasibility()` - Check if dock time is feasible given HOS constraints
   - `calculateLatestLegalDockTime()` - Calculate latest time driver can be at dock
   - `calculateNextShiftRequirement()` - Determine if next shift is needed
   - `estimateNextShiftCost()` - Calculate detention/layover costs
   - `calculateHOSStrategyConstraints()` - Generate constraints for negotiation strategy

**Key HOS Constraints**:
| Clock | Limit | Description |
|-------|-------|-------------|
| Driving Clock | 11 hours max | Total driving time in shift |
| On-Duty Window | 14 hours | Non-pausable, dock wait time counts |
| Break Clock | 30-min after 8h driving | Required before more driving |
| Weekly Clock | 60h/7d or 70h/8d | Rolling on-duty limit |

### 10.2 Setup Form Updates ✅ COMPLETE

**UI Design**:
```
┌─ Driver Hours of Service ─────────────────────────────────────┐
│ [x] Enable HOS Constraints                                     │
│                                                                 │
│ Preset: [Fresh Shift] [Mid-Shift] [End of Shift] [Custom]     │
│                                                                 │
│ ┌─ Current Shift Status ─────────────────────────────────────┐│
│ │ Remaining Drive Time     [==========] 11h 00m / 11h        ││
│ │ Remaining Window Time    [==========] 14h 00m / 14h        ││
│ │ Time Since Last Break    [----------]  0h 00m /  8h        ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─ Weekly Status ────────────────────────────────────────────┐│
│ │ Week Rule: [70h in 8 days ▼]                                ││
│ │ Remaining Weekly Hours   [==========] 70h 00m / 70h         ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─ Cost Configuration ───────────────────────────────────────┐│
│ │ Driver Detention Rate    [$|50     ] per hour               ││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Files Modified**:
- `/types/dispatch.ts` - Added HOS fields to SetupParams (hosEnabled, hosPreset, driverHOS, driverDetentionRate)
- `/components/dispatch/SetupForm.tsx` - Added HOS section with presets and sliders
- `/components/dispatch-carbon/SetupForm.tsx` - Carbon variant with same functionality

### 10.3 Cost Engine & Strategy Integration ✅ COMPLETE

**Cost Types Updated** (`/types/cost.ts`):
```typescript
interface HOSCostImpact {
  feasibleInCurrentShift: boolean;
  nextShiftCost?: {
    driverDetentionHours: number;
    detentionRatePerHour: number;
    detentionCost: number;
    layoverRequired: boolean;
    layoverCost: number;
    totalNextShiftPremium: number;
  };
  adjustedTotalCost: number;
  bindingConstraint?: string;
  latestLegalDockTime?: string;
}
```

**Negotiation Strategy Updated** (`/lib/negotiation-strategy.ts`):
- Added `HOSStrategyConstraints` to `NegotiationStrategy`
- Strategy creation applies **HOS ceiling** to cost thresholds
- If HOS constraint is before cost threshold, mark it as binding
- Added display info for HOS constraints (latestFeasibleTime, remainingWindowMinutes, bindingConstraint)

**Strategy Creation Logic**:
```typescript
// IDEAL cannot exceed HOS feasible time
thresholds.ideal.maxMinutes = Math.min(costBasedIdeal, hosConstraints.latestFeasibleTimeMinutes);

// ACCEPTABLE cannot exceed HOS feasible time
thresholds.acceptable.maxMinutes = Math.min(costBasedAcceptable, hosConstraints.latestFeasibleTimeMinutes);
```

### 10.4 Workflow Hook Integration ✅ COMPLETE

**Files Modified**:
- `/hooks/useDispatchWorkflow.ts` - Updated DEFAULT_SETUP_PARAMS with HOS defaults, passes driverHOS to createNegotiationStrategy()

**Default Values**:
```typescript
hosEnabled: false,
hosPreset: 'fresh_shift',
driverHOS: undefined,
driverDetentionRate: 50
```

### 10.5 UI Updates ✅ COMPLETE

**StrategyPanel Updates** (both variants):
- Shows HOS status indicator with remaining window time
- Displays HOS warning banner when constraints are binding
- Shows latest feasible time based on HOS
- Indicates which constraint is binding (14H_WINDOW, 11H_DRIVE, etc.)

**Visual Indicator**:
```
┌─ STRATEGY PANEL ────────────────────────────────────────┐
│ [Target] Strategy                      [⏰ HOS Limit]   │
│                                         8:00 PM         │
│ ⚠️ Driver's 14 hour window constraint: 8h remaining.   │
│    Must complete by 8:00 PM.                           │
│                                                         │
│ ┌─ IDEAL ────┐ ┌─ OK ────────┐ ┌─ BAD ────────────────┐│
│ │ Before     │ │ Before      │ │ After                ││
│ │ 4:00 PM    │ │ 5:30 PM     │ │ 5:30 PM              ││
│ └────────────┘ └─────────────┘ └──────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Files Modified**:
- `/components/dispatch/StrategyPanel.tsx` - Added HOS display sections
- `/components/dispatch-carbon/StrategyPanel.tsx` - Carbon variant

### 10.6 API Webhook Updates ✅ COMPLETE

**Files Modified**:
- `/app/api/tools/check-slot-cost/route.ts` - Added HOS validation to response

**New VapiToolCall Arguments**:
```typescript
interface VapiToolCall {
  function: {
    arguments: {
      // Existing fields...
      hosEnabled?: boolean;           // HOS enabled flag
      currentTime?: string;           // Current time for calculations
      driverHOSJson?: string;         // JSON string of driver HOS status
      driverDetentionRate?: number;   // Detention rate per hour
    };
  };
}
```

**Updated Response**:
```typescript
interface VapiToolResult {
  result: {
    // Existing fields...
    hosFeasible?: boolean;
    hosBindingConstraint?: HOSBindingConstraint | null;
    hosLatestLegalTime?: string | null;
    hosRequiresNextShift?: boolean;
    combinedAcceptable?: boolean;  // acceptable AND hosFeasible
  };
}
```

**Logic**:
- Parse driver HOS status from JSON if provided
- Call `checkHOSFeasibility()` to validate dock time
- If HOS infeasible, override suggested counter-offer with latest legal time
- Return combined acceptance (cost AND HOS)

### 10.7 Contract Analysis Updates ✅ COMPLETE

**Files Modified**:
- `/types/contract.ts` - Added hosRequirements, hosPenalties
- `/lib/contract-analyzer.ts` - Added HOS extraction to Claude prompt

**New Fields in ExtractedContractTerms**:
```typescript
interface ExtractedContractTerms {
  // Existing fields...

  hosRequirements?: {
    maxContinuousDrivingHours?: number;
    requiredRestHours?: number;
    breakRequirements?: string;
    driverDetentionRatePerHour?: number;
    layoverDailyRate?: number;
    hosClauseDescription?: string;
    rawText?: string;
  };

  hosPenalties?: {
    name: string;
    violationType: string;
    penaltyAmount?: number;
    penaltyPercentage?: number;
    description?: string;
  }[];
}
```

**Schema Updates**:
- Added `hosRequirements` object schema for driver rest/detention terms
- Added `hosPenalties` array schema for HOS violation penalties

**Prompt Updates**:
- Added HOS extraction instructions to system prompt
- Added HOS-related terms to extraction instruction
- Common HOS terms: "detention", "layover", "driver hours", "rest period", "DOT compliance"

### 10.8 Documentation Updates ✅ COMPLETE

- [x] Add Phase 10 to PROGRESS.md (this section)
- [x] Add HOS section to CLAUDE.md (HOS constraints, input model, presets, VAPI variables)
- [x] Update Utilities section with hos-engine.ts
- [x] Update Directory Structure with hos.ts

### 10.9 Testing & Validation 🔄 IN PROGRESS

**Build Status**: ✅ Passing (`npm run build` successful)

**Test Scenarios**:
- [x] TypeScript compilation passes
- [ ] HOS enabled with Fresh Shift preset → full availability
- [ ] HOS enabled with End of Shift → limited availability, warnings shown
- [ ] Warehouse offers time beyond HOS → rejected with counter-offer
- [ ] Next shift required → detention cost calculated
- [ ] VAPI receives HOS variables correctly

**Manual Testing Recommended**:
1. Start dev server: `npm run dev`
2. Navigate to `/dispatch` or `/dispatch-2`
3. Enable HOS in Setup Form
4. Select different presets (Fresh Shift, Mid-Shift, End of Shift)
5. Verify Strategy Panel shows HOS constraints
6. Test voice call with HOS-constrained scenarios

---

## Phase 11: Production Readiness ⬜ NOT STARTED

- [ ] Add error boundaries
- [ ] Add loading states
- [ ] Add proper error handling
- [ ] Environment variable validation
- [ ] API rate limiting (optional)
- [ ] Vercel/Netlify deployment config

---

## Code Migration Checklist

### From `disptacher-workflow/src/LiveDispatcherAgentVapi.jsx`:

| Lines | Content | Target Location | Status |
|-------|---------|-----------------|--------|
| 25-115 | Cost calculation functions | `/lib/cost-engine.ts` | ✅ |
| 120-175 | Negotiation strategy | `/lib/negotiation-strategy.ts` | ✅ |
| 66-86 | Time/dock parsing | `/lib/time-parser.ts` | ✅ |
| 180-250 | ThinkingBlock component | `/components/dispatch/ThinkingBlock.tsx` | ✅ |
| 250-320 | ChatMessage component | `/components/dispatch/ChatInterface.tsx` | ✅ |
| 320-400 | CostBreakdown component | `/components/dispatch/CostBreakdown.tsx` | ✅ |
| 400-486 | StrategyPanel component | `/components/dispatch/StrategyPanel.tsx` | ✅ |
| 486-600 | VapiCallInterface | `/components/dispatch/VoiceCallInterface.tsx` | ✅ |
| 604-686 | Workflow orchestration | `/hooks/useDispatchWorkflow.ts` | ✅ |
| 686-900 | Message handlers | `/hooks/useVapiCall.ts` | ✅ |

### From `disptacher-workflow/server/server.js`:

| Content | Target Location | Status |
|---------|-----------------|--------|
| Health endpoint | `/app/api/health/route.ts` | ✅ |
| Extract endpoint | `/app/api/extract/route.ts` | ✅ |
| Chat endpoint | `/app/api/chat/route.ts` | ✅ |

### From `tools/check_slot_cost.js`:

| Content | Target Location | Status |
|---------|-----------------|--------|
| Cost analysis logic | `/lib/cost-engine.ts` (merged) | ✅ |
| Webhook handler | `/app/api/tools/check-slot-cost/route.ts` | ✅ |

---

## Known Issues & Blockers

1. ~~**Duplicate Logic** - Cost engine exists in both folders~~ ✅ Merged into shared library
2. **API Keys Exposed** - Keys in `.env` files need rotation after migration
3. ~~**VAPI SDK** - Need to verify `@vapi-ai/web` npm package works in Next.js~~ ✅ Works with dynamic import
4. ~~**No Tests** - Consider adding basic tests during migration~~ ✅ Comprehensive tests added in Phase 7.8
5. ~~**Hardcoded Contract Rules** - `DEFAULT_CONTRACT_RULES` was static~~ ✅ Replaced with LLM extraction (Phase 7)
6. ~~**Hardcoded Retailers** - Only 5 retailers supported~~ ✅ Replaced with dynamic party extraction (Phase 7)

---

## Phase 8: UI Redesign & Modular Architecture ✅ COMPLETE (2026-01-22)

**Goal**: Create premium B2B UI with Carbon design system while ensuring business logic is modular and shared between UI variants.

### 8.1 Carbon Theme Design System ✅ COMPLETE

**Design Philosophy**: "Confident Restraint" - Vercel/Stripe/GitHub inspired minimal dark theme

**Color Palette**:
- Base: `#0a0a0a` (true black) → Surface layers `#111111`, `#171717`, `#1f1f1f`
- Text: `#EDEDED` (primary) → `#888888` (secondary) → `#666666` (tertiary)
- Accent: `#0070F3` (clean blue), `#EDEDED` (white)
- Semantic: `#50E3C2` (success), `#F5A623` (warning), `#EE0000` (critical)

**Design Principles**:
- No gradients - solid colors only
- Minimal borders with subtle hover states
- Generous whitespace for premium feel
- Clean typography with Inter + JetBrains Mono
- Authority through restraint

**Files Created**:
- [x] `/lib/themes/carbon.ts` - Complete Carbon color palette and component styles
- [x] `/app/design-preview/page.tsx` - Design proposal comparison page
- [x] `/app/design-preview/proposal-d/page.tsx` - Obsidian dark theme (violet accent)
- [x] `/app/design-preview/proposal-e/page.tsx` - Carbon dark theme (white/blue accent) ⭐ SELECTED
- [x] `/app/design-preview/proposal-a/page.tsx` - Classic Enterprise (Navy+Teal light)
- [x] `/app/design-preview/proposal-b/page.tsx` - Modern Professional (Navy+Teal light)
- [x] `/app/design-preview/proposal-c/page.tsx` - Premium Tech (Navy+Teal light)

### 8.2 Carbon-Styled Components ✅ COMPLETE

Created parallel component set with Carbon styling while maintaining identical functionality:

- [x] `/components/dispatch-carbon/SetupForm.tsx` - Carbon inputs, buttons, minimal styling
- [x] `/components/dispatch-carbon/ThinkingBlock.tsx` - Carbon colors for reasoning steps
- [x] `/components/dispatch-carbon/StrategyPanel.tsx` - IDEAL/OK/BAD with Carbon semantic colors
- [x] `/components/dispatch-carbon/FinalAgreement.tsx` - Carbon success styling
- [x] `/components/dispatch-carbon/index.ts` - Clean export interface

**Key Achievement**: Same component interface, different visual presentation

### 8.3 Dispatch-2 Page ✅ COMPLETE

- [x] `/app/dispatch-2/page.tsx` - Full dispatch functionality with Carbon theme
  - Same hooks: `useDispatchWorkflow`, `useVapiCall`, `useAutoEndCall`
  - Same logic: VAPI integration, text mode, cost analysis
  - Same progressive disclosure: step-by-step reveals with loading states
  - Different: Carbon visual styling only

**Access**: http://localhost:3000/dispatch-2 or http://localhost:3001/dispatch-2

### 8.4 Modular Architecture Refactoring ✅ COMPLETE

**Problem**: Business logic was duplicated between `/dispatch` and `/dispatch-2`, causing:
- Bug fixes needed in two places
- Feature additions needed in two places
- Risk of inconsistency between pages

**Solution**: Extract all business logic into shared hooks and utilities

#### Shared Hooks Created

- [x] `/hooks/useProgressiveDisclosure.ts` - 147 lines
  - UI state machine for step-by-step reveals
  - Loading states between sections (reasoning → summary → strategy)
  - Typewriter completion tracking
  - Auto-reset on workflow restart
  - **Usage**: Both pages use identical progressive disclosure logic

- [x] `/hooks/useVapiIntegration.ts` - 216 lines
  - Complete VAPI SDK initialization and lifecycle
  - Event handling (call-start, call-end, transcripts)
  - Speech detection (assistant speaking states)
  - Silence timer management (3s silence before call end)
  - **Usage**: Both pages have identical voice call behavior

#### Shared Utilities Created

- [x] `/lib/message-extractors.ts` - 64 lines
  - `extractTimeFromMessage()` - Parse "2pm", "14:30", "around 3" → "14:00"
  - `extractDockFromMessage()` - Parse "dock 5", "bay 12" → "5"
  - `formatTimeForSpeech()` - Convert "14:30" → "2:30 PM"
  - **Usage**: Both text mode and voice mode use same extraction logic

- [x] `/lib/text-mode-handlers.ts` - 153 lines
  - `handleAwaitingName()` - Initial greeting response
  - `handleNegotiatingTime()` - Time negotiation logic with cost evaluation
  - `handleAwaitingDock()` - Dock confirmation logic
  - `handleConfirming()` - Final confirmation response
  - `getSuggestedCounterOffer()` - Counter offer generation
  - **Usage**: Both pages have identical text mode conversation flow

#### Architecture Benefits

**Before Modularization**:
```typescript
// Change negotiation logic
/app/dispatch/page.tsx line 598        ❌ Change here
/app/dispatch-2/page.tsx line 598      ❌ AND here
// Risk: Forget one = inconsistent behavior
```

**After Modularization**:
```typescript
// Change negotiation logic
/lib/text-mode-handlers.ts             ✅ Change ONCE
// Both /dispatch and /dispatch-2 automatically updated!
```

**What's Shared (Single Source of Truth)**:
- ✅ VAPI call integration
- ✅ Message parsing (time/dock/name extraction)
- ✅ Cost calculation engine
- ✅ Negotiation strategy logic
- ✅ Text mode conversation flow
- ✅ Progressive disclosure state machine
- ✅ Backend API routes (extract, chat, check-slot-cost)

**What's Different (UI Only)**:
- ❌ Visual components (buttons, colors, spacing)
- ❌ Theme (purple/emerald vs. carbon black/blue)

**Testing Impact**:
- Pure functions (`/lib/`) - Easy to unit test
- Hooks (`/hooks/`) - Test with React Testing Library
- E2E tests - Same test suite runs against both `/dispatch` and `/dispatch-2`

### 8.5 Documentation Updates ✅ COMPLETE

- [x] Updated `CLAUDE.md` - Added "Modular Architecture" section with design principles
- [x] Updated `PROGRESS.md` - Documented Phase 8 completion (this section)

### Files Summary (Phase 8)

**New Files Created**: 14
- 1 theme file (`carbon.ts`)
- 5 design preview pages (proposals A-E)
- 4 Carbon-styled components
- 2 shared hooks (`useProgressiveDisclosure`, `useVapiIntegration`)
- 2 shared utilities (`message-extractors`, `text-mode-handlers`)

**Total Lines Added**: ~1,200 lines of modular, reusable code

---

## Phase 9: UI Enhancements ✅ IN PROGRESS

### 9.1 Finalized Agreement Display ✅ COMPLETE (2026-01-24)

**Goal**: Show finalized agreement details after voice call ends to clearly communicate that the subagent completed its work.

**Implementation**:

Added a new "Agreement Finalized" section that appears after the "Spinning up Voice Subagent" section when a voice call ends successfully.

**State Management**:
- Added 4 new state variables for progressive disclosure:
  - `showFinalizedAgreement` - Controls section visibility
  - `finalizedHeaderComplete` - Tracks header typewriter completion
  - `finalizedTypingComplete` - Tracks description typewriter completion
  - `loadingFinalized` - Shows loading spinner during transition

**Progressive Disclosure Flow**:
1. Voice call ends (callStatus === 'ended')
2. System checks for confirmed time and dock
3. 1-second loading spinner appears
4. "Agreement Finalized" section reveals
5. Header animates with typewriter effect
6. Description animates with typewriter effect
7. Details card appears showing all confirmed information

**Information Displayed**:
- Original Time - Initial appointment time from setup
- Driver Delay - Delay in minutes (highlighted in amber/warning color)
- New Arrival Time - Calculated actual arrival time (original + delay)
- New Confirmed Time - Rescheduled appointment time (highlighted in green/success color)
- Dock Number - Confirmed dock assignment (highlighted in green/success color)
- Warehouse Contact - Name of warehouse manager (if captured)
- Total Cost Impact - Financial impact with cost breakdown (highlighted in amber/warning color)

**Visual Design**:
- **Original Theme** (`/dispatch`): Emerald green success styling with slate details card
- **Carbon Theme** (`/dispatch-2`): Carbon success colors with minimal aesthetic

**Files Modified**:
- `/app/dispatch/page.tsx` - Added finalized section (both split & single column layouts)
- `/app/dispatch-2/page.tsx` - Added finalized section (both split & single column layouts)

**Build Status**: ✅ Passing

**User Experience**:
- Clear visual feedback that negotiation is complete
- All relevant details visible in one place
- Consistent with existing progressive disclosure pattern
- Automatic state cleanup on workflow reset

**Follow-up Improvements**:
- Combined "New Confirmed Time" and "Dock Number" on single line (labeled "Confirmed:")
- Changed button text from "Save Agreement" to "Call Ended" for clarity
- Reduced silence period before auto-end from 3s to 2s for faster response

### 9.2 Bug Fix: Warehouse Contact Not Saving to Sheets ✅ COMPLETE (2026-01-24)

**Issue**: Warehouse manager name was not being saved to Google Sheets when call ended.

**Root Cause**: React state updates are asynchronous. When `handleVapiCallEnd` was called, it read `workflow.warehouseManagerName` from state, but the state update hadn't been applied yet. The same issue existed for `confirmedTime` and `confirmedDock`, which is why refs were already being used for those values.

**Fix**:
1. Added `warehouseManagerNameRef` to `useDispatchWorkflow` hook
2. Synced ref with state in useEffect (alongside confirmedTime/Dock refs)
3. Updated TypeScript interface to include the new ref
4. Modified both page components to use `workflow.warehouseManagerNameRef.current` instead of `workflow.warehouseManagerName` when saving to Google Sheets

**Files Modified**:
- `/hooks/useDispatchWorkflow.ts` - Added ref + TypeScript interface update
- `/app/dispatch/page.tsx` - Use ref when saving schedule
- `/app/dispatch-2/page.tsx` - Use ref when saving schedule

**Result**: Warehouse contact name now correctly saves to Google Sheets spreadsheet.

---

## Next Steps (Phase 7 Priority Order)

1. **Google Drive Integration** - Service account setup, file fetching ✅ COMPLETE
2. **Contract Analyzer** - Claude structured output for term extraction
3. **Update Cost Engine** - Generalize for dynamic penalty structures
4. **Remove Retailer Dropdown** - Party info from contract
5. **Update Workflow** - New stages for contract analysis
6. **Testing** - End-to-end with real contract documents

---

## Notes

- Keep original folders intact until migration verified working
- Test each phase before proceeding
- Commit after each completed phase
- Build verified working after Phase 4: `npm run build` passes
- Components use TypeScript with proper types from `/types/`
- Hooks extract complex logic from page component
- VAPI SDK dynamically imported to avoid SSR issues
