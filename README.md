# TraceForge AI

> A browser-native Digital Forensics & Incident Response (DFIR) learning platform — built for the PWNDORA cybersecurity training ecosystem.

---

## Problem Statement

Traditional cybersecurity training relies on passive videos and multiple-choice quizzes. Aspiring DFIR analysts have no way to practice the core skill of an actual investigation: correlating raw evidence, reconstructing attack timelines, and mapping attacker behaviour to a structured framework — all under realistic conditions.

## Solution

TraceForge AI simulates real-world DFIR investigations in the browser. Learners analyse shuffled evidence cards drawn from Windows Event Logs, SIEM alerts, EDR data, firewall logs, and email gateways. They reconstruct attack timelines via drag-and-drop, map MITRE ATT&CK tactics, and receive objective scoring with an AI-powered mentor that guides — never solves — the investigation.

---

## Key Features

| Feature | Description |
|---|---|
| 🔍 **Evidence Workspace** | Shuffled, filterable evidence cards from 6 source types |
| 🕒 **Drag & Drop Timeline** | Build attack timelines by dragging evidence into chronological order |
| 📊 **Rule-based Scoring** | Timeline accuracy, MITRE coverage, IOC recognition — all computed client-side |
| 🤖 **AI Investigation Coach** | Gemini-powered mentor that asks Socratic questions, never reveals answers |
| 🗺️ **MITRE ATT&CK Mapping** | Coverage analysis across all scenario tactics and techniques |
| 🔎 **IOC Extraction** | Automatic extraction of IPs, hashes, domains, registry keys, and more |
| 📋 **Investigation Review** | Full side-by-side comparison of learner vs. master analysis |
| 📁 **Data-driven Scenarios** | New scenarios require zero code changes — add a TypeScript data file |
| 🎨 **Glassmorphism UI** | Dark-theme, terminal-inspired design built for professionals |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, TypeScript) |
| **UI** | Tailwind CSS v4, Framer Motion, Radix UI |
| **Drag & Drop** | dnd-kit (core + sortable) |
| **AI Coach** | Google Gemini 2.0 Flash (server-side API route) |
| **Icons** | Lucide React |
| **Runtime** | Node.js 20 |
| **Container** | Docker + Docker Compose |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Scenario   │  │  Evidence    │  │  Investigation       │   │
│  │  Sidebar    │  │  Workspace   │  │  Review / Scoring    │   │
│  └─────────────┘  └──────┬───────┘  └──────────────────────┘   │
│                           │ drag                                  │
│                    ┌──────▼───────┐                              │
│                    │   Timeline   │                              │
│                    │   Column     │                              │
│                    └──────────────┘                              │
└───────────────────────────────┬──────────────────────────────────┘
                                │ POST /api/coach
                    ┌───────────▼────────────┐
                    │   Next.js API Route    │
                    │   /api/coach           │
                    │   (server-side only)   │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Google Gemini API    │
                    │   gemini-1.5-flash     │
                    └────────────────────────┘
