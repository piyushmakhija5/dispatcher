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

### Fix 1: Calculate Actual Arrival Time ⬜ NOT STARTED

**Problem**: All calculations use `original_appointment` instead of `original_appointment + delay_minutes`

**Impact**:
- Strategy cards show impossible times
- Negotiation logic asks for times before truck arrives
- Cost calculations relative to wrong baseline

**Files to Fix**:
- [ ] `/lib/negotiation-strategy.ts` - Add `actualArrivalTime` calculation
- [ ] `/hooks/useCostCalculation.ts` - Use arrival time, not original appointment
- [ ] `/components/dispatch/StrategyPanel.tsx` - Display arrival-relative times
- [ ] `/app/dispatch/page.tsx` - Pass `actualArrivalTime` to all components

**Implementation**:
```typescript
// Calculate actual arrival
const actualArrivalTime = addMinutesToTime(originalAppointment, delayMinutes);
// Example: "14:00" + 90 mins = "15:30"

// IDEAL: Within OTIF window of ARRIVAL (not original)
// If arrival is 15:30, OTIF window is 15:00-16:00
// IDEAL: 15:30-16:00 (0 dwell time, 0 OTIF penalty)
```

**Expected Result**: Strategy cards show "IDEAL: 15:30-16:00" not "Before 14:30"

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

### Fix 3: Add Arrival Time to VAPI Dynamic Variables ⬜ NOT STARTED

**Problem**: VAPI assistant doesn't know the actual arrival time, only delay minutes

**Current Variables**:
```json
{
  "original_appointment": "2 PM",
  "original_24h": "14:00",
  "delay_minutes": 90,
  "shipment_value": 50000,
  "retailer": "Walmart"
}
```

**Add New Variables**:
```json
{
  "original_appointment": "2 PM",
  "original_24h": "14:00",
  "delay_minutes": 90,
  "actual_arrival_time": "3:30 PM",      // ← NEW
  "actual_arrival_24h": "15:30",         // ← NEW
  "otif_window_start": "3:00 PM",        // ← NEW
  "otif_window_end": "4:00 PM",          // ← NEW
  "shipment_value": 50000,
  "retailer": "Walmart"
}
```

**Files to Update**:
- [ ] `/components/dispatch/VoiceCallInterface.tsx` - Calculate and pass new variables
- [ ] **VAPI Assistant Configuration** (user must update via VAPI dashboard)

**VAPI System Prompt Update Needed**:
```
Your truck will arrive at {{actual_arrival_time}} ({{actual_arrival_24h}} in 24h format).
You CANNOT accept appointment slots before this time - the truck won't be there yet.

Your goal is to negotiate the earliest possible slot AT OR AFTER {{actual_arrival_24h}}.

The OTIF window is {{otif_window_start}} to {{otif_window_end}}.
- Slots within this window = $0 OTIF penalty
- Slots outside this window = OTIF penalties apply

When negotiating:
- If warehouse offers a time BEFORE {{actual_arrival_24h}}, say "That's too early - our driver will arrive around {{actual_arrival_time}}"
- If warehouse offers a time AT or AFTER {{actual_arrival_24h}}, evaluate based on cost strategy
```

---

### Fix 4: Only Update Confirmed Time on Acceptance ⬜ NOT STARTED

**Problem**: Code updates `confirmedTime` when extracting warehouse offer, not when dispatcher accepts

**Current Behavior**:
```
Warehouse: "6 PM"
→ Extraction: {offeredTime: '18:00'}
→ Code: setConfirmedTime('18:00')  ❌ WRONG
→ Mike: "6 PM is too late, any chance for 2:30 PM?"
→ State shows confirmed=18:00 even though rejected
```

**Correct Behavior**:
```
Warehouse: "6 PM"
→ Extraction: {offeredTime: '18:00'}
→ Mike: "6 PM is too late for us..." (REJECT)
→ State: confirmedTime remains null

Warehouse: "3:45 PM"
→ Extraction: {offeredTime: '15:45'}
→ Mike: "Perfect, 3:45 PM works for us" (ACCEPT)
→ State: setConfirmedTime('15:45') ✅ CORRECT
```

**Files to Fix**:
- [ ] `/app/dispatch/page.tsx` - Remove premature state updates
- [ ] `/hooks/useVapiCall.ts` - Only update on explicit acceptance phrases
- [ ] Add acceptance detection: "perfect", "works for us", "that works", "sounds good"

**Implementation**:
```typescript
// In message handler
if (isAcceptancePhrase(transcript)) {
  setConfirmedTime(lastOfferedTime);
  setConfirmedDock(lastOfferedDock);
}

function isAcceptancePhrase(text: string): boolean {
  const acceptancePatterns = [
    /perfect/i, /works for us/i, /that works/i,
    /sounds good/i, /we'll take it/i, /let's go with/i
  ];
  return acceptancePatterns.some(p => p.test(text));
}
```

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

### Fix 7: Fix Counter-Offer Direction Logic ⬜ NOT STARTED

**Problem**: Mike asks for earlier times even when offer is already near optimal

**Current Bug**:
```
Warehouse: "5 PM" (reasonable - only 1.5hr after 3:30 arrival)
Mike: "Any chance you can fit us in earlier than 5 PM?" ❌
```

**Correct Logic**:
```
if (offeredTime is within ACCEPTABLE range) {
  → ACCEPT immediately
} else if (offeredTime > ACCEPTABLE_MAX) {
  → Counter-offer with time closer to arrival
  → "Any chance you have something around [arrival + 1hr]?"
} else if (offeredTime < actualArrival) {
  → Explain truck won't be there yet
  → "That's too early - driver arrives at [actualArrival]"
}
```

**Files to Fix**:
- [ ] `/lib/negotiation-strategy.ts` - Add counter-offer logic
- [ ] VAPI system prompt - Add decision tree for responses

---

### Fix 8: Duplicate Response Prevention ⬜ NOT STARTED

**Problem**: Same response sent twice with slight variations

**Example from logs**:
```
{type: 'model-output', output: "Alright, we'll go with 5 PM then."}
{type: 'model-output', output: "Alright, let's go with 5 PM then."}
```

**Investigation Needed**:
- [ ] Check if issue is in VAPI response streaming
- [ ] Check if our code is processing same message twice
- [ ] Review message deduplication logic in `/hooks/useVapiCall.ts`

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
