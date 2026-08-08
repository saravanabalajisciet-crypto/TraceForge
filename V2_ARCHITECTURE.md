# TraceForge AI — V2 Architecture

> This document is the authoritative architecture reference for TraceForge AI V2.
> It was produced after a complete audit of the V1 codebase and defines exactly
> what is preserved, what is extended, and what is new.

---

## 1. Audit Summary — V1 Inventory

### 1.1 Engines (all in `src/lib/`)

| Engine | File | Status |
|---|---|---|
| Scoring Engine | `investigationAnalysis.ts` | ✅ Preserved as-is |
| Gemini AI Coach | `geminiCoach.ts` | ✅ Preserved, extended with new context fields |
| Offline DFIR Mentor | `offlineCoach.ts` | ✅ Preserved, extended with V2 context |
| Utility | `utils.ts` | ✅ Preserved as-is |
| Constants | `constants.ts` | ✅ Preserved, extended with V2 routes |

### 1.2 API Routes (all in `src/app/api/`)

| Route | File | Status |
|---|---|---|
| `POST /api/coach` | `coach/route.ts` | ✅ Preserved. New V2 routes added alongside |

### 1.3 Pages (all in `src/app/`)

| Page | Route | Status |
|---|---|---|
| Landing | `/` | ✅ Preserved |
| Scenarios | `/scenarios` | ✅ Preserved |
| Investigation | `/investigation` | ✅ Preserved |
| Report | `/report` | ✅ Preserved (static); V2 dynamic version at `/investigate/[id]/report` |
| **NEW** Upload | `/investigate/upload` | 🆕 V2 |
| **NEW** V2 Investigation | `/investigate/[id]` | 🆕 V2 |

### 1.4 Components Reused in V2

All V1 components are preserved. V2 adds new components under `src/components/features/v2/`.

Shared primitives (`GlassCard`, `GradientButton`, `Navbar`, `CyberBadge`, `GlassCard`) are reused as-is.

### 1.5 Scenarios

Three V1 scenarios remain fully functional:
- `op-shadow-lock` — Ransomware, Advanced
- `op-silent-insider` — Insider Threat, Intermediate
- `op-ghost-login` — Credential Theft, Beginner

V2 adds three synthetic sample datasets (not V1 scenarios — they are raw event JSON files used by the new ingestion pipeline).

---

## 2. V1 vs V2 Flow

### V1 Flow (Predefined Scenario)
```
URL ?id=shadowlock
      ↓
ScenarioFull loaded from registry
      ↓
Evidence cards displayed (shuffled)
      ↓
Learner drags evidence into timeline
      ↓
analyzeInvestigation() scores the result
      ↓
InvestigationReview overlay
      ↓
AI Coach feedback (Gemini → Offline fallback)
```

### V2 Flow (Evidence-Driven)
```
User uploads JSON event dataset
      ↓
EventIngestionEngine — parse, validate, assign IDs
      ↓
EventNormalizationEngine — normalize fields, detect types
      ↓
TimelineReconstructionEngine — sort + correlate related events
      ↓
AttackStoryEngine — infer stages, confidence, uncertainties
      ↓
MitreInferenceEngine — map events → ATT&CK techniques
      ↓
IocExtractionEngine — extract indicators from normalized events
      ↓
V2 Investigation view — reconstructed timeline, attack chain, MITRE, IOCs
      ↓
AI Mentor V2 — teaches through questions using reconstructed data
      ↓
ExplanationLocalizationEngine — translate explanations to selected language
      ↓
Incident Report
```

**Critical principle:** V1 and V2 are additive. Navigating to `/investigation?id=shadowlock` works exactly as in V1 forever.

---

## 3. New V2 Data Models

### 3.1 Canonical Event Model

```typescript
// src/types/v2.ts (new file)

export interface SecurityEvent {
  id: string;                          // stable UUID assigned during ingestion
  timestamp: string;                   // ISO-8601, normalized
  eventType: string;                   // normalized event type string
  source?: string;                     // log source label
  sourceIp?: string;                   // normalized IPv4/IPv6
  destinationIp?: string;
  user?: string;                       // normalized username
  hostname?: string;                   // normalized hostname
  process?: string;                    // process name
  command?: string;                    // command line
  filePath?: string;                   // normalized path
  hash?: string;                       // file hash (any algo)
  domain?: string;                     // domain/FQDN
  port?: number;
  protocol?: string;
  severity?: "low" | "medium" | "high" | "critical";
  raw: Record<string, unknown>;        // original fields — never destroyed
}
```

