"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { InvestigationState, TimelineSlot, EvidenceItem, ScenarioFull } from "@/types";
import { getScenarioById } from "@/data/scenarios";

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = (id: string) => `traceforge:investigation:${id}`;

function loadState(scenarioId: string): InvestigationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY(scenarioId));
    return raw ? (JSON.parse(raw) as InvestigationState) : null;
  } catch {
    return null;
  }
}

function saveState(state: InvestigationState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY(state.scenarioId), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function freshState(scenarioId: string): InvestigationState {
  return {
    scenarioId,
    reviewedEvidenceIds: [],
    timeline: [],
    notes: {},
    lastSaved: new Date().toISOString(),
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "LOAD"; state: InvestigationState }
  | { type: "MARK_REVIEWED"; evidenceId: string }
  | { type: "ADD_TO_TIMELINE"; slot: TimelineSlot }
  | { type: "REMOVE_FROM_TIMELINE"; slotId: string }
  | { type: "REORDER_TIMELINE"; slots: TimelineSlot[] }
  | { type: "SET_NOTE"; evidenceId: string; note: string }
  | { type: "RESET" };

function reducer(state: InvestigationState, action: Action): InvestigationState {
  const ts = new Date().toISOString();
  switch (action.type) {
    case "LOAD":
      return action.state;
    case "MARK_REVIEWED":
      if (state.reviewedEvidenceIds.includes(action.evidenceId)) return state;
      return { ...state, reviewedEvidenceIds: [...state.reviewedEvidenceIds, action.evidenceId], lastSaved: ts };
    case "ADD_TO_TIMELINE":
      return { ...state, timeline: [...state.timeline, action.slot], lastSaved: ts };
    case "REMOVE_FROM_TIMELINE":
      return { ...state, timeline: state.timeline.filter((s) => s.slotId !== action.slotId), lastSaved: ts };
    case "REORDER_TIMELINE":
      return { ...state, timeline: action.slots, lastSaved: ts };
    case "SET_NOTE":
      return { ...state, notes: { ...state.notes, [action.evidenceId]: action.note }, lastSaved: ts };
    case "RESET":
      return freshState(state.scenarioId);
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface DrawerState {
  open: boolean;
  evidenceId: string | null;
}

interface InvestigationContextValue {
  scenario: ScenarioFull | null;
  invState: InvestigationState;
  drawer: DrawerState;
  showReview: boolean;
  // actions
  loadScenario: (id: string) => void;
  markReviewed: (evidenceId: string) => void;
  addToTimeline: (evidenceId: string) => void;
  removeFromTimeline: (slotId: string) => void;
  reorderTimeline: (slots: TimelineSlot[]) => void;
  setNote: (evidenceId: string, note: string) => void;
  resetInvestigation: () => void;
  openDrawer: (evidenceId: string) => void;
  closeDrawer: () => void;
  openReview: () => void;
  closeReview: () => void;
  // computed
  getEvidence: (id: string) => EvidenceItem | undefined;
  isReviewed: (id: string) => boolean;
  isInTimeline: (evidenceId: string) => boolean;
  progressStats: {
    reviewed: number;
    total: number;
    timelineCount: number;
    notesCount: number;
    overallPct: number;
  };
}

const InvestigationContext = createContext<InvestigationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function InvestigationProvider({ children, initialScenarioId }: { children: React.ReactNode; initialScenarioId?: string }) {
  const [scenario, setScenario] = React.useState<ScenarioFull | null>(null);
  const [invState, dispatch] = useReducer(reducer, freshState(initialScenarioId ?? ""));
  const [drawer, setDrawer] = React.useState<DrawerState>({ open: false, evidenceId: null });
  const [showReview, setShowReview] = React.useState(false);

  const loadScenario = useCallback((id: string) => {
    const s = getScenarioById(id);
    if (!s) return;
    setScenario(s);
    const saved = loadState(id);
    dispatch({ type: "LOAD", state: saved ?? freshState(id) });
  }, []);

  // Load on mount if we have an id
  useEffect(() => {
    if (initialScenarioId) loadScenario(initialScenarioId);
  }, [initialScenarioId, loadScenario]);

  // Auto-save whenever invState changes
  useEffect(() => {
    if (invState.scenarioId) saveState(invState);
  }, [invState]);

  const markReviewed = useCallback((evidenceId: string) => dispatch({ type: "MARK_REVIEWED", evidenceId }), []);

  const addToTimeline = useCallback((evidenceId: string) => {
    const slot: TimelineSlot = { slotId: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, evidenceId };
    dispatch({ type: "ADD_TO_TIMELINE", slot });
  }, []);

  const removeFromTimeline = useCallback((slotId: string) => dispatch({ type: "REMOVE_FROM_TIMELINE", slotId }), []);
  const reorderTimeline = useCallback((slots: TimelineSlot[]) => dispatch({ type: "REORDER_TIMELINE", slots }), []);
  const setNote = useCallback((evidenceId: string, note: string) => dispatch({ type: "SET_NOTE", evidenceId, note }), []);
  const resetInvestigation = useCallback(() => dispatch({ type: "RESET" }), []);
  const openDrawer = useCallback((evidenceId: string) => { setDrawer({ open: true, evidenceId }); markReviewed(evidenceId); }, [markReviewed]);
  const closeDrawer = useCallback(() => setDrawer({ open: false, evidenceId: null }), []);
  const openReview = useCallback(() => setShowReview(true), []);
  const closeReview = useCallback(() => setShowReview(false), []);

  const getEvidence = useCallback((id: string) => scenario?.evidence.find((e) => e.id === id), [scenario]);
  const isReviewed = useCallback((id: string) => invState.reviewedEvidenceIds.includes(id), [invState.reviewedEvidenceIds]);
  const isInTimeline = useCallback((evidenceId: string) => invState.timeline.some((s) => s.evidenceId === evidenceId), [invState.timeline]);

  const progressStats = React.useMemo(() => {
    const total = scenario?.evidence.length ?? 0;
    const reviewed = invState.reviewedEvidenceIds.length;
    const timelineCount = invState.timeline.length;
    const notesCount = Object.values(invState.notes).filter((n) => n.trim().length > 0).length;
    const overallPct = total === 0 ? 0 : Math.round(
      ((reviewed / total) * 50 + (Math.min(timelineCount, total) / Math.max(total, 1)) * 30 + (notesCount > 0 ? 20 : 0))
    );
    return { reviewed, total, timelineCount, notesCount, overallPct };
  }, [scenario, invState]);

  return (
    <InvestigationContext.Provider value={{
      scenario, invState, drawer, showReview,
      loadScenario, markReviewed, addToTimeline, removeFromTimeline, reorderTimeline, setNote, resetInvestigation,
      openDrawer, closeDrawer, openReview, closeReview, getEvidence, isReviewed, isInTimeline, progressStats,
    }}>
      {children}
    </InvestigationContext.Provider>
  );
}

export function useInvestigation() {
  const ctx = useContext(InvestigationContext);
  if (!ctx) throw new Error("useInvestigation must be used inside InvestigationProvider");
  return ctx;
}
