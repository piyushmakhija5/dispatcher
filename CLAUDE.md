# Dispatcher AI - Project Context

## Overview

This is an **AI-powered dispatch management system** for handling truck delays through intelligent negotiation with warehouse managers. It combines:
- **Dynamic contract analysis** via LLM (Claude) from Google Drive documents
- Real-time cost impact analysis based on extracted contract terms
- Smart negotiation strategies
- Dual communication modes (text chat + voice calls via VAPI)
- Claude AI reasoning with visible thinking traces

## Architecture Overview

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

### Key Design Decisions

1. **Google Drive Integration**: Service account authentication (server-side)
2. **Document Selection**: Most recently modified document in pre-defined folder
3. **Party Identification**: Extracted from contract (no hardcoded retailers)
4. **Real-time Analysis**: Fresh extraction on each workflow trigger (no caching)
5. **Flexible Schema**: Handles arbitrary penalty structures with optional fields

## Current State

### Completed Phases
- ✅ Phase 1-5: Core application migrated to Next.js
- ✅ Phase 6: Negotiation logic fixes (cost curve analysis)
- ✅ Phase 7.1: Architecture design (dynamic contract analysis)
- ✅ Phase 7.2: Google Drive integration (service account, document fetching)
- ✅ Phase 7.3: Contract analysis with Claude (structured outputs, PDF processing)
- ✅ Phase 7.4: Cost engine updates (dynamic penalty structures, graceful fallbacks)
- ✅ Phase 7.5: UI updates (removed hardcoded retailer dropdown, uses 'Walmart' fallback)
- ✅ Phase 7.6: Workflow integration (fetching_contract & analyzing_contract stages)
- ✅ Phase 7.7: UI updates (ContractTermsDisplay component, strategy panel indicators)
- ✅ Phase 7.8: Testing & validation (comprehensive test suite)
- ✅ Phase 8: UI redesign & modular architecture (Carbon theme, shared hooks/utils)
- 🔄 Phase 9: Production readiness (NEXT)

### Source Structure
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **AI Models:** Claude Haiku (extraction), Claude Sonnet (negotiation + contract analysis)
- **Voice:** VAPI WebRTC SDK
- **Document Source:** Google Drive API (service account)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | Claude Sonnet (contract analysis, negotiation), Claude Haiku (extraction) |
| Voice | VAPI Web SDK |
| Documents | Google Drive API (service account) |
| Database | None (stateless) |
| Deployment | Vercel/Netlify |

## Key Business Logic

### Contract Analysis (LLM-Based)

Contracts are **dynamically analyzed** using Claude with structured outputs. No hardcoded rules.

```typescript
// Extracted from actual contract document via LLM
interface ExtractedContractTerms {
  // Parties identified from document (replaces hardcoded retailers)
  parties: {
    shipper?: string;
    carrier?: string;
    consignee?: string;
    warehouse?: string;
    [key: string]: string | undefined;
  };

  // Compliance windows (OTIF or equivalent)
  complianceWindows?: {
    name: string;           // e.g., "OTIF", "Delivery Window"
    windowMinutes: number;
    description?: string;
  }[];

  // Delay penalties (dwell time, detention, etc.)
  delayPenalties?: {
    name: string;           // e.g., "Dwell Time", "Detention"
    freeTimeMinutes: number;
    tiers: {
      fromMinutes: number;
      toMinutes: number | null;
      ratePerHour: number;
    }[];
  }[];

  // Party-specific penalties (dynamic, not hardcoded)
  partyPenalties?: {
    partyName: string;      // Extracted from document
    penaltyType: string;
    percentage?: number;
    flatFee?: number;
    perOccurrence?: number;
    conditions?: string;
  }[];

  // Catch-all for other penalty types
  otherTerms?: {
    name: string;
    description: string;
    financialImpact?: string;
    rawText?: string;
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

### Negotiation Strategy
Strategy thresholds are **calculated dynamically** from extracted contract terms:
- **IDEAL:** Within compliance window, minimal cost
- **ACCEPTABLE:** Manageable cost increase, before major penalties
- **SUBOPTIMAL:** Push back if cost too high (max 2 attempts)
- **UNACCEPTABLE:** Accept reluctantly after exhausting pushbacks

### Workflow Stages
```
setup → fetching_contract → analyzing_contract → computing_impact → negotiating → complete
         │                   │                    │                   │
         │                   │                    │                   └─▶ Voice call ends → Auto-save to Google Sheets
         │                   │                    └─▶ Calculate costs from extracted terms
         │                   └─▶ LLM extracts structured terms
         └─▶ Google Drive API fetches latest document
```

### Schedule Output (Auto-Save)
When a voice call completes successfully with confirmed scheduling details:
1. **Automatic Save**: Schedule data is automatically saved to Google Sheets
2. **Data Saved**:
   - Timestamp (ISO format)
   - Original Appointment Time
   - Confirmed Time
   - Confirmed Dock Number
   - Delay (minutes)
   - Shipment Value
   - Total Cost Impact
   - Warehouse Contact Name
   - Party Name (extracted from contract)
   - Contract File Name
   - Status (CONFIRMED/TENTATIVE/CANCELLED)
3. **Spreadsheet**: Auto-created in the same Google Drive folder if it doesn't exist
4. **UI Feedback**: Success indicator shown with link to spreadsheet

## Environment Variables

```bash
# Required - AI
ANTHROPIC_API_KEY=sk-ant-...