### 3.2 Event Relationship Model

```typescript
export interface EventRelationship {
  fromEventId: string;
  toEventId: string;
  relationshipType:
    | "shared_source_ip"
    | "shared_user"
    | "shared_hostname"
    | "shared_process"
    | "shared_hash"
    | "shared_domain"
    | "temporal_sequence"
    | "authentication_chain"
    | "process_chain"
    | "network_flow";
  confidence: number;          // 0.0 – 1.0
  explanation: string;         // MUST be present — never an empty string
}
```

### 3.3 Attack Story Model

```typescript
export interface AttackStage {
  name: string;                        // e.g. "Initial Access"
  mitreTactic?: string;
  supportingEventIds: string[];
  reasoning: string;                   // why this stage was inferred
  confidence: number;                  // 0.0 – 1.0
  possibleTechniques: string[];        // ATT&CK technique IDs
  iocs: string[];                      // extracted IOC values relevant to this stage
}

export interface AttackStory {
  id: string;
  datasetId: string;
  summary: string;
  stages: AttackStage[];
  overallConfidence: number;
  evidence: string[];                  // event IDs that support the story
  uncertainties: string[];             // what could NOT be determined
  generatedAt: string;                 // ISO timestamp
}
```

### 3.4 MITRE Inference Model (V2)

```typescript
export interface V2MitreMapping {
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  confidence: number;                  // 0.0 – 1.0
  supportingEventIds: string[];
  explanation: string;
}
```

### 3.5 IOC V2 Model

```typescript
export type IocKind =
  | "ipv4" | "ipv6" | "domain" | "url" | "email"
  | "hash_md5" | "hash_sha1" | "hash_sha256"
  | "filepath" | "username" | "hostname" | "process";

export interface ExtractedIoc {
  kind: IocKind;
  value: string;
  sourceEventIds: string[];           // which events contain this IOC
  attackStage?: string;               // which stage it belongs to
  count: number;                      // how many events reference it
}
```

### 3.6 Ingestion Result Model

```typescript
export interface IngestionResult {
  datasetId: string;
  events: SecurityEvent[];
  // Validation summary
  totalInputRecords: number;
  validEvents: number;
  invalidRecords: number;
  duplicatesRemoved: number;
  missingTimestamps: number;
  detectedEventTypes: string[];
  detectedFields: string[];
  warnings: string[];
  errors: IngestionError[];
}

export interface IngestionError {
  recordIndex: number;
  field?: string;
  message: string;
  raw?: unknown;
}
```

### 3.7 Reconstruction Result (full V2 output)

```typescript
export interface ReconstructionResult {
  datasetId: string;
  events: SecurityEvent[];
  relationships: EventRelationship[];
  attackStory: AttackStory;
  mitreMappings: V2MitreMapping[];
  iocs: ExtractedIoc[];
  // Metadata
  reconstructedAt: string;
  processingMs: number;
  confidenceSummary: {
    overall: number;
    timeline: number;
    mitre: number;
    story: number;
  };
}
```

---

## 4. New V2 Engine Architecture

All new engines live in `src/lib/v2/`. They are pure TypeScript functions — no React, no API calls (except MITRE inference which optionally uses Gemini).

### 4.1 EventIngestionEngine

**File:** `src/lib/v2/eventIngestion.ts`

```
ingestEvents(rawInput: string, format: "json" | "ndjson" | "csv"): IngestionResult
```

Responsibilities:
- Parse JSON / NDJSON / CSV
- Detect timestamp field (tries: `timestamp`, `time`, `@timestamp`, `datetime`, `ts`, `created_at`, `event_time`)
- Detect IP fields (tries: `source_ip`, `src_ip`, `ip`, `src`, `remote_addr`, `client_ip`, `sourceIp`, `dest_ip`, `dst_ip`)
- Detect user fields (tries: `user`, `username`, `user_name`, `account`, `principal`, `actor`)
- Detect hostname fields (tries: `hostname`, `host`, `machine`, `computer`, `device`)
- Detect event type fields (tries: `event`, `event_type`, `event_id`, `action`, `type`, `category`)
- Assign stable UUID to each valid event
- Preserve original fields in `raw`
- Report per-record errors clearly
- Never throw on malformed input — always return partial results with errors

### 4.2 EventNormalizationEngine

**File:** `src/lib/v2/eventNormalization.ts`

```
normalizeEvents(events: SecurityEvent[]): SecurityEvent[]
```

