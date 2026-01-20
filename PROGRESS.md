# Dispatcher AI - Consolidation Progress

## Project Status: 🟢 Phase 5 Complete

Last Updated: 2026-01-20

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

## Phase 6: Negotiation Logic Fixes 🔴 IN PROGRESS

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
- [ ] Strategy shows IDEAL: 2:30-3:00 PM
- [ ] Mike accepts offers between 2:30-3:00 PM immediately
- [ ] Mike rejects offers before 2:30 PM ("truck won't be there yet")
- [ ] Mike negotiates for earlier if offered after 4:30 PM

**Test Scenario 2**: Medium Delay (90 mins)
- Original: 2:00 PM, Delay: 90 mins → Arrival: 3:30 PM
- [ ] Strategy shows IDEAL: 3:30-4:00 PM
- [ ] Mike accepts 3:45 PM immediately (in IDEAL range)
- [ ] Mike accepts 5:00 PM after one pushback (in ACCEPTABLE range)
- [ ] Mike rejects 2:30 PM ("driver arrives at 3:30 PM")

**Test Scenario 3**: Long Delay (180 mins)
- Original: 2:00 PM, Delay: 180 mins → Arrival: 5:00 PM
- [ ] Strategy shows IDEAL: 5:00-5:30 PM
- [ ] Mike explains OTIF already missed, negotiates minimal dwell time
- [ ] Mike accepts 5:15 PM immediately
- [ ] Mike pushes back on 7:00 PM (2hr+ dwell time)

---

### Phase 6B: Production Readiness ⬜ NOT STARTED
*(Moved to Phase 6B - will tackle after negotiation fixes)*

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
4. **No Tests** - Consider adding basic tests during migration

---

## Notes

- Keep original folders intact until migration verified working
- Test each phase before proceeding
- Commit after each completed phase
- Build verified working after Phase 4: `npm run build` passes
- Components use TypeScript with proper types from `/types/`
- Hooks extract complex logic from page component
- VAPI SDK dynamically imported to avoid SSR issues
