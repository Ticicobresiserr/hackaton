# FlowPilot — Hackathon Context Dump

## What We're Building

**FlowPilot** — an AI-powered platform that turns any codebase into an intelligent onboarding agent for end users. Upload your repo, our AI (Opus 4.6 with Extended Thinking) reads every file, detects critical user flows, and generates a step-by-step onboarding program. Then an onboarding chat agent (Sonnet 4.6) guides end users through those flows in real-time.

## The Problem

- 90% of users churn if they don't understand value within the first week
- 60-70% of all SaaS churn happens in the first 90 days
- Average SaaS CAC: $650-$1,100 — wasted when users abandon
- Existing solutions (WalkMe $79k-$405k/yr, Whatfix, Pendo) require manual configuration that breaks on every release
- New AI players (Quarterzip, Cor/Obi) use screen observation or training videos — none read source code

## Our Differentiator

We're the ONLY tool that uses source code as the input. We know every route, form field, permission, and business rule. Zero manual setup. Auto-updates on new releases.

## Market

- DAP market: $1.18B (2025) → $4.81B by 2033
- Customer onboarding software: $2.1B → $5.4B by 2033
- SAP acquired WalkMe in 2024

## Competitors

| Company | Approach | Funding |
|---------|----------|---------|
| WalkMe | Manual tooltips/overlays | Acquired by SAP |
| Whatfix | Manual flow builders | $125M Series E |
| Pendo | Analytics + in-app guides | Major DAP |
| Userpilot | No-code Chrome extension builder | $299/mo+ |
| Quarterzip | Voice + screen sharing PIP | Early stage |
| Cor (Obi) | Voice + computer vision | $2M pre-seed |
| **FlowPilot (us)** | **Source code analysis** | **Hackathon** |

## Tech Stack

- **Client:** Next.js 14 (App Router) + TypeScript + Tailwind — runs on port 3000
- **Server:** Express.js — runs on port 3001
- **Demo app:** Static HTML TaskFlow app — runs on port 5173
- **AI:** Anthropic SDK — Opus 4.6 for analysis, Sonnet 4.6 for chat
- **Key primitives:** Extended Thinking (streaming), Prompt Caching, SSE streaming

## Repo Structure

```
hackathon/
├── server/
│   ├── index.js          — Express server, CORS, SSE endpoint, route mounting
│   ├── agent.js          — DevOps analysis (how to run the project)
│   ├── flowAnalyzer.js   — Opus 4.6 codebase analysis with extended thinking
│   ├── runner.js         — Install + run uploaded projects + trigger flow analysis
│   ├── store.js          — In-memory store for program + sessions
│   ├── sse.js            — SSE broadcast to clients
│   ├── portDetector.js   — Detect port from stdout
│   └── routes/
│       ├── upload.js     — ZIP upload
│       ├── github.js     — GitHub clone
│       ├── control.js    — Stop/restart
│       ├── program.js    — GET/POST program, chat refinement, publish
│       └── onboard.js    — Onboarding chat, sessions
├── client/src/
│   ├── app/
│   │   ├── page.tsx      — Landing: hero + upload + thinking panel
│   │   ├── layout.tsx    — Root layout with NavBar
│   │   ├── program/page.tsx  — Flow cards + refinement chat
│   │   ├── onboard/page.tsx  — iframe + onboarding chat
│   │   └── dashboard/page.tsx — User progress table
│   ├── components/
│   │   ├── NavBar.tsx, FlowCard.tsx, ChatPanel.tsx
│   │   ├── ThinkingPanel.tsx, StatusBadge.tsx
│   │   ├── DropZone.tsx, GitHubForm.tsx, LogPanel.tsx, ActionBar.tsx
│   └── hooks/useSSE.ts  — SSE hook (connects directly to :3001)
├── demo-app/             — TaskFlow (sample SaaS for demo)
│   ├── index.html, dashboard.html, new-project.html
│   ├── project.html, team.html, settings.html
│   └── package.json
├── SPEC.md               — Full implementation spec
└── .env                  — ANTHROPIC_API_KEY (gitignored)
```

## Demo Repo for Testing

https://github.com/andy-viera/taskflow-demo

## Current Status

- All backend APIs working (clone, analyze, program CRUD, onboarding chat)
- All 4 frontend pages built (/, /program, /onboard, /dashboard)
- Opus 4.6 analysis produces 6-7 flows with detailed steps
- Onboarding chat guides users step by step
- SSE streaming works (direct connection to :3001)
- Demo app (TaskFlow) runs on :5173
- Pushed to GitHub

## Known Issues

- The chat refinement sometimes shows JSON marker (partially fixed, needs testing)
- UI was recently redesigned — may need polish
- Chrome MCP extension won't connect in the current Claude Code session

## Team

- Person 1 (she): Frontend / repo upload
- Person 2 (Andres, the user): Agent analysis / backend
- Person 3: Product-minded

## What Needs to Happen Next

1. Read the hackathon deliverables page to understand exact requirements
2. Fix any remaining UI issues
3. Prepare the demo flow
4. Polish for presentation
