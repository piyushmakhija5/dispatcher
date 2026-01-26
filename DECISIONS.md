# Dispatcher AI - Decisions & Lessons Learned

> Architectural decisions, bug fixes, traps to avoid, and institutional knowledge.

---

## Table of Contents

1. [Quick Reference: Traps to Avoid](#quick-reference-traps-to-avoid)
2. [Architectural Decisions](#architectural-decisions)
3. [Bug Fixes & Root Causes](#bug-fixes--root-causes)
4. [Testing Lessons](#testing-lessons)
5. [VAPI Integration Lessons](#vapi-integration-lessons)
6. [React Patterns](#react-patterns)

---

## Quick Reference: Traps to Avoid

| Trap | Problem | Solution |
|------|---------|----------|
| React state in callbacks | State closure captures stale value | Use `useRef` for values needed in async callbacks |
| Times before truck arrival | Dispatcher asks for impossible times | Always use `actualArrival = original + delay` as baseline |
| Confirmed time on extraction | UI shows "confirmed" before acceptance | Only set confirmed state when `shouldAccept: true` |
| VAPI model-output events | Looks like duplicate messages | These are internal LLM events, not spoken output - ignore them |
| Hardcoded OTIF assumptions | Wrong thresholds for different contracts | Use cost curve analysis to detect penalty structure |
| PDF parsing libraries | Complex setup, poor layout handling | Claude processes PDFs natively via `document` content type |
| Silence timer too short | Call ends mid-sentence | Wait for `speech-end` event THEN start silence timer |
| VAPI arguments as string | Tool call arguments are JSON string, not object | Parse `call.function.arguments` if it's a string |
| VAPI event handler closures | `driverCallStatus` stale in call-end handler | Use `driverCallStatusRef.current` instead of state in VAPI callbacks |
| VAPI concurrent calls | VAPI doesn't support concurrent browser calls | END first call completely before starting second |
| Refs not synced after setState | Calling function immediately after setState reads stale refs | Update refs synchronously in setters, OR pass values as function params |

---

## Architectural Decisions

### AD-1: Claude Native PDF Processing

**Decision:** Use Claude's native PDF processing instead of `pdf-parse` or similar libraries.

**Context:**
- Phase 7 required extracting contract terms from PDF documents
- Initial plan was to use `pdf-parse` npm package

**Why This Approach:**
- Claude can process PDFs natively via the `document` content type in the API
- Claude's PDF understanding handles complex layouts, tables, and formatting better
- No additional dependencies to maintain
- More sophisticated extraction than text-only parsing

**Implementation:**
```typescript
// In /lib/google-drive.ts
// Return PDF as base64 - Claude handles it directly
if (mimeType === 'application/pdf') {
  return { content: base64Content, contentType: 'pdf' };
}
```

---

### AD-2: Cost Curve Analysis Algorithm

**Decision:** Dynamically detect penalty structure by sampling costs instead of hardcoding assumptions.

**Context:**
- Original code assumed specific OTIF/dwell time rules
- Different contracts have different penalty structures
- Strategy thresholds were wrong for non-Walmart contracts

**Why This Approach:**
```
Before: Hardcoded OTIF/dwell assumptions
After:  Sample costs every 15 min → detect penalty structure → set thresholds
```

**Algorithm:**
1. Calculate actual arrival time (`origMins + delayMinutes`)
2. Sample costs every 15 minutes for 6 hours after arrival
3. Analyze the cost curve to detect:
   - Flat zones (no penalty increase)
   - Step jumps (sudden $100+ increases)
   - Linear growth (gradual increases)
4. Set thresholds dynamically based on detected structure

**Key Achievement:** System is now truly GENERIC - works with any contract penalty structure without hardcoded assumptions.

**Files:** `/lib/negotiation-strategy.ts` - `analyzeCostCurve()` function

---

### AD-3: Modular Architecture (Hooks + Utilities)

**Decision:** Completely separate business logic from UI presentation.

**Context:**
- Two UI variants needed (`/dispatch` and `/dispatch-2`)
- Bug fixes were being made in one place but not the other
- Risk of inconsistent behavior between pages

**Why This Approach:**
```
Before Modularization:
/app/dispatch/page.tsx        ❌ Change here
/app/dispatch-2/page.tsx      ❌ AND here
(Risk: Forget one = inconsistent behavior)

After Modularization:
/lib/text-mode-handlers.ts    ✅ Change ONCE
Both pages automatically updated!
```

**Structure:**
| Layer | Location | Purpose |
|-------|----------|---------|
| Hooks | `/hooks/` | Reusable state logic |
| Utilities | `/lib/` | Pure functions |
| Types | `/types/` | Shared interfaces |
| APIs | `/app/api/` | Backend endpoints |
| Components | `/components/dispatch*/` | UI only (2 variants) |

**Benefit:** Fix bugs once, both UI variants updated automatically.

---

### AD-4: Google Drive Service Account Auth

**Decision:** Use service account authentication (server-side) instead of OAuth flow.

**Context:**
- Need to fetch contracts from Google Drive
- OAuth would require user login flow
- Contracts are in a shared company folder

**Why This Approach:**
- Server-side only - no client credentials exposed
- No user interaction required
- Works with shared folders
- Simpler implementation

**Files:** `/lib/google-drive.ts`

---

### AD-5: No Database (Stateless)

**Decision:** Keep the application stateless with no database.

**Context:**
- Initial design consideration for storing contracts/agreements

**Why This Approach:**
- Contracts fetched fresh from Google Drive each time
- Agreements saved to Google Sheets (external storage)
- Simpler deployment (no DB provisioning)
- No stale data issues

**Trade-off:** ~30-40 seconds to analyze contract on each workflow start.

---

### AD-6: Walmart as Fallback Retailer

**Decision:** Use 'Walmart' as the fallback party name until contract extraction provides the real value.

**Context:**
- Removed hardcoded retailer dropdown in Phase 7.5
- Cost engine still needs a retailer for legacy `DEFAULT_CONTRACT_RULES`

**Why 'Walmart':**
- Most comprehensive penalty structure in `DEFAULT_CONTRACT_RULES`
- Conservative approach - won't under-estimate costs
- Replaced by actual extracted party name when contract analysis succeeds

**Files:** Multiple - search for `// Fallback - will be replaced by extracted party`

---

### AD-7: Server-Side Pushback Tracking

**Decision:** Track pushback count on the server using call ID, not in VAPI's LLM context.

**Context:**
- $100 emergency fee feature requires knowing if this is the 1st or 2nd pushback
- Initial plan was to have VAPI track the count via system prompt instructions
- VAPI's LLM cannot reliably maintain counters between tool calls

**Why This Approach:**
- LLMs don't maintain true state - each tool call is processed independently
- Server-side tracking guarantees accurate count
- Call ID from VAPI payload uniquely identifies each conversation
- In-memory Map with TTL cleanup (1 hour) handles normal call durations

**Implementation:**
```typescript
// /lib/pushback-tracker.ts
const pushbackStore = new Map<string, PushbackState>();

export function getPushbackCount(callId: string): number { ... }
export function incrementPushbackCount(callId: string): number { ... }
export function extractCallId(webhookBody: Record<string, unknown>): string | null { ... }
```

**Trade-off:** In-memory storage means counts are lost on server restart. For production, consider Redis or similar persistent store.

**Files:** `/lib/pushback-tracker.ts`, `/app/api/tools/check-slot-cost/route.ts`

---

### AD-8: Simulated Hold via VAPI Mute Controls

**Decision:** Use VAPI's mute controls to simulate call hold rather than actual telephony hold or ending/restarting calls.

**Context:**
- Phase 12 requires putting warehouse call "on hold" while confirming with driver
- VAPI SDK does not support native call hold, transfer, or conference features
- Options considered: (A) Sequential calls, (B) Simulated hold via mute, (C) External IVR system

**Why This Approach:**
- VAPI provides `setMuted(true/false)` for user microphone
- VAPI provides `send({type: 'control', control: 'mute-assistant'})` for assistant audio
- Combining both creates effective "hold" - warehouse hears silence, can't speak
- More professional than ending/restarting calls
- Simpler than external IVR integration

**Implementation:**
```typescript
// Put on hold
vapiClient.setMuted(true);  // Mute user mic
vapiClient.send({ type: 'control', control: 'mute-assistant' });  // Mute assistant

// Resume from hold
vapiClient.setMuted(false);
vapiClient.send({ type: 'control', control: 'unmute-assistant' });
```

**Trade-off:** Warehouse hears complete silence during hold (no hold music). Acceptable for short confirmation calls (<60 seconds).

**Files:** `/hooks/useWarehouseHold.ts`

---

### AD-9: Sequential Calls for Driver Confirmation (Updated)

**Decision:** End the warehouse call completely before starting the driver confirmation call.

**Context:**
- Need to confirm with driver before finalizing warehouse agreement
- Original plan was to "hold" warehouse call (mute) while calling driver
- **VAPI/Daily.co does NOT support concurrent browser calls** - only one WebRTC connection per browser session
- The `allowMultipleCallInstances` option is not a valid VAPI parameter (caused 400 Bad Request)

**Why Sequential Approach:**
- Browser can only maintain one active WebRTC/audio connection
- Muting the warehouse call doesn't free the underlying connection
- Attempting to start a second VAPI call fails with 400 error
- The "hold" pattern doesn't work with VAPI's architecture

**Revised Flow:**
1. Mike says "Let me confirm with my driver - one moment"
2. Warehouse call is **ENDED** completely (not just muted)
3. Driver confirmation call is started
4. Result is shown in UI (no callback to warehouse needed)

**Implementation:**
```typescript
// End warehouse call to free browser audio connection
vapiClientRef.current.stop();

// Wait for connection to close
setTimeout(() => {
  // Start driver call with fresh VAPI instance
  driverClient.start(DRIVER_ASSISTANT_ID, { variableValues });
}, 1500);
```

**Tradeoff:** We lose the "return to warehouse" multi-party coordination feel, but the functionality works reliably. If callback to warehouse is needed, a NEW call would need to be initiated after driver confirmation.

**Files:** `/app/dispatch/page.tsx`

---

### AD-10: 60-Second Driver Call Timeout

**Decision:** Timeout driver call after 60 seconds if no confirmation/rejection received.

**Context:**
- Driver may not answer or may not give clear confirmation
- Warehouse is waiting on hold during this time
- Need a maximum hold duration for reasonable UX

**Why 60 Seconds:**
- Long enough for driver to answer and respond
- Short enough to not frustrate warehouse manager
- Includes ~10 seconds for call connection + ~50 seconds for conversation

**Timeout Behavior:**
1. Start 60-second timer when driver call begins
2. Timer cancelled if driver confirms or rejects
3. If timer expires: treat as rejection, return to warehouse with failure message

**Files:** `/hooks/useDriverCall.ts`

---

### AD-11: Failure on Driver Rejection (No Renegotiation)

**Decision:** If driver rejects the proposed time, end the workflow with failure status rather than renegotiating.

**Context:**
- Driver says they cannot make the proposed time
- Options: (A) Renegotiate with warehouse, (B) End with failure

**Why End with Failure:**
- Keeps prototype simple - avoids complex renegotiation loop
- Warehouse manager's patience is limited (already on hold)
- Manual intervention may be needed if driver has constraints
- Can be enhanced in future versions to support renegotiation

**Failure Flow:**
1. Driver rejects → End driver call
2. Unmute warehouse call
3. Mike says: "I apologize, but our driver won't be able to make that time. We'll need to reschedule through our main office."
4. End warehouse call gracefully
5. Save to Google Sheets with status "DRIVER_UNAVAILABLE"

**Files:** `/app/dispatch/page.tsx`

---

## Bug Fixes & Root Causes

### BUG-1: React State Closure Bug (Voice Call Auto-End)

**Symptom:** Voice call did not end automatically after collecting all information and Mike said closing phrase.

**Debug Logs Revealed:**
```
"Storing pending accepted time: 16:30 with cost: 1725" ✓
"⚠️ Got dock but no pending time! offeredDock: 1, pendingAcceptedTime: null" ✗
```

**Root Cause:**
- Used `useState` for `pendingAcceptedTime`
- State updates are asynchronous - function closure captures initial value (`null`)
- When dock was extracted later, `pendingAcceptedTime` was still `null` in the closure
- `finishNegotiation()` never called → `confirmedTimeRef/confirmedDockRef` never set
- Auto-end check failed because refs were null

**Solution:** Changed from `useState` to `useRef`
- `useRef` updates synchronously - `ref.current` immediately reflects new value
- No closure issues - always reads latest value

**Fixed Flow:**
```
1. Time extracted → pendingAcceptedTimeRef.current = '16:30' ✓
2. Dock extracted → Check pendingAcceptedTimeRef.current → Has value! ✓
3. Call finishNegotiation('16:30', '1', cost) ✓
4. Set confirmedTimeRef and confirmedDockRef ✓
5. Mike says closing phrase → Auto-end check passes ✓
6. Call ends automatically! ✓
```

**Files Modified:** `/app/dispatch/page.tsx`

**Lesson:** Use `useRef` instead of `useState` for values that need to be read in async callbacks/closures where you need the latest value.

---

### BUG-2: Dispatcher Asks for Times Before Truck Arrival

**Symptom:**
- 2 PM appointment + 90 min delay = 3:30 PM actual arrival
- ❌ Dispatcher asks for 2:30 PM slot (impossible - truck arrives at 3:30 PM!)
- ❌ Strategy cards show "IDEAL: Before 14:30" (before actual arrival)

**Root Cause:** All calculations used `original_appointment` instead of `original_appointment + delay_minutes`

**Impact:**
- Strategy cards showed impossible times
- Negotiation logic asked for times before truck arrives
- Cost calculations relative to wrong baseline

**Solution:** Calculate actual arrival time and use it as baseline:
```typescript
const actualArrivalMinutes = originalAppointmentMinutes + delayMinutes;
// All thresholds now relative to actualArrivalMinutes
```

**Test Results** (2 PM + 90 mins = 3:30 PM arrival, Walmart, $50K):
- ✅ **Truck arrives banner**: Shows 15:30 (3:30 PM)
- ✅ **IDEAL**: Around 15:30-16:00 (not 14:30!)
- ✅ **OK**: Before 17:15-17:30 (before step jump)
- ✅ **BAD**: After 17:30 (when dwell charges kick in)

**Files Modified:**
- `/lib/negotiation-strategy.ts` - `analyzeCostCurve()` function
- `/hooks/useCostCalculation.ts` - Returns `actualArrivalTime`
- `/components/dispatch/StrategyPanel.tsx` - Displays arrival time

---

### BUG-3: Confirmed Time Updates on Extraction (Not Acceptance)

**Symptom:** Voice mode updated `confirmedTime` when extracting warehouse offer, not when dispatcher accepts.

**Root Cause:**
- Voice mode set confirmed time/dock immediately after extraction (lines 128-135)
- Text mode already handled this correctly (only set on `evaluation.shouldAccept`)

**Solution:**
1. Changed extraction logic to use local variables instead of setting state
2. Store `offeredTime` and `offeredDock` locally, not in confirmed state
3. Only confirmed values are set when offer is actually accepted

**Fixed Behavior:**
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
```

**Files Modified:** `/app/dispatch/page.tsx`

---

### BUG-4: Voice Call Ends Mid-Sentence

**Symptom:** Voice call ended immediately after Mike said closing phrase, not waiting for complete speech or user response.

**Requirements:**
1. Mike must completely finish speaking the closing message
2. Wait for a few seconds of silence before closing the call
3. If warehouse manager speaks during silence period, continue conversation
4. After resolving their query, Mike says another closing phrase and cycle repeats

**Solution:**

1. **Track Assistant Speech State:**
   - Added `speech-update` event listener
   - Track when assistant starts/stops speaking

2. **Wait for Speech to Finish:**
   - Added `waitingForSpeechEndRef` and `isAssistantSpeakingRef`
   - `handleAssistantSpeechStart()` - cancels silence timer
   - `handleAssistantSpeechEnd()` - starts silence timer

3. **Silence Timer Logic:**
   - `startSilenceTimer()` - 5-second countdown after speech completes
   - If user speaks during silence → timer cancelled, conversation continues
   - If silence period completes → call ends gracefully

**Flow:**
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

**Files Modified:**
- `/app/dispatch/page.tsx` - Silence timer logic, speech state tracking
- `/components/dispatch/VoiceCallInterface.tsx` - Speech state events
- `/types/vapi.ts` - Added `speech-update` to event types

---

### BUG-5: Warehouse Contact Not Saving to Sheets

**Symptom:** Warehouse manager name was not being saved to Google Sheets when call ended.

**Root Cause:** Same as BUG-1 - React state async updates. When `handleVapiCallEnd` was called, it read `workflow.warehouseManagerName` from state, but the state update hadn't been applied yet.

**Solution:**
1. Added `warehouseManagerNameRef` to `useDispatchWorkflow` hook
2. Synced ref with state in useEffect
3. Use `workflow.warehouseManagerNameRef.current` when saving to Google Sheets

**Files Modified:**
- `/hooks/useDispatchWorkflow.ts`
- `/app/dispatch/page.tsx`
- `/app/dispatch-2/page.tsx`

---

### BUG-6: VAPI Arguments as JSON String

**Symptom:** VAPI webhook tool calls showed `delayMinutes: 0, shipmentValue: 0` and time parsing failed with `parsedOfferedTime: null`.

**Debug Logs Revealed:**
```
📊 Parsed numeric params: { delayMinutes: 0, shipmentValue: 0 }
🔍 [analyzeTimeOffer] Parsed times: { originalMinutes: null, offeredMinutes: null }
❌ [analyzeTimeOffer] Time parsing failed
```

**Root Cause:**
- VAPI sends `call.function.arguments` as a **JSON string**, not a parsed object
- Code assumed it was already an object: `const args = call.function.arguments;`
- Accessing `args.delayMinutes` on a string returned `undefined`
- `Number(undefined) || 0` resulted in `0`

**Solution:** Check argument type and parse if string:
```typescript
let args: VapiToolCall['function']['arguments'];
const rawArgs = call.function.arguments;

if (typeof rawArgs === 'string') {
  args = JSON.parse(rawArgs);
} else {
  args = rawArgs || {};
}
```

**Files Modified:** `/app/api/tools/check-slot-cost/route.ts`

**Lesson:** Always check the type of VAPI webhook payloads - they may send JSON strings instead of parsed objects, even when the TypeScript types suggest otherwise.

---

### BUG-7: Incentive Not Offered (Server-Side Tracking)

**Symptom:** $100 emergency rescheduling fee was never offered even on 2nd pushback.

**Root Cause:** VAPI cannot reliably track counters internally. The system prompt instructed VAPI to track `pushbackCount`, but VAPI's LLM doesn't maintain state between tool calls.

**Solution:** Implement server-side pushback tracking:
1. Extract call ID from VAPI webhook payload
2. Store pushback count in server-side Map (keyed by call ID)
3. Increment count after each rejected offer
4. Return `shouldOfferIncentive` based on server-tracked count

**Files Created:** `/lib/pushback-tracker.ts`

**Lesson:** Don't rely on VAPI (or any LLM) to maintain counters or state. Track state server-side using a unique identifier from the request.

---

### BUG-8: Refs Not Updated After setState (Driver Confirmation)

**Symptom:** Driver confirmation flow failed with "Cannot create tentative agreement - missing time or dock" even though `finishNegotiation` was called with valid time/dock values.

**Debug Logs Revealed:**
```
🎯 finishNegotiation called: time=16:00, dock=5
✅ Confirmed time, dock, and day offset set
[Phase12] Driver confirmation enabled - initiating driver confirmation flow
[Workflow] Cannot create tentative agreement - missing time or dock {time: null, dock: null}
```

**Root Cause:**
1. `finishNegotiation` calls `workflow.setConfirmedTime(time)` - this triggers async state update
2. The `useEffect` in `useConfirmedDetails` that syncs refs to state hasn't run yet
3. `initiateDriverConfirmation()` is called immediately
4. `createTentativeAgreement()` reads from `confirmedTimeRef.current` - still `null`!

The pattern of "set state → useEffect syncs ref → callback reads ref" has a race condition when the callback is invoked synchronously after setState.

**Solution (Two-Part Fix):**

1. **Update refs synchronously in setters** (`useConfirmedDetails.ts`):
```typescript
// OLD: Refs synced via useEffect (async)
const setConfirmedTime = useCallback((time: string | null) => {
  setConfirmedTimeState(time);
}, []);
useEffect(() => {
  confirmedTimeRef.current = confirmedTime;
}, [confirmedTime]);

// NEW: Refs updated synchronously in setter FIRST
const setConfirmedTimeSync = useCallback((time: string | null) => {
  confirmedTimeRef.current = time; // Sync ref IMMEDIATELY
  setConfirmedTimeState(time);
}, []);
```

2. **Pass values as function parameters** (`page.tsx`):
```typescript
// OLD
initiateDriverConfirmation();

// NEW - pass values directly as defensive backup
initiateDriverConfirmation({ time, dock });

// In createTentativeAgreement, use overrides if provided
const createTentativeAgreement = (overrides?: { time?: string; dock?: string }) => {
  const time = overrides?.time || confirmed.confirmedTimeRef.current;
  const dock = overrides?.dock || confirmed.confirmedDockRef.current;
  // ...
};
```

**Files Modified:**
- `/hooks/useConfirmedDetails.ts` - Sync setters update refs immediately
- `/hooks/useDispatchWorkflow.ts` - `createTentativeAgreement` accepts overrides
- `/app/dispatch/page.tsx` - `initiateDriverConfirmation` passes time/dock

**Lesson:** When a pattern uses "setState → useEffect syncs ref → callback reads ref", there's a race condition if the callback runs synchronously after setState. Either:
1. Update refs synchronously in the setter (before or alongside setState)
2. Pass values explicitly to downstream functions instead of relying on refs

---

## Testing Lessons

### Validated Test Scenarios

**Test Scenario 1: Short Delay (30 mins)**
- Original: 2:00 PM, Delay: 30 mins → Arrival: 2:30 PM
- ✅ Strategy shows IDEAL: 2:30-3:00 PM
- ✅ Mike accepts offers between 2:30-3:00 PM immediately
- ✅ Mike rejects offers before 2:30 PM ("truck won't be there yet")
- ✅ Mike negotiates for earlier if offered after 4:30 PM

**Test Scenario 2: Medium Delay (90 mins)**
- Original: 2:00 PM, Delay: 90 mins → Arrival: 3:30 PM
- ✅ Strategy shows IDEAL: 3:30-4:00 PM
- ✅ Mike accepts 3:45 PM immediately (in IDEAL range)
- ✅ Mike accepts 5:00 PM after one pushback (in ACCEPTABLE range)
- ✅ Mike rejects 2:30 PM ("driver arrives at 3:30 PM")

**Test Scenario 3: Long Delay (180 mins)**
- Original: 2:00 PM, Delay: 180 mins → Arrival: 5:00 PM
- ✅ Strategy shows IDEAL: 5:00-5:30 PM
- ✅ Mike explains OTIF already missed, negotiates minimal dwell time
- ✅ Mike accepts 5:15 PM immediately
- ✅ Mike pushes back on 7:00 PM (2hr+ dwell time)

### Contract Analysis Performance

- **Extraction Time:** 30-40 seconds for 180KB PDF
- **Tokens Used:** ~25,000-30,000
- **Confidence:** HIGH (for well-structured contracts)

---

## VAPI Integration Lessons

### VAPI Events to Handle

| Event | Purpose | Notes |
|-------|---------|-------|
| `call-start` | Call connected | Initialize state |
| `call-end` | Call ended | Trigger auto-save |
| `speech-start` | User started speaking | Cancel silence timer |
| `speech-end` | User stopped speaking | - |
| `transcript` | Speech transcribed | Only use `transcriptType === 'final'` |
| `message` | Assistant message | Check for closing phrases |
| `speech-update` | Assistant speech state | Track for graceful ending |

### Trap: VAPI model-output Events

**Problem:** `model-output` events look like duplicate messages.

**Reality:**
- These are VAPI internal events showing LLM generation, not final spoken output
- Slight variations ("we'll" vs "let's") are normal LLM streaming/candidate generation
- If duplicates were actually SPOKEN, that's a VAPI-side issue

**Solution:** Only log these events, don't process them. Use `transcript` with `transcriptType === 'final'` for actual messages.

### Trap: VAPI Tool Call Arguments as JSON String

**Problem:** Tool call arguments arrive as a JSON string, causing all values to be `undefined`.

**Debug Clue:**
```
🔍 Raw arguments type: string  ← Not 'object'!
📊 Parsed numeric params: { delayMinutes: 0, shipmentValue: 0 }
```

**Solution:** Always check and parse:
```typescript
const rawArgs = call.function.arguments;
const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
```

### Trap: Relying on VAPI to Track State

**Problem:** VAPI's LLM cannot reliably maintain counters or state between tool calls.

**Reality:** Each tool call is processed independently by the LLM. Even if you instruct VAPI to "increment the counter", it may not remember the previous value.

**Solution:** Track state server-side using call ID from the webhook payload. See `/lib/pushback-tracker.ts` for implementation.

### Dynamic Variables Passed to VAPI

```javascript
{
  // Core
  original_appointment: "2 PM",           // Speech format
  original_24h: "14:00",                  // 24h format
  delay_minutes: "90",
  shipment_value: "50000",

  // Arrival calculations
  actual_arrival_time: "3:30 PM",         // When truck physically arrives
  actual_arrival_24h: "15:30",            // Arrival in 24h format

  // OTIF window
  otif_window_start: "1:30 PM",
  otif_window_end: "2:30 PM",

  // HOS (when enabled)
  hos_enabled: "true",
  hos_remaining_drive: "6 hours 30 minutes",
  hos_remaining_window: "8 hours 15 minutes",
  hos_latest_dock_time: "8:00 PM",
  hos_binding_constraint: "14-hour window"
}
```

### User Action Required After VAPI Changes

After modifying VAPI-related code:
1. Copy `VAPI_SYSTEM_PROMPT.md` content into VAPI dashboard
2. Navigate to: https://dashboard.vapi.ai → Assistants → Mike the Dispatcher → System Prompt

---

## React Patterns

### Pattern: useRef for Async Callback Values

**When to use `useRef` instead of `useState`:**
- Value is read inside async callbacks, event handlers, or closures
- Value changes frequently but doesn't need to trigger re-render
- You need synchronous access to the latest value

**Example from this codebase:**
```typescript
// ❌ WRONG - useState closure captures stale value
const [pendingTime, setPendingTime] = useState<string | null>(null);

// Later in an async callback:
if (pendingTime) { // Always null due to closure!
  finishNegotiation(pendingTime, dock);
}

// ✅ CORRECT - useRef always has latest value
const pendingTimeRef = useRef<string | null>(null);

// Later in an async callback:
if (pendingTimeRef.current) { // Has the actual latest value
  finishNegotiation(pendingTimeRef.current, dock);
}
```

### Pattern: Sync State with Ref

When you need both reactive updates (for UI) and synchronous access (for callbacks):

```typescript
const [confirmedTime, setConfirmedTime] = useState<string | null>(null);
const confirmedTimeRef = useRef<string | null>(null);

// Keep ref in sync with state
useEffect(() => {
  confirmedTimeRef.current = confirmedTime;
}, [confirmedTime]);

// UI uses state (reactive)
<div>{confirmedTime}</div>

// Callbacks use ref (synchronous)
const handleCallEnd = () => {
  if (confirmedTimeRef.current) {
    saveToSheets(confirmedTimeRef.current);
  }
};
```

---

## Mobile Responsiveness Fixes

### SetupForm.tsx
- Changed grid from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`
- Form inputs stack on mobile, side-by-side on tablet+
- Fixed `col-span-2` to `sm:col-span-2` for delay slider and retailer selection

### StrategyPanel.tsx
- Changed from `grid-cols-3 text-[10px]` to `grid-cols-1 sm:grid-cols-3 text-xs`
- Strategy cards stack vertically on mobile for better readability
- Increased font size from 10px to 12px (text-xs) for accessibility

### dispatch/page.tsx
- Changed header from `flex items-center justify-between` to `flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`
- Reduced horizontal padding from `px-6` to `px-4 sm:px-6` for better mobile margins
- Header elements stack on small screens, preventing overflow