Responsibilities:
- Normalize timestamps to ISO-8601 UTC
- Normalize IPs to standard dotted-decimal
- Lowercase usernames
- Lowercase and trim hostnames
- Detect and tag severity from field values or event type keywords
- Detect event type from event field patterns
- Report malformed records but continue processing

### 4.3 TimelineReconstructionEngine

**File:** `src/lib/v2/timelineReconstruction.ts`

```
reconstructTimeline(events: SecurityEvent[]): {
  sorted: SecurityEvent[];
  relationships: EventRelationship[];
  groups: EventGroup[];
}
```

This is NOT simply `Array.sort()`. The engine:

1. Sorts chronologically by timestamp
2. Groups events by shared entity (IP, user, hostname, process, hash, domain)
3. Detects suspicious sequences:
   - Multiple failed logins → successful login (same IP/user)
   - Process creation → child process with unusual parent
   - File creation → file execution
   - Outbound connection → large data transfer
   - Authentication event → lateral movement indicator
4. Assigns `EventRelationship` objects with:
   - `relationshipType` — what links them
   - `confidence` (0.0–1.0) — based on signal strength
   - `explanation` — always a human-readable sentence

### 4.4 AttackStoryEngine

**File:** `src/lib/v2/attackStory.ts`

```
generateAttackStory(
  events: SecurityEvent[],
  relationships: EventRelationship[]
): AttackStory
```

Uses rule-based pattern matching against known attack patterns. Does NOT call Gemini.

Stage detection patterns (confidence thresholds shown):
- **Initial Access:** authentication failures + success (same IP), external IP with successful auth → `0.85`
- **Execution:** process creation with suspicious parents, command line with encoded strings → `0.80`
- **Persistence:** registry modifications, scheduled task creation, service installation → `0.75`
- **Credential Access:** LSASS access, SAM access, multiple auth failures → `0.85`
- **Lateral Movement:** auth events on multiple hosts from same source, RDP/SMB connections → `0.80`
- **Collection:** bulk file access, archive creation → `0.70`
- **Exfiltration:** large outbound transfer, connection to external IP post-collection → `0.75`
- **Impact:** file modification at scale, service disruption, log clearing → `0.80`

Rules:
- Only include stages with at least one supporting event
- `confidence` reflects the fraction of supporting signals found
- `uncertainties` must list what was ambiguous or missing
- If fewer than 2 stages can be inferred: `summary = "Insufficient evidence to confidently reconstruct an attack chain."`

### 4.5 MitreInferenceEngine

**File:** `src/lib/v2/mitreInference.ts`

```
inferMitreMappings(
  events: SecurityEvent[],
  attackStory: AttackStory
): V2MitreMapping[]
```

Rule-based mapping using event type patterns → ATT&CK technique IDs. No keyword-only guessing — requires at least 2 corroborating signals per technique.

Pattern examples:
- Multiple `failed_login` + `successful_login` same IP → `T1110` Brute Force (0.90)
- `lsass_access` or `mimikatz` in process/command → `T1003.001` LSASS Memory (0.95)
- `scheduled_task_created` → `T1053.005` Scheduled Task (0.85)
- `registry_set` on Run keys → `T1547.001` Registry Run Keys (0.85)
- Large outbound transfer → `T1041` Exfil Over C2 (0.70)

### 4.6 IocExtractionEngine

**File:** `src/lib/v2/iocExtraction.ts`

```
extractIocs(events: SecurityEvent[]): ExtractedIoc[]
```

Scans every field of every normalized event. Detects:
- IPv4/IPv6 via regex
- Domain names (excluding known-safe like `localhost`, `127.0.0.1`)
- URLs
- Email addresses
- MD5 (32 hex), SHA1 (40 hex), SHA256 (64 hex) hashes
- File paths (Windows `C:\...`, Unix `/...`)
- Usernames and hostnames from normalized fields

Groups by value — multiple events referencing the same IOC are counted.

### 4.7 ExplanationLocalizationEngine

**File:** `src/lib/v2/explanationLocalization.ts`

```
localizeExplanation(
  text: string,
  language: SupportedLanguage,
  context: "summary" | "stage" | "mitre" | "ioc" | "recommendation"
): string
```

Supported languages: `"en" | "ta" | "hi" | "ml"`

**Architecture:**
- English: return text as-is
- Tamil/Hindi/Malayalam: call Gemini with a translation prompt
- If Gemini unavailable: return English text with a subtle inline note `[Translation unavailable — showing English]`