```

---

## Folder Structure

```
traceforge/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── coach/
│   │   │       └── route.ts          # Gemini API route (server-side)
│   │   ├── investigation/
│   │   │   └── page.tsx              # Investigation workspace
│   │   ├── scenarios/
│   │   │   └── page.tsx              # Scenario library
│   │   ├── report/
│   │   │   └── page.tsx              # Incident report view
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Landing page
│   │   └── globals.css
│   ├── components/
│   │   ├── features/
│   │   │   ├── coach/                # AI Coach component
│   │   │   ├── evidence/             # Evidence workspace
│   │   │   ├── investigation/        # Timeline, cards, drawer
│   │   │   ├── mitre/                # MITRE ATT&CK panel
│   │   │   ├── report/               # Report components
│   │   │   ├── review/               # Investigation review overlay
│   │   │   ├── scenario/             # Scenario sidebar
│   │   │   └── timeline/             # Timeline placeholder
│   │   └── [shared components]       # GlassCard, GradientButton, etc.
│   ├── contexts/
│   │   └── InvestigationContext.tsx  # Global investigation state
│   ├── data/
│   │   └── scenarios/
│   │       ├── index.ts              # Scenario registry
│   │       ├── shadowlock.ts         # Operation ShadowLock
│   │       ├── silent-insider.ts     # Operation Silent Insider
│   │       └── ghost-login.ts        # Operation Ghost Login
│   ├── lib/
│   │   ├── geminiCoach.ts            # Gemini prompt service (server-only)
│   │   ├── offlineCoach.ts           # Rule-based offline mentor fallback
│   │   ├── investigationAnalysis.ts  # Rule-based scoring engine
│   │   └── utils.ts
│   ├── types/
│   │   └── index.ts                  # All TypeScript types
│   └── utils/
│       └── formatters.ts
├── public/
├── Dockerfile
├── docker-compose.yml
├── next.config.ts
├── .env.example
├── ARCHITECTURE.md
└── PWNDORA_INTEGRATION.md
```

---

## Installation

### Prerequisites

- Node.js 20+
- npm 10+
- Git
- (Optional) Docker Desktop

### 1. Clone the repository

```bash
git clone https://github.com/your-org/traceforge-ai.git
cd traceforge-ai/traceforge
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

```env
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_APP_NAME=TraceForge AI
```

Get a free Gemini API key at [makersuite.google.com](https://makersuite.google.com/app/apikey).

---

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/scenarios` | Scenario library |
| `/investigation?id=shadowlock` | Investigation workspace |
| `/investigation?id=ghost-login` | Ghost Login investigation |
| `/investigation?id=silent-insider` | Silent Insider investigation |
| `/report` | Sample incident report |

---

## Running with Docker

### Prerequisites

- Docker Desktop installed and running

### 1. Set up environment

```bash
cp .env.example .env.local
# Edit .env.local with your GEMINI_API_KEY
```

### 2. Build and start

```bash
docker compose up --build
```

App will be available at [http://localhost:3000](http://localhost:3000).

### 3. Stop

```bash
docker compose down
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for the AI Coach |
| `NEXT_PUBLIC_APP_NAME` | No | App display name (default: `TraceForge AI`) |

> **Security:** `GEMINI_API_KEY` is read exclusively by the server-side API route (`/api/coach`). It is never included in the client bundle.

---

## Bundled Scenarios

| Scenario | Type | Difficulty |
|---|---|---|
| Operation ShadowLock | Ransomware | Advanced |
| Operation Silent Insider | Insider Threat | Intermediate |
| Operation Ghost Login | Credential Theft | Beginner |

### Adding a new scenario

1. Create `src/data/scenarios/your-scenario.ts` following the `ScenarioFull` TypeScript interface
2. Register it in `src/data/scenarios/index.ts`
3. No other code changes required

---

## Screenshots

> _Screenshots to be added before final submission._

| Investigation Workspace | Investigation Review | AI Coach |
|---|---|---|
| _(placeholder)_ | _(placeholder)_ | _(placeholder)_ |

---

## Future Scope

- [ ] MITRE ATT&CK tactic assignment per evidence card (interactive)
- [ ] Causal link builder (directed graph between evidence cards)
- [ ] PDF export of incident reports
- [ ] User authentication and progress persistence (PWNDORA SSO)
- [ ] Community scenario sharing
- [ ] Live SOC simulation mode (real-time event streaming)
- [ ] Mobile-responsive layout
- [ ] Additional scenario types: APT, Supply Chain, Phishing

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Built For

**PWNDORA Cybersecurity Training Platform**  
TraceForge AI was designed as a native module of the PWNDORA learning ecosystem.  
See [PWNDORA_INTEGRATION.md](PWNDORA_INTEGRATION.md) for integration details.
