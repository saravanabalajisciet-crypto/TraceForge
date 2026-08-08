# TraceForge AI

> A browser-native Digital Forensics & Incident Response (DFIR) learning and investigation platform — built for the PWNDORA cybersecurity training ecosystem.

---

## V1 vs V2

| | V1 (Predefined Scenarios) | V2 (Evidence-Driven) |
|---|---|---|
| Input | Curated scenario data | Any JSON/NDJSON/CSV event dataset |
| Timeline | Manual drag-and-drop | Automatically reconstructed |
| MITRE Mapping | Pre-defined per scenario | Inferred from event patterns |
| IOC Extraction | Scenario-embedded | Auto-extracted from all fields |
| AI Mentor | Socratic coaching | Dynamic context from reconstruction |
| Language | English only | English, Tamil, Hindi, Malayalam |

Both modes run side-by-side. V1 scenarios are fully preserved.

---

## Problem Statement

Traditional cybersecurity training relies on passive videos and multiple-choice quizzes. Aspiring DFIR analysts have no way to practice the core skill of an actual investigation: correlating raw evidence, reconstructing attack timelines, and mapping attacker behaviour to a structured framework — all under realistic conditions.

## Solution

TraceForge AI simulates real-world DFIR investigations in the browser. Learners analyse shuffled evidence cards drawn from Windows Event Logs, SIEM alerts, EDR data, firewall logs, and email gateways. They reconstruct attack timelines via drag-and-drop, map MITRE ATT&CK tactics, and receive objective scoring with an AI-powered mentor that guides — never solves — the investigation.

---

## Key Features

### V1 — Scenario-Based Learning

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
| 🔄 **Offline Mentor Fallback** | Rule-based guidance activates silently when Gemini is unavailable |

### V2 — Evidence-Driven Investigation

| Feature | Description |
|---|---|
| 📤 **Universal Event Ingestion** | Upload JSON, NDJSON, or CSV event datasets — up to 5MB |
| 🔬 **Event Normalization** | Timestamps, IPs, usernames, process names, hashes standardized automatically |
| ⏱️ **Timeline Reconstruction** | Chronological sort + entity correlation + suspicious sequence detection |
| 🕵️ **Attack Story Engine** | 10 ATT&CK stage rules infer kill-chain with confidence scores |
| 🗺️ **Dynamic MITRE Inference** | 15+ technique rules — requires ≥2 corroborating signals, never keyword-only |
| 🔎 **IOC Auto-Extraction** | 12 IOC types extracted from every event field including raw data |
| 🌐 **Multilingual Explanations** | English · தமிழ் · हिन्दी · മലയാളം — technical identifiers never translated |
| 🤖 **V2 AI Mentor** | Dynamic context from reconstruction — same Gemini + offline fallback |
| 📊 **Confidence-First UI** | Every inference has a confidence badge and supporting event count |

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
│   │   ├── investigationAnalysis.ts  # Rule-based scoring engine (V1)
│   │   ├── utils.ts
│   │   └── v2/                       # V2 engines (all pure TypeScript)
│   │       ├── eventIngestion.ts         # Parse JSON/NDJSON/CSV → SecurityEvent[]
│   │       ├── eventNormalization.ts     # Normalize all fields, detect severity
│   │       ├── timelineReconstruction.ts # Sort + correlate + detect patterns
│   │       ├── attackStory.ts            # Infer ATT&CK stages with confidence
│   │       ├── mitreInference.ts         # Map events → ATT&CK techniques (≥2 signals)
│   │       ├── iocExtraction.ts          # Extract 12 IOC types from all fields
│   │       ├── explanationLocalization.ts# Translate explanations (en/ta/hi/ml)
│   │       ├── reconstructionPipeline.ts # Orchestrate all 6 engines
│   │       └── investigationStore.ts     # In-memory result store (LRU-20)
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
| `/scenarios` | Scenario library (V1) |
| `/investigation?id=shadowlock` | V1 investigation workspace |
| `/investigation?id=ghost-login` | Ghost Login investigation |
| `/investigation?id=silent-insider` | Silent Insider investigation |
| `/investigate/upload` | **V2** — Upload event dataset |
| `/investigate/[id]` | **V2** — Reconstructed investigation view |
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