**Hard rules:**
- Never translate: MITRE technique IDs, IP addresses, hashes, domain names, timestamps, event IDs
- Never invent translated technical facts
- Translation only changes the explanation wrapper, not the underlying data

---

## 5. New V2 API Routes

All new routes are under `/api/v2/` to avoid collisions with V1.

```
POST   /api/v2/events/ingest
       Body: { data: string, format: "json" | "ndjson" | "csv" }
       Response: IngestionResult

POST   /api/v2/investigation/reconstruct
       Body: { datasetId: string, events: SecurityEvent[] }
       Response: ReconstructionResult

GET    /api/v2/investigation/:id
       Response: ReconstructionResult (from in-memory or session store)

POST   /api/v2/investigation/:id/explain
       Body: { action, context } (same contract as /api/coach, extended)
       Response: { guidance: string, source: "gemini" | "offline" }

POST   /api/v2/investigation/:id/translate
       Body: { text: string, language: "en" | "ta" | "hi" | "ml", context: string }
       Response: { translated: string, language: string }
```

---

## 6. New V2 UI Pages and Components

### 6.1 Pages

```
/investigate/upload          — Upload workspace (Phase 8)
/investigate/[id]            — V2 reconstructed investigation view (Phase 9)
/investigate/[id]/report     — Dynamic report for V2 investigation
```

### 6.2 Components (new, in `src/components/features/v2/`)

```
UploadZone.tsx               — Drag-and-drop file upload with format detection
DatasetOverview.tsx          — Shows event count, time range, event types, hosts, users, IPs
ProcessingStages.tsx         — Honest multi-step progress (Parsing → Normalizing → etc.)
ReconstructedTimeline.tsx    — Timeline view for V2 events with confidence badges
AttackChainView.tsx          — Visual event → event → stage flow
EventRelationshipPanel.tsx   — "Why are these connected?" inspector
MitreNavigator.tsx           — Real ATT&CK navigator (replaces MitrePlaceholder.tsx)
IocPanel.tsx                 — Extracted IOC explorer with event drill-down
LanguageSwitcher.tsx         — English | தமிழ் | हिन्दी | മലയാളം
ConfidenceBadge.tsx          — Reusable "High/Medium/Low confidence" indicator
InferenceBadge.tsx           — Visual marker for AI-inferred vs confirmed evidence
```

---

## 7. V2 State Management

V2 does not use a React context for reconstruction results — the data is too large and produced by a server-side pipeline. Instead:

- **Upload page:** local component state (file → parse result → reconstruct button)
- **Reconstruction result:** stored in `sessionStorage` keyed by `datasetId` after the reconstruct API call completes
- **Language selection:** stored in `localStorage` under `traceforge:language`, read by `LanguageSwitcher`
- **V1 investigation state:** unchanged — still lives in `InvestigationContext` + `localStorage`

---

## 8. V2 Sample Datasets

Stored in `src/data/sample-datasets/` as `.json` files. Three synthetic datasets:

| File | Attack Type | Events |
|---|---|---|
| `brute-force.json` | Credential Theft / Brute Force | ~25 events |
| `ransomware.json` | Ransomware | ~30 events |
| `insider-threat.json` | Insider Threat | ~20 events |

These are clearly labeled synthetic data. All IPs, usernames, hostnames are fictional. No real threat data is embedded.

---

## 9. Security Model — V2 Extensions

| Concern | V2 Implementation |
|---|---|
| File upload safety | Validate MIME type, reject executables, parse only — never execute |
| Upload size limit | 5MB hard limit enforced in API route before parsing |
| Input sanitization | All uploaded values treated as untrusted; rendered via React (escaped) |
| API key | GEMINI_API_KEY still server-side only. Translation + AI mentor use same route |
| Sensitive data in logs | Uploaded event content never logged beyond field names |
| Session store | `ReconstructionResult` stored in `sessionStorage` — cleared on tab close |

---

## 10. Migration Strategy

**Nothing in V1 is removed or modified except:**
- `src/types/index.ts` — extended with new V2 types in `src/types/v2.ts` (new file, zero V1 impact)
- `ARCHITECTURE.md` — updated to reference V2 additions
- `README.md` — updated with V2 section
- `src/app/report/page.tsx` — the hardcoded static content will be replaced with dynamic content in a later phase; the existing static page remains until the dynamic version is ready

**All V2 additions are strictly additive:**
- New routes under `/investigate/`
- New API routes under `/api/v2/`
- New engines under `src/lib/v2/`
- New components under `src/components/features/v2/`
- New types in `src/types/v2.ts`
- New data in `src/data/sample-datasets/`

