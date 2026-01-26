# Dispatcher AI

> AI-powered dispatch management system for truck delay negotiation with warehouse managers.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Architecture](#architecture)
3. [Workflow](#workflow)
4. [Core Concepts](#core-concepts)
   - [Contract Analysis](#contract-analysis)
   - [Negotiation Strategy](#negotiation-strategy)
   - [Hours of Service (HOS)](#hours-of-service-hos)
   - [$100 Emergency Rescheduling Fee](#100-emergency-rescheduling-fee)
   - [Driver Confirmation Coordination](#driver-confirmation-coordination-phase-12)
5. [Tech Stack](#tech-stack)
6. [Directory Structure](#directory-structure)
7. [API Reference](#api-reference)
8. [Environment Variables](#environment-variables)
9. [VAPI Integration](#vapi-integration)

**Related Documents:**
- [PROGRESS.md](./PROGRESS.md) - Development progress and phase details
- [DECISIONS.md](./DECISIONS.md) - Architectural decisions, bug fixes, and traps to avoid

---

## Quick Reference

| Item | Value |
|------|-------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| AI Models | Claude Sonnet (analysis, negotiation), Claude Haiku (extraction) |
| Voice | VAPI Web SDK |
| Documents | Google Drive API (service account) |
| UI Variants | `/dispatch` (original), `/dispatch-2` (Carbon theme) |

**Key Commands:**
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run test         # Run test scripts (see /tests/)
```

---

## Architecture

### High-Level Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Setup     │ ──▶ │  Contract   │ ──▶ │    Cost     │ ──▶ │ Negotiation │
│   Form      │     │  Analysis   │     │   Engine    │     │   (Chat/    │
│             │     │  (Claude)   │     │             │     │    Voice)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │                   │
                           ▼                   ▼                   ▼
                    Google Drive        Dynamic Rules      VAPI WebRTC
                    (PDF/Docs)          from Contract      or Text Chat
```

### Contract Analysis Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ User triggers   │ ──▶ │ Fetch latest doc │ ──▶ │ Extract text from   │
│ workflow        │     │ from GDrive      │     │ PDF/Google Doc      │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Use structured  │ ◀── │ Validate & check │ ◀── │ Claude analyzes     │
│ terms for costs │     │ extraction       │     │ with structured     │
└─────────────────┘     └──────────────────┘     │ output schema       │
                                                  └─────────────────────┘
```

### Modular Design Principle

Business logic is **completely separated** from UI presentation:

| Layer | Location | Purpose |
|-------|----------|---------|
| Hooks | `/hooks/` | Reusable state logic |
| Utilities | `/lib/` | Pure functions |
| Types | `/types/` | Shared interfaces |
| APIs | `/app/api/` | Backend endpoints |
| Components | `/components/dispatch*/` | UI only (2 variants) |

**Benefit:** Fix bugs once, both UI variants updated automatically.

---

## Workflow

### Stages

```
setup → fetching_contract → analyzing_contract → computing_impact → negotiating → complete
```

| Stage | Description |
|-------|-------------|
| `setup` | User enters delay info, shipment value, HOS status |
| `fetching_contract` | Fetch latest contract from Google Drive |
| `analyzing_contract` | Claude extracts structured terms from document |
| `computing_impact` | Calculate costs using extracted rules |
| `negotiating` | Text chat or voice call with warehouse |
| `complete` | Agreement finalized, saved to Google Sheets |

### Auto-Save on Completion

When voice call ends successfully:
- Schedule saved to Google Sheets automatically
- Data includes: timestamps, confirmed time/dock, cost impact, contact name, status

---

## Core Concepts

### Contract Analysis

Contracts are **dynamically analyzed** using Claude with structured outputs. No hardcoded rules.

<details>
<summary><strong>ExtractedContractTerms Schema</strong></summary>

```typescript
interface ExtractedContractTerms {
  // Parties identified from document
  parties: {
    shipper?: string;
    carrier?: string;
    consignee?: string;
    warehouse?: string;
  };

  // Compliance windows (OTIF or equivalent)
  complianceWindows?: {
    name: string;           // e.g., "OTIF", "Delivery Window"
    windowMinutes: number;
    description?: string;
  }[];

  // Delay penalties (dwell time, detention)
  delayPenalties?: {
    name: string;
    freeTimeMinutes: number;
    tiers: {
      fromMinutes: number;
      toMinutes: number | null;
      ratePerHour: number;
    }[];
  }[];

  // Party-specific penalties
  partyPenalties?: {
    partyName: string;
    penaltyType: string;
    percentage?: number;
    flatFee?: number;
    perOccurrence?: number;
    conditions?: string;
  }[];

  // Catch-all for other terms
  otherTerms?: {
    name: string;
    description: string;
    financialImpact?: string;
  }[];

  // Extraction metadata
  _meta: {
    documentName: string;
    extractedAt: string;
    confidence: 'high' | 'medium' | 'low';
    warnings?: string[];
  };
}
```

</details>

### Negotiation Strategy

Strategy thresholds are **calculated dynamically** from extracted contract terms:

| Threshold | Description |
|-----------|-------------|
| **IDEAL** | Within compliance window, minimal cost |
| **ACCEPTABLE** | Manageable cost increase, before major penalties |
| **SUBOPTIMAL** | Push back if cost too high (max 2 attempts) |
| **UNACCEPTABLE** | Accept reluctantly after exhausting pushbacks |

### Hours of Service (HOS)

FMCSA Hours of Service (49 CFR Part 395) constraints for **driver availability feasibility**.

<details>
<summary><strong>HOS Constraints</strong></summary>

| Clock | Limit | Description |
|-------|-------|-------------|
| **Driving Clock** | 11 hours max | Total driving time in shift |
| **On-Duty Window** | 14 hours | Non-pausable, dock wait counts |
| **Break Clock** | 30-min after 8h | Required break before more driving |
| **Weekly Clock** | 60h/7d or 70h/8d | Rolling on-duty limit |

**Key Insight:** The 14-hour window is the critical constraint because:
- It's a hard deadline - driver cannot legally drive after expiration
- Dock wait time counts toward this window
- It's non-pausable (except split sleeper)

</details>

<details>
<summary><strong>HOS Input Model</strong></summary>

```typescript
interface DriverHOSStatus {
  remainingDriveMinutes: number;       // Out of 660 (11 hours)
  remainingWindowMinutes: number;      // Out of 840 (14 hours) - KEY
  remainingWeeklyMinutes: number;      // Out of 3600/4200
  minutesSinceLastBreak: number;       // Since last 30-min break
  config: {
    weekRule: '60_in_7' | '70_in_8';
    shortHaulExempt: boolean;
  };
}
```

**Presets:**
| Preset | Drive Time | Window Time |
|--------|------------|-------------|
| Fresh Shift | 11h | 14h |
| Mid-Shift | 6h | 8h |
| End of Shift | 2h | 3h |

</details>

<details>
<summary><strong>HOS + Strategy Integration</strong></summary>

The negotiation strategy applies an **HOS ceiling** to cost-based thresholds:

```typescript
// IDEAL cannot exceed HOS feasible time
thresholds.ideal.maxMinutes = Math.min(costBasedIdeal, hosConstraints.latestFeasibleTimeMinutes);

// ACCEPTABLE cannot exceed HOS feasible time
thresholds.acceptable.maxMinutes = Math.min(costBasedAcceptable, hosConstraints.latestFeasibleTimeMinutes);
```

</details>

### $100 Emergency Rescheduling Fee

Voice mode (VAPI) feature for offering a $100 incentive to warehouses on the 2nd pushback when cost savings justify it.

<details>
<summary><strong>Pushback Flow</strong></summary>

| Pushback # | Action |
|------------|--------|
| 1st | Standard counter-offer (no money) |
| 2nd (savings >= $200) | Offer $100 emergency fee |
| 2nd (savings < $200) | Standard pushback |
| After 2 | Must accept next offer |

**Script when offering $100:**
> "Look, I understand scheduling is tight. What if we authorized a $100 emergency rescheduling fee to help make this work? Would that open up anything closer to [suggestedCounterOffer]?"

</details>

<details>
<summary><strong>Server-Side Pushback Tracking</strong></summary>

VAPI cannot reliably track counters, so pushback count is tracked server-side by call ID:

```typescript
// /lib/pushback-tracker.ts
const pushbackStore = new Map<string, PushbackState>();

// Get current count for a call
getPushbackCount(callId: string): number

// Increment after rejected offer
incrementPushbackCount(callId: string): number

// Extract call ID from VAPI webhook payload
extractCallId(webhookBody: Record<string, unknown>): string | null
```

**Tool Response Fields:**
- `shouldOfferIncentive`: `true` if savings justify $100 fee
- `incentiveAmount`: Always `100`
- `potentialSavings`: How much we'd save if warehouse accepts counter-offer

</details>

---

### Driver Confirmation Coordination (Phase 12)

Coordination feature: after reaching tentative agreement with warehouse, confirm with driver before finalizing.

**Important:** VAPI/Daily.co does NOT support concurrent browser calls. We use sequential calls, not simulated hold.

<details>
<summary><strong>Coordination Flow (Sequential Calls)</strong></summary>

```
┌─────────────────────────────────────────────────────────────────┐
│ WAREHOUSE CALL ACTIVE                                           │
│ Mike negotiates time + dock with warehouse manager              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ TENTATIVE AGREEMENT REACHED                                     │
│ Time: 15:30, Dock: B5                                          │
│ Mike: "Let me confirm with my driver - one moment."            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ END WAREHOUSE CALL                                              │
│ vapiClient.stop() - releases browser audio connection          │
│ UI shows "Confirming with driver..." status                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ START DRIVER CALL (Fresh VAPI Instance)                        │
│ Assistant: "Driver Mike" - confirms delivery details           │
│ 60-second timeout for driver response                          │
└─────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       Driver Confirms            Driver Rejects/Timeout
              │                           │
              ▼                           ▼
       Save as DRIVER_CONFIRMED    Save as DRIVER_UNAVAILABLE
       Show success in UI          Show failure in UI
```

</details>

<details>
<summary><strong>Why Sequential Calls (Not Hold)</strong></summary>

**Original Plan:** Keep warehouse call on "hold" (muted) while calling driver.

**Reality:** VAPI/Daily.co doesn't support concurrent browser WebRTC connections.
- `allowMultipleCallInstances` is NOT a valid VAPI option (causes 400 error)
- Browser can only maintain one active audio/WebRTC connection
- Muting doesn't free the underlying connection

**Solution:** End warehouse call completely, start driver call fresh.
- Clean separation of calls
- No complex state management
- Result shown in UI (no callback to warehouse needed)

</details>

<details>
<summary><strong>Sequential VAPI Calls</strong></summary>

```typescript
// 1. End warehouse call to free browser audio connection
vapiClientRef.current.stop();

// 2. Wait for connection to close
setTimeout(() => {
  // 3. Start driver call with fresh VAPI instance
  const driverClient = new VapiClass(publicKey);
  driverClient.start(DRIVER_ASSISTANT_ID, {
    variableValues: driverVariables,
  });
}, 1500);
```

**Why this works:** Browser mic can only feed one call. By ending warehouse call first, the driver call gets exclusive mic access.

</details>

<details>
<summary><strong>Conversation Phases</strong></summary>

| Phase | Description |
|-------|-------------|
| `putting_on_hold` | Mike says "let me confirm" message |
| `warehouse_on_hold` | Warehouse call ended, starting driver call |
| `driver_call_connecting` | Connecting to driver |
| `driver_call_active` | Speaking with driver |
| `final_confirmation` | Driver confirmed, showing success |
| `driver_failed` | Driver rejected/timeout, showing failure |

</details>

<details>
<summary><strong>Failure Handling</strong></summary>

If driver rejects or timeout expires:
1. End driver call
2. Save to Google Sheets with status `DRIVER_UNAVAILABLE`
3. Show failure in UI

No callback to warehouse - workflow ends with failure shown in UI.

</details>

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | Claude Sonnet + Haiku |
| Voice | VAPI Web SDK |
| Documents | Google Drive API |
| Spreadsheets | Google Sheets API |
| Database | None (stateless) |

---

## Directory Structure

```
dispatcher/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dispatch/page.tsx           # Original styled UI
│   ├── dispatch-2/page.tsx         # Carbon styled UI
│   └── api/
│       ├── health/route.ts
│       ├── extract/route.ts        # Claude Haiku extraction
│       ├── chat/route.ts           # Claude Sonnet chat
│       ├── contract/
│       │   ├── fetch/route.ts      # Google Drive
│       │   └── analyze/route.ts    # Contract analysis
│       ├── schedule/
│       │   └── save/route.ts       # Google Sheets
│       └── tools/
│           └── check-slot-cost/route.ts  # VAPI webhook
│
├── components/
│   ├── dispatch/                   # Original theme
│   │   ├── SetupForm.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── ThinkingBlock.tsx
│   │   ├── StrategyPanel.tsx
│   │   ├── FinalAgreement.tsx
│   │   └── ContractTermsDisplay.tsx
│   └── dispatch-carbon/            # Carbon theme (same props)
│
├── hooks/
│   ├── useDispatchWorkflow.ts      # Core workflow state machine
│   ├── useProgressiveDisclosure.ts # UI reveal logic
│   ├── useVapiIntegration.ts       # VAPI SDK integration
│   ├── useVapiCall.ts
│   ├── useAutoEndCall.ts
│   ├── useCostCalculation.ts
│   ├── useDriverCall.ts            # Driver call management (Phase 12)
│   └── useWarehouseHold.ts         # Hold state management (Phase 12)
│
├── lib/
│   ├── cost-engine.ts              # Cost calculations
│   ├── negotiation-strategy.ts     # Strategy thresholds
│   ├── hos-engine.ts               # HOS feasibility
│   ├── vapi-offer-analyzer.ts      # VAPI webhook decision engine
│   ├── pushback-tracker.ts         # Server-side pushback count tracking
│   ├── message-extractors.ts       # Parse time/dock
│   ├── text-mode-handlers.ts       # Conversation flow
│   ├── time-parser.ts
│   ├── anthropic-client.ts
│   ├── google-drive.ts
│   ├── contract-analyzer.ts
│   └── themes/carbon.ts
│
├── types/
│   ├── dispatch.ts
│   ├── cost.ts
│   ├── contract.ts
│   ├── hos.ts
│   └── vapi.ts
│
├── tests/
│   ├── README.md
│   ├── test-contract-flow.sh
│   ├── test-edge-cases.sh
│   ├── test-e2e-workflow.sh
│   └── test-cost-engine-with-terms.ts
│
├── .env.local
├── .env.example
├── CLAUDE.md                       # This file
└── PROGRESS.md                     # Development progress
```

---

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/extract` | POST | Extract time/dock from message (Haiku) |
| `/api/chat` | POST | General Claude conversation (Sonnet) |
| `/api/contract/fetch` | GET/POST | Google Drive connection / fetch contract |
| `/api/contract/analyze` | GET/POST | Health check / analyze contract |
| `/api/schedule/save` | GET/POST | Health check / save to Google Sheets |
| `/api/tools/check-slot-cost` | POST | VAPI webhook for cost analysis |

---

## Environment Variables

```bash
# Required - AI
ANTHROPIC_API_KEY=sk-ant-...

# Required - VAPI Voice (Warehouse Manager)
NEXT_PUBLIC_VAPI_PUBLIC_KEY=pk_...
VAPI_ASSISTANT_ID=...

# Required - VAPI Voice (Driver Confirmation) - Phase 12
NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID=...

# Required - Google Drive & Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=dispatcher@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_DRIVE_FOLDER_ID=1ABC...xyz

# Optional
GOOGLE_SHEETS_SCHEDULE_NAME="Dispatcher Schedule"
VAPI_WEBHOOK_SECRET=...
```

---

## VAPI Integration

### Warehouse Manager Assistant (Mike)

| Setting | Value |
|---------|-------|
| Public Key | `4a4c8edb-dbd2-4a8e-88c7-aff4839da729` |
| Assistant ID | `fcbf6dc8-d661-4cdc-83c0-6965ca9163d3` |
| System Prompt | `VAPI_SYSTEM_PROMPT.md` |
| Events | `call-start`, `call-end`, `speech-start`, `speech-end`, `message`, `error` |

### Driver Confirmation Assistant (Phase 12)

| Setting | Value |
|---------|-------|
| Assistant ID | Set via `NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID` |
| System Prompt | `VAPI_DRIVER_SYSTEM_PROMPT.md` |
| Purpose | Quick yes/no confirmation with driver |
| Duration | 30-60 seconds max |
| Tools | None (simple confirmation) |

<details>
<summary><strong>Dynamic Variables Passed to VAPI</strong></summary>

```javascript
{
  // Core
  original_appointment: "2 PM",
  delay_minutes: "90",
  shipment_value: "50000",

  // Arrival calculations
  actual_arrival_time: "3:30 PM",
  actual_arrival_24h: "15:30",

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

</details>

<details>
<summary><strong>Driver Assistant Dynamic Variables (Phase 12)</strong></summary>

```javascript
{
  // Proposed rescheduled time (from warehouse agreement)
  proposed_time: "3:30 PM",
  proposed_time_24h: "15:30",

  // Dock assignment
  proposed_dock: "B5",

  // Context
  warehouse_name: "Sarah",  // Warehouse contact name if captured
  original_appointment: "2 PM"
}
```

</details>

---

## Important Notes

1. **No Hardcoded Parties** - Shipper, carrier, consignee extracted from contract
2. **Flexible Penalties** - Schema handles arbitrary penalty structures
3. **Graceful Degradation** - Falls back to default rules if extraction fails
4. **Native PDF Support** - Claude processes PDFs directly (no external parsing)
5. **HOS as Ceiling** - HOS constraints cap cost-based thresholds
6. **Auto-Save** - Agreements saved to Google Sheets on voice call completion

---

## Traps to Avoid

See [DECISIONS.md](./DECISIONS.md) for detailed explanations. Quick reference:

| Trap | Solution |
|------|----------|
| React state in async callbacks | Use `useRef` for values needed in closures |
| Times before truck arrival | Use `actualArrival = original + delay` as baseline |
| Confirmed time on extraction | Only set confirmed state when `shouldAccept: true` |
| VAPI model-output events | Ignore - these are internal LLM events, not spoken output |
| Hardcoded OTIF assumptions | Use cost curve analysis to detect penalty structure |
| Silence timer too short | Wait for `speech-end` event THEN start silence timer |
| VAPI arguments as JSON string | Parse `call.function.arguments` if it's a string, not object |
| VAPI state tracking | Track counters/state server-side by call ID, not in VAPI LLM |
| VAPI concurrent calls | VAPI doesn't support concurrent browser calls; END first call completely before starting second |
