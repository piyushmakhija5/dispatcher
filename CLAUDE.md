# Dispatcher AI - Project Context

## Overview

This is an **AI-powered dispatch management system** for handling truck delays through intelligent negotiation with warehouse managers. It combines:
- Real-time cost impact analysis
- Smart negotiation strategies
- Dual communication modes (text chat + voice calls via VAPI)
- Claude AI reasoning with visible thinking traces

## Current State (Pre-Consolidation)

### Source Folders

**1. `disptacher-workflow/` - Main Application**
- **Frontend:** React 18 + Vite (port 3000)
- **Backend:** Express.js (port 3001)
- **Main file:** `src/LiveDispatcherAgentVapi.jsx` (1,570 lines - monolithic)
- **Backend:** `server/server.js` (128 lines)
- **AI Models:** Claude Haiku (extraction), Claude Sonnet (negotiation)
- **Voice:** VAPI WebRTC SDK

**2. `tools/` - Vapi Function Tools**
- **Server:** Express.js webhook handler
- **Main file:** `check_slot_cost.js` (1,569 lines)
- **Purpose:** Webhook endpoint for VAPI function tools (cost analysis)
- **Status:** Functionality duplicated in main app, not actively used

### Critical Issues
1. **Monolithic components** - 1,500+ line files need splitting
2. **No database** - All state is in-memory (React useState)
3. **Exposed credentials** - API keys in .env committed to repo
4. **No authentication** - Endpoints completely open
5. **Hardcoded URLs** - Backend location fixed to localhost:3001
6. **No TypeScript** - Pure JavaScript, no type safety
7. **Duplicate code** - Cost calculation exists in both folders

## Tech Stack

| Component | Current | Target |
|-----------|---------|--------|
| Framework | React + Vite + Express | Next.js 14+ (App Router) |
| Language | JavaScript | TypeScript |
| Styling | Tailwind CSS | Tailwind CSS |
| AI | Claude Haiku/Sonnet via Anthropic SDK | Same |
| Voice | VAPI Web SDK | Same |
| Database | None | Supabase (optional) |
| Deployment | Local only | Vercel/Netlify |

## Key Business Logic

### Cost Calculation Engine
```typescript
// Contract rules (hardcoded)
CONTRACT_RULES = {
  dwellTime: {
    freeHours: 2,
    tiers: [
      { fromHours: 2, toHours: 4, ratePerHour: 50 },
      { fromHours: 4, toHours: 6, ratePerHour: 65 },
      { fromHours: 6, toHours: Infinity, ratePerHour: 75 }
    ]
  },
  otif: { windowMinutes: 30 },
  retailerChargebacks: {
    Walmart: { otifPercentage: 3, flatFee: 200 },
    Target: { otifPercentage: 5, flatFee: 150 },
    Amazon: { perOccurrence: 500 },
    Costco: { otifPercentage: 2, flatFee: 100 },
    Kroger: { perOccurrence: 250 }
  }
}
```

### Negotiation Strategy
- **IDEAL:** Accept if within OTIF window and $0 cost
- **ACCEPTABLE:** Accept if ≤2 hours delay and ≤$100 cost
- **SUBOPTIMAL:** Push back if cost >70% of worst-case (max 2 attempts)
- **UNACCEPTABLE:** Accept reluctantly after 2 failed pushbacks

### Workflow Stages
```
setup → analyzing → negotiating → complete → (reset)
```

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_VAPI_PUBLIC_KEY=pk_...
VAPI_ASSISTANT_ID=...

# Optional
VAPI_WEBHOOK_SECRET=...  # For tool webhooks
SUPABASE_URL=...         # If adding database
SUPABASE_ANON_KEY=...
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/extract` | POST | Extract time/dock from message via Claude Haiku |
| `/api/chat` | POST | General Claude conversation (Sonnet) |
| `/api/tools/check-slot-cost` | POST | VAPI webhook for cost analysis |

## VAPI Integration

- **Public Key:** `4a4c8edb-dbd2-4a8e-88c7-aff4839da729`
- **Assistant ID:** `fcbf6dc8-d661-4cdc-83c0-6965ca9163d3`
- **Events:** `call-start`, `call-end`, `speech-start`, `speech-end`, `message`, `error`
- **Dynamic Variables:** `original_appointment`, `delay_minutes`, `shipment_value`, `retailer`

## Target Directory Structure

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
│       └── tools/
│           └── check-slot-cost/route.ts
├── components/
│   ├── dispatch/
│   │   ├── DispatcherAgent.tsx
│   │   ├── SetupForm.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── VoiceCallInterface.tsx
│   │   ├── ThinkingBlock.tsx
│   │   ├── CostBreakdown.tsx
│   │   ├── StrategyPanel.tsx
│   │   └── FinalAgreement.tsx
│   └── ui/
│       └── (shared UI components)
├── lib/
│   ├── cost-engine.ts
│   ├── negotiation-strategy.ts
│   ├── time-parser.ts
│   ├── anthropic-client.ts
│   └── vapi-client.ts
├── hooks/
│   ├── useDispatchWorkflow.ts
│   ├── useCostCalculation.ts
│   └── useVapiCall.ts
├── types/
│   ├── dispatch.ts
│   ├── cost.ts
│   └── vapi.ts
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.js
└── package.json
```

## Important Notes

1. **VAPI SDK:** Uses CDN-loaded SDK, may need `@vapi-ai/web` npm package
2. **Claude Models:** Haiku for fast extraction, Sonnet for quality responses
3. **No OAuth needed:** This app doesn't require Twitter/social auth
4. **Deterministic costs:** Cost calculation is pure math, no AI needed
5. **Voice + Text:** Both modes should work identically