## TraceForge AI V2 — Evidence-Driven Investigation

V2 transforms TraceForge from a predefined-scenario training tool into an **evidence-driven investigation platform**. Upload any security event dataset and the system automatically reconstructs the attack chain.

### V2 Demo Flow

1. Navigate to **[http://localhost:3000/investigate/upload](http://localhost:3000/investigate/upload)**
2. Drop a JSON/NDJSON/CSV event file **or** click one of the 3 built-in sample datasets
3. Review the Dataset Overview (event count, time range, hosts, users, IPs, warnings)
4. Click **Reconstruct Investigation**
5. Watch honest processing stages (Parsing → Normalizing → Correlating → Mapping → Ready)
6. Explore the V2 investigation view:
   - **Attack Chain** — inferred kill-chain stages with confidence scores
   - **Timeline** — all events sorted chronologically with suspicious event highlighting
   - **MITRE ATT&CK** — dynamically inferred technique mappings with evidence links
   - **IOCs** — extracted indicators grouped by type with event drill-down
7. Click any event → right panel shows forensic detail + AI Mentor explanation
8. Click **Ask Mentor** in the status bar for hints or a full summary
9. Switch language using the globe selector: **English | தமிழ் | हिन्दी | മലയാളം**

### V2 API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/v2/events/ingest` | Parse and validate a dataset, return overview without full reconstruction |
| `POST` | `/api/v2/investigation/reconstruct` | Run full pipeline, return `ReconstructionResult` |
| `GET` | `/api/v2/investigation/:id` | Retrieve a stored reconstruction by dataset ID |
| `POST` | `/api/v2/investigation/:id/explain` | AI Mentor explanation for any V2 action |
| `POST` | `/api/v2/investigation/:id/translate` | Translate explanation text to Tamil/Hindi/Malayalam |

### V2 Event Schema

The ingestion engine accepts flexible JSON. Minimum required field: a timestamp.

```json
[
  {
    "timestamp": "2026-01-15T08:01:04Z",
    "event": "failed_login",
    "source_ip": "203.0.113.45",
    "user": "admin",
    "hostname": "vpn-gw-01"
  }
]
```

Supported timestamp formats: ISO-8601, Unix seconds (10 digits), Unix milliseconds (13 digits), natural date strings.

Field auto-detection supports 12 timestamp aliases, 9 IP aliases, 8 user aliases, and more — see `src/lib/v2/eventIngestion.ts`.

### V2 Sample Datasets

Three synthetic datasets are included in `public/sample-datasets/`:

| Dataset | Attack Type | Events |
|---|---|---|
| `brute-force.json` | SSH Brute Force → Lateral Movement | 23 |
| `ransomware.json` | Phishing → Ransomware Deployment | 18 |
| `insider-threat.json` | Insider Data Exfiltration | 17 |

All datasets are **synthetic** — no real threat data, all IPs/usernames/hostnames are fictional.

### Multilingual Architecture

The language layer translates **explanations only** — never raw evidence values.

**Never translated:** MITRE technique IDs, IP addresses, file hashes, domain names, timestamps, event IDs

**Translated:** Incident summary, stage reasoning, MITRE explanations, mentor guidance, recommendations

If Gemini is unavailable, English text is returned with an inline note in the target language.

---

## Future Scope

- [ ] MITRE ATT&CK tactic assignment per evidence card (interactive)
- [ ] Causal link builder (directed graph between evidence cards)
- [ ] PDF export of incident reports
- [ ] User authentication and progress persistence (PWNDORA SSO)
- [ ] Community scenario sharing
- [ ] Live SOC simulation mode (real-time event streaming)
- [ ] Mobile-responsive layout
- [ ] PCAP / Zeek log ingestion
- [ ] STIX/TAXII threat intelligence integration
- [ ] Additional V1 scenario types: APT, Supply Chain, Phishing

---
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
