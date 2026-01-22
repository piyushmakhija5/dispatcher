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
- 🔄 Phase 7: Dynamic contract analysis (IN PROGRESS)

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
         │                   │                    │
         │                   │                    └─▶ Calculate costs from extracted terms
         │                   └─▶ LLM extracts structured terms
         └─▶ Google Drive API fetches latest document
```

## Environment Variables

```bash
# Required - AI
ANTHROPIC_API_KEY=sk-ant-...

# Required - VAPI Voice
NEXT_PUBLIC_VAPI_PUBLIC_KEY=pk_...
VAPI_ASSISTANT_ID=...

# Required - Google Drive (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=dispatcher@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_DRIVE_FOLDER_ID=1ABC...xyz  # Folder containing contract documents

# Optional
VAPI_WEBHOOK_SECRET=...  # For tool webhooks
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/extract` | POST | Extract time/dock from message via Claude Haiku |
| `/api/chat` | POST | General Claude conversation (Sonnet) |
| `/api/tools/check-slot-cost` | POST | VAPI webhook for cost analysis |
| `/api/contract/fetch` | POST | Fetch latest contract from Google Drive |
| `/api/contract/analyze` | POST | Analyze contract text with Claude (structured output) |

## VAPI Integration

- **Public Key:** `4a4c8edb-dbd2-4a8e-88c7-aff4839da729`
- **Assistant ID:** `fcbf6dc8-d661-4cdc-83c0-6965ca9163d3`
- **Events:** `call-start`, `call-end`, `speech-start`, `speech-end`, `message`, `error`
- **Dynamic Variables:** `original_appointment`, `delay_minutes`, `shipment_value`, `consignee` (extracted from contract)

## Directory Structure

```
dispatcher/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dispatch/
│   │   └── page.tsx
│   └── api/
│       ├── health/route.ts
│       ├── extract/route.ts
│       ├── chat/route.ts
│       ├── contract/
│       │   ├── fetch/route.ts      # Google Drive integration
│       │   └── analyze/route.ts    # LLM contract analysis
│       └── tools/
│           └── check-slot-cost/route.ts
├── components/
│   ├── dispatch/
│   │   ├── SetupForm.tsx           # No retailer dropdown (party from contract)
│   │   ├── ChatInterface.tsx
│   │   ├── VoiceCallInterface.tsx
│   │   ├── ThinkingBlock.tsx
│   │   ├── CostBreakdown.tsx
│   │   ├── StrategyPanel.tsx
│   │   ├── ContractTermsDisplay.tsx # NEW: Show extracted terms
│   │   └── FinalAgreement.tsx
│   └── ui/
│       └── (shared UI components)
├── lib/
│   ├── cost-engine.ts              # Generalized for dynamic terms
│   ├── negotiation-strategy.ts
│   ├── time-parser.ts
│   ├── anthropic-client.ts
│   ├── google-drive.ts             # NEW: Google Drive service
│   └── contract-analyzer.ts        # NEW: LLM contract extraction
├── hooks/
│   ├── useDispatchWorkflow.ts      # Updated for contract fetching stage
│   ├── useCostCalculation.ts
│   ├── useContractAnalysis.ts      # NEW: Contract analysis hook
│   └── useVapiCall.ts
├── types/
│   ├── dispatch.ts
│   ├── cost.ts                     # Updated with flexible schema
│   ├── contract.ts                 # NEW: Contract extraction types
│   └── vapi.ts
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.js
└── package.json
```

## Important Notes

1. **Contract Analysis:** Real-time LLM extraction from Google Drive documents (no caching)
2. **No Hardcoded Parties:** Shipper, carrier, consignee extracted from contract
3. **Flexible Penalties:** Schema handles arbitrary penalty structures
4. **Error Handling:** Graceful degradation with debug traces throughout
5. **Claude Models:** Haiku for fast extraction, Sonnet for contract analysis + negotiation
6. **Voice + Text:** Both modes use same extracted contract terms
7. **Validation:** LLM prompt includes self-validation before structured output