# Required - VAPI Voice
NEXT_PUBLIC_VAPI_PUBLIC_KEY=pk_...
VAPI_ASSISTANT_ID=...

# Required - Google Drive & Sheets (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=dispatcher@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_DRIVE_FOLDER_ID=1ABC...xyz  # Folder containing contract documents

# Optional - Google Sheets
GOOGLE_SHEETS_SCHEDULE_NAME="Dispatcher Schedule"  # Spreadsheet name for schedule output

# Optional - VAPI
VAPI_WEBHOOK_SECRET=...  # For tool webhooks
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/extract` | POST | Extract time/dock from message via Claude Haiku |
| `/api/chat` | POST | General Claude conversation (Sonnet) |
| `/api/tools/check-slot-cost` | POST | VAPI webhook for cost analysis |
| `/api/contract/fetch` | GET | Google Drive connection health check |
| `/api/contract/fetch` | POST | Fetch latest contract from Google Drive (returns base64 PDF or text) |
| `/api/contract/analyze` | GET | Contract analysis service health check |
| `/api/contract/analyze` | POST | Analyze contract with Claude structured outputs (Phase 7.3) |
| `/api/schedule/save` | GET | Google Sheets connection health check |
| `/api/schedule/save` | POST | Save finalized schedule to Google Sheets (auto-called on workflow completion) |

## VAPI Integration

- **Public Key:** `4a4c8edb-dbd2-4a8e-88c7-aff4839da729`
- **Assistant ID:** `fcbf6dc8-d661-4cdc-83c0-6965ca9163d3`
- **Events:** `call-start`, `call-end`, `speech-start`, `speech-end`, `message`, `error`
- **Dynamic Variables:** `original_appointment`, `delay_minutes`, `shipment_value`, `consignee` (extracted from contract)

## Modular Architecture (Updated 2026-01-22)

### Design Principle: Separation of Business Logic and Presentation

The codebase follows a **modular architecture** where business logic is completely separated from UI presentation. This ensures:
- **Single source of truth**: Fix bugs once, both UI variants updated
- **Easy testing**: Pure functions and isolated hooks
- **Maintainability**: Clear separation of concerns
- **Type safety**: Shared interfaces prevent inconsistencies

### Shared Business Logic Modules

#### **Hooks** (`/hooks/`) - Reusable State Logic
- `useDispatchWorkflow.ts` - Core workflow state machine, negotiation strategy, cost analysis
- `useProgressiveDisclosure.ts` - UI state machine for step-by-step reveals, loading states
- `useVapiIntegration.ts` - VAPI SDK initialization, event handling, speech detection
- `useVapiCall.ts` - Simplified VAPI call management, transcript handling
- `useAutoEndCall.ts` - Auto-end call when conversation completes
- `useCostCalculation.ts` - Cost computation utilities
- `useContractAnalysis.ts` - Contract analysis hook (Phase 7)

#### **Utilities** (`/lib/`) - Pure Functions
- `message-extractors.ts` - Extract time/dock/name from natural language
- `text-mode-handlers.ts` - Conversation flow logic (awaiting_name, negotiating_time, etc.)
- `cost-engine.ts` - Cost calculation with contract rules
- `negotiation-strategy.ts` - Strategy threshold calculation
- `time-parser.ts` - Time manipulation utilities
- `anthropic-client.ts` - Claude API client
- `google-drive.ts` - Google Drive service (Phase 7)
- `contract-analyzer.ts` - LLM contract extraction (Phase 7)

#### **Backend APIs** (`/app/api/`) - Automatically Shared
All API routes are shared between UI variants:
- `/api/health` - Health check
- `/api/extract` - Claude Haiku extraction (time/dock)
- `/api/chat` - Claude Sonnet conversation
- `/api/tools/check-slot-cost` - VAPI webhook for cost analysis
- `/api/contract/fetch` - Google Drive integration (Phase 7)
- `/api/contract/analyze` - LLM contract analysis (Phase 7)

### UI Presentation Layer

#### **Original Styled** (`/components/dispatch/`, `/app/dispatch/`)
- Purple/pink gradients, emerald success colors
- Original design system

#### **Carbon Styled** (`/components/dispatch-carbon/`, `/app/dispatch-2/`)
- Soft black (`#0a0a0a`) base, white/blue accents
- Vercel/Stripe inspired minimal design
- Same components, different styling

**Key Point**: Both `/dispatch` and `/dispatch-2` use the **exact same hooks and utilities**. Only visual components differ.

## Directory Structure

