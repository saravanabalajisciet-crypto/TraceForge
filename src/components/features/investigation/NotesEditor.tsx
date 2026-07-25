"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FileText, Check } from "lucide-react";
import { useInvestigation } from "@/contexts/InvestigationContext";

interface NotesEditorProps {
  evidenceId: string;
}

export function NotesEditor({ evidenceId }: NotesEditorProps) {
  const { invState, setNote } = useInvestigation();
  const [value, setValue] = useState(invState.notes[evidenceId] ?? "");
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when evidence changes
  useEffect(() => {
    setValue(invState.notes[evidenceId] ?? "");
  }, [evidenceId, invState.notes]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setNote(evidenceId, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 600);
  }, [evidenceId, setNote]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-white/70">Analyst Notes</span>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
            <Check className="w-3 h-3" />
            Saved
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder="Add investigation observations, IOC notes, or hypotheses here…"
        rows={5}
        className="w-full rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-2.5 text-xs text-white/70 placeholder:text-white/20 font-mono resize-none focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.05] transition-all leading-relaxed"
      />
      <p className="text-[9px] text-white/20 font-mono">Auto-saved to localStorage</p>
    </div>
  );
}