---

## 11. Phase Implementation Order

| Phase | Description | Touches V1? |
|---|---|---|
| ✅ 1 | Repository audit + V2_ARCHITECTURE.md | No |
| 🔜 2 | `src/types/v2.ts` — all V2 types | No |
| 🔜 3 | `EventIngestionEngine` + sample datasets | No |
| 🔜 4 | `EventNormalizationEngine` | No |
| 🔜 5 | `TimelineReconstructionEngine` | No |
| 🔜 6 | `AttackStoryEngine` | No |
| 🔜 7 | `MitreInferenceEngine` + `IocExtractionEngine` | No |
| 🔜 8 | `/api/v2/events/ingest` + `/api/v2/investigation/reconstruct` | No |
| 🔜 9 | Upload UI (`/investigate/upload`) | No |
| 🔜 10 | V2 Investigation view (`/investigate/[id]`) | No |
| 🔜 11 | AI Mentor V2 context extension | Minor (adds fields to context type) |
| 🔜 12 | ExplanationLocalizationEngine + language switcher | No |
| 🔜 13 | Edge case testing | No |
| 🔜 14 | Test suite | No |
| 🔜 15 | Documentation update | No |

After each phase: run `npm run build`, verify V1 `/investigation?id=op-shadow-lock` still works.

---

## 12. Testing Strategy

**Unit tests** (Vitest — to be added in Phase 14):
- `EventIngestionEngine` — valid JSON, malformed JSON, empty, NDJSON, missing fields
- `EventNormalizationEngine` — timestamp normalization, IP normalization, severity detection
- `TimelineReconstructionEngine` — sorting, grouping, relationship detection
- `AttackStoryEngine` — stage detection, confidence calculation, uncertainty output
- `MitreInferenceEngine` — technique mapping accuracy
- `IocExtractionEngine` — regex accuracy for IPs, hashes, domains

**Integration tests:**
- Upload → Ingest → Normalize → Reconstruct → Verify output shape
- Edge cases: empty dataset, single event, 1000 events, missing timestamps, conflicting timestamps

**Smoke test:**
- V1 investigation still starts without errors after every phase

---

## 13. Final Directory Layout (Post-V2)

```
traceforge/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── coach/                     # V1 — unchanged
│   │   │   └── v2/
│   │   │       ├── events/ingest/         # NEW
│   │   │       └── investigation/         # NEW
│   │   ├── investigate/
│   │   │   ├── upload/                    # NEW — /investigate/upload
│   │   │   └── [id]/                      # NEW — /investigate/:id
│   │   ├── investigation/                 # V1 — unchanged
│   │   ├── scenarios/                     # V1 — unchanged
│   │   ├── report/                        # V1 — static, will be replaced later
│   │   └── ...
│   ├── components/
│   │   ├── features/
│   │   │   ├── v2/                        # NEW — all V2 UI components
│   │   │   ├── coach/                     # V1 — unchanged
│   │   │   ├── evidence/                  # V1 — unchanged
│   │   │   ├── investigation/             # V1 — unchanged
│   │   │   ├── review/                    # V1 — unchanged
│   │   │   └── ...
│   │   └── [shared primitives]            # V1 — unchanged
│   ├── contexts/
│   │   └── InvestigationContext.tsx       # V1 — unchanged
│   ├── data/
│   │   ├── scenarios/                     # V1 — unchanged
│   │   └── sample-datasets/               # NEW — synthetic JSON datasets
│   ├── lib/
│   │   ├── geminiCoach.ts                 # V1 — unchanged
│   │   ├── offlineCoach.ts                # V1 — unchanged
│   │   ├── investigationAnalysis.ts       # V1 — unchanged
│   │   └── v2/                            # NEW — all V2 engines
│   │       ├── eventIngestion.ts
│   │       ├── eventNormalization.ts
│   │       ├── timelineReconstruction.ts
│   │       ├── attackStory.ts
│   │       ├── mitreInference.ts
│   │       ├── iocExtraction.ts
│   │       └── explanationLocalization.ts
│   ├── types/
│   │   ├── index.ts                       # V1 — unchanged
│   │   └── v2.ts                          # NEW — all V2 types
│   └── utils/
│       └── formatters.ts                  # V1 — unchanged
├── V2_ARCHITECTURE.md                     # This document
├── V2_ROADMAP.md                          # Phase tracking
└── ...
```