```
dispatcher/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dispatch/page.tsx           # Original styled UI
│   ├── dispatch-2/page.tsx         # Carbon styled UI
│   ├── design-preview/             # Design prototypes
│   └── api/                        # ✅ SHARED BACKEND
│       ├── health/route.ts
│       ├── extract/route.ts
│       ├── chat/route.ts
│       ├── contract/
│       │   ├── fetch/route.ts      # Google Drive integration
│       │   └── analyze/route.ts    # LLM contract analysis
│       └── tools/
│           └── check-slot-cost/route.ts
├── components/
│   ├── dispatch/                   # Original styled components
│   │   ├── SetupForm.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── ThinkingBlock.tsx
│   │   ├── StrategyPanel.tsx
│   │   ├── FinalAgreement.tsx
│   │   └── ContractTermsDisplay.tsx
│   ├── dispatch-carbon/            # Carbon styled components
│   │   ├── SetupForm.tsx           # Same props, Carbon styling
│   │   ├── ThinkingBlock.tsx
│   │   ├── StrategyPanel.tsx
│   │   ├── FinalAgreement.tsx
│   │   ├── ContractTermsDisplay.tsx
│   │   └── index.ts                # Re-exports shared components
│   └── ui/
│       └── (shared UI components)
├── hooks/                          # ✅ SHARED STATE LOGIC
│   ├── useDispatchWorkflow.ts      # Core workflow state machine
│   ├── useProgressiveDisclosure.ts # UI progressive reveal logic
│   ├── useVapiIntegration.ts       # VAPI SDK integration
│   ├── useVapiCall.ts
│   ├── useAutoEndCall.ts
│   ├── useCostCalculation.ts
│   └── useContractAnalysis.ts
├── lib/                            # ✅ SHARED UTILITIES
│   ├── message-extractors.ts      # Parse time/dock from messages
│   ├── text-mode-handlers.ts      # Conversation flow logic
│   ├── cost-engine.ts
│   ├── negotiation-strategy.ts
│   ├── time-parser.ts
│   ├── anthropic-client.ts
│   ├── google-drive.ts
│   ├── contract-analyzer.ts
│   └── themes/
│       └── carbon.ts               # Carbon design tokens
├── types/                          # ✅ SHARED TYPES
│   ├── dispatch.ts
│   ├── cost.ts
│   ├── contract.ts                 # Phase 7.3: Contract extraction types
│   └── vapi.ts
├── tests/                          # ✅ TEST SCRIPTS
│   ├── README.md                   # Testing documentation
│   ├── test-contract-flow.sh      # Basic contract analysis test
│   ├── test-edge-cases.sh         # Edge cases and validation
│   ├── test-e2e-workflow.sh       # Full end-to-end workflow
│   ├── test-cost-engine.ts        # Cost engine tests
│   └── test-cost-engine-with-terms.ts  # Cost engine with extracted terms
├── .env.local
├── .env.example
├── CLAUDE.md                       # Project documentation
├── PROGRESS.md                     # Progress tracking
├── next.config.js
├── tailwind.config.js
└── package.json
```

## Testing

### Test Scripts

Located in `/tests/` directory:

```bash
# Run all tests (recommended order)
./tests/test-contract-flow.sh      # Basic contract analysis
./tests/test-edge-cases.sh         # Edge cases and validation
./tests/test-e2e-workflow.sh       # Full end-to-end workflow

# TypeScript unit tests
npx ts-node tests/test-cost-engine-with-terms.ts
```

**Test Coverage:**
1. **test-contract-flow.sh** - Basic contract fetch + analysis
2. **test-edge-cases.sh** - Validation errors, partial extraction, custom penalties
3. **test-e2e-workflow.sh** - Complete workflow simulation
4. **test-cost-engine-with-terms.ts** - Unit tests for cost calculations

**Prerequisites:**
- Dev server running (`npm run dev`)
- `jq` installed for JSON parsing (`brew install jq`)
- Environment variables configured

**Typical Performance:**
- Extraction Time: 30-40 seconds for 180KB PDF
- Tokens Used: ~25,000-30,000
- Confidence: HIGH (for well-structured contracts)

### Manual Testing

```bash
# Test Google Drive connection
curl -s http://localhost:3000/api/contract/fetch | jq '.'

# Test contract analysis health
curl -s http://localhost:3000/api/contract/analyze | jq '.'

# Test full flow manually
curl -s -X POST http://localhost:3000/api/contract/fetch > /tmp/contract.json
cat /tmp/contract.json | jq '{content, contentType, fileName: .file.name}' | \
  curl -s -X POST http://localhost:3000/api/contract/analyze \
    -H "Content-Type: application/json" -d @- | jq '.terms'
```

See `/tests/README.md` for comprehensive documentation.

## Important Notes

1. **Contract Analysis:** Real-time LLM extraction from Google Drive documents (no caching)
2. **No Hardcoded Parties:** Shipper, carrier, consignee extracted from contract
3. **Flexible Penalties:** Schema handles arbitrary penalty structures
4. **Error Handling:** Graceful degradation with debug traces throughout
5. **Claude Models:** Haiku for fast extraction, Sonnet for contract analysis + negotiation
6. **Voice + Text:** Both modes use same extracted contract terms
7. **Validation:** LLM prompt includes self-validation before structured output
8. **Native PDF Support:** Claude processes PDFs directly (no external parsing libraries needed)
