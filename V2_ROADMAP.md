# TraceForge AI V2 — Roadmap

> This document tracks implementation progress for V2.
> Features are only marked complete when they actually work.

---

## ✅ Completed

### Phase 1 — Repository Audit
- [x] Full V1 codebase audit (all engines, types, API routes, components, scenarios)
- [x] `V2_ARCHITECTURE.md` — complete architecture document
- [x] `V2_ROADMAP.md` — this document
- [x] V1 confirmed working: `npm run dev`, `npm run build`, Docker

### Phase 2 — V2 Type Definitions
- [x] `src/types/v2.ts` — all V2 interfaces (zero changes to V1 `index.ts`)
  - [x] `SecurityEvent`, `EventRelationship`, `EventGroup`, `AttackStage`, `AttackStory`
  - [x] `V2MitreMapping`, `ExtractedIoc` (12 IOC kinds), `IocKind`
  - [x] `IngestionResult`, `IngestionError`, `ReconstructionResult`, `ConfidenceSummary`
  - [x] `V2CoachContext`, `V2CoachActionType`, `ProcessingStage`, `DatasetOverview`
  - [x] `SupportedLanguage` + `SUPPORTED_LANGUAGES` (en, ta, hi, ml)
  - [x] Guard utilities: `isIpv4`, `isIpv6`, `isMd5`, `isSha1`, `isSha256`, `isDomain`, `isEmail`, `isUrl`, `isFilePath`
  - [x] `confidenceLabel()` helper
- [x] `npm run build` passes — zero TypeScript errors, V1 intact

---

## 🔜 In Progress

_Starting Phase 15 — Documentation update, then commit and push._

---

## 📋 Planned

### Phase 2 — V2 Type Definitions
- [ ] `src/types/v2.ts` — all new V2 interfaces
  - SecurityEvent, EventRelationship, AttackStage, AttackStory
  - V2MitreMapping, ExtractedIoc, IocKind
  - IngestionResult, IngestionError
  - ReconstructionResult, ConfidenceSummary
  - SupportedLanguage

### Phase 3 — Event Ingestion Engine + Sample Datasets
- [x] `src/lib/v2/eventIngestion.ts` — JSON/NDJSON/CSV, field auto-detection, dedup, validation summary, never throws
- [x] `src/data/sample-datasets/` — 3 synthetic datasets (brute-force, ransomware, insider-threat)
- [x] `public/sample-datasets/` — JSON files copied for browser access
- [x] `npm run build` passes — V1 intact

### Phase 4 — Event Normalization Engine
- [ ] `src/lib/v2/eventNormalization.ts`
  - ISO-8601 timestamp normalization
  - IP address normalization
  - Username + hostname lowercasing
  - Severity detection from event type patterns
  - Malformed record handling

### Phase 5 — Timeline Reconstruction Engine
- [ ] `src/lib/v2/timelineReconstruction.ts`
  - Chronological sort
  - Entity grouping (IP, user, hostname, process, hash, domain)
  - Suspicious sequence detection
  - EventRelationship generation with confidence + explanation
  - Event group formation

### Phase 6 — Attack Story Engine
- [ ] `src/lib/v2/attackStory.ts`
  - Stage detection (8 ATT&CK stages)
  - Confidence scoring per stage
  - Uncertainty enumeration
  - "Insufficient evidence" handling
  - Summary narrative generation

### Phase 7 — MITRE Inference + IOC Extraction
- [ ] `src/lib/v2/mitreInference.ts`
  - Pattern-to-technique mapping (25+ patterns)
  - Minimum 2 corroborating signals per technique
  - Confidence scoring with explanation
- [ ] `src/lib/v2/iocExtraction.ts`
  - IPv4, IPv6, domain, URL, email, hash, filepath detection
  - Cross-event IOC deduplication
  - Event-to-IOC back-reference

### Phase 8 — API Routes
- [ ] `POST /api/v2/events/ingest`
- [ ] `POST /api/v2/investigation/reconstruct`
- [ ] `GET /api/v2/investigation/:id`
- [ ] `POST /api/v2/investigation/:id/explain`
- [ ] `POST /api/v2/investigation/:id/translate`
- [ ] File size limit (5MB) + format validation

### Phase 9 — Upload Workspace UI
- [ ] `/investigate/upload` page
- [ ] `UploadZone.tsx` — drag-and-drop JSON/NDJSON/CSV
- [ ] `DatasetOverview.tsx` — event count, time range, types, hosts, users, IPs
- [ ] `ProcessingStages.tsx` — honest progress stages
- [ ] Sample dataset loader (3 prebuilt datasets)
- [ ] Validation warning display

### Phase 10 — V2 Investigation View
- [ ] `/investigate/[id]` page
- [ ] `ReconstructedTimeline.tsx` — events with confidence badges
- [ ] `AttackChainView.tsx` — stage flow visualization
- [ ] `EventRelationshipPanel.tsx` — relationship inspector
- [ ] `MitreNavigator.tsx` — real ATT&CK coverage view
- [ ] `IocPanel.tsx` — IOC explorer with drill-down
- [ ] `ConfidenceBadge.tsx` + `InferenceBadge.tsx`

### Phase 11 — AI Mentor V2 Integration
- [ ] Extend `CoachActionType` with V2 actions
- [ ] Build V2 prompt context from `ReconstructionResult`
- [ ] `AICoach.tsx` V2 variant (or shared component with V2 context)
- [ ] Offline mentor V2 context handling

### Phase 12 — Multilingual Layer
- [ ] `src/lib/v2/explanationLocalization.ts`
- [ ] `LanguageSwitcher.tsx` component
- [ ] English | தமிழ் | हिन्दी | മലയാളം
- [ ] Gemini translation prompt + offline fallback
- [ ] Language stored in localStorage

### Phase 13 — Sample Datasets
- [ ] `src/data/sample-datasets/brute-force.json` (~25 events)
- [ ] `src/data/sample-datasets/ransomware.json` (~30 events)
- [ ] `src/data/sample-datasets/insider-threat.json` (~20 events)
- [ ] Edge case dataset: empty, single event, missing timestamps

### Phase 14 — Test Suite
- [ ] Vitest setup
- [ ] Unit tests: ingestion, normalization, timeline, story, MITRE, IOC
- [ ] Integration test: upload → reconstruct → verify output shape
- [ ] Edge case tests: empty/invalid/large inputs
- [ ] V1 smoke test: investigation still starts after each phase

### Phase 15 — Documentation + Docker
- [ ] `README.md` — V2 section added
- [ ] `ARCHITECTURE.md` — updated with V2 engines
- [ ] Docker validation with V2 routes
- [ ] `V2_ROADMAP.md` — this file updated to reflect completion

---

## 🔮 Future (Post-Hackathon)

- Live SOC simulation mode (streaming event ingestion)
- Community scenario sharing
- User authentication + PWNDORA SSO
- Progress persistence across sessions
- Mobile-responsive layout
- PCAP / Zeek log ingestion
- STIX/TAXII threat intelligence integration
- Causal link builder UI (V1 spec item)
- MITRE ATT&CK tactic assignment per evidence card (V1 spec item)
- PDF export of incident reports (V1 spec item)
