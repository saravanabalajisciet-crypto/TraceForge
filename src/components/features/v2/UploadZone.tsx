"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileJson, AlertCircle, Sparkles } from "lucide-react";
import { SAMPLE_DATASETS, SampleDatasetMeta } from "@/data/sample-datasets";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onData: (rawData: string, fileName: string, fileSizeBytes: number, format?: "json" | "ndjson" | "csv") => void;
  disabled?: boolean;
}

export function UploadZone({ onData, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>("");
  const [loadingSample, setLoadingSample] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

  function detectFormat(fileName: string): "json" | "ndjson" | "csv" {
    if (fileName.endsWith(".ndjson") || fileName.endsWith(".jsonl")) return "ndjson";
    if (fileName.endsWith(".csv")) return "csv";
    return "json";
  }

  function handleFile(file: File) {
    setError("");
    if (file.size > MAX_SIZE) {
      setError(`File too large (${Math.round(file.size / 1024)}KB). Maximum is 5MB.`);
      return;
    }
    const fmt = detectFormat(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text?.trim()) { setError("File appears to be empty."); return; }
      onData(text, file.name, file.size, fmt);
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSample(sample: SampleDatasetMeta) {
    setError("");
    setLoadingSample(sample.id);
    try {
      const res = await fetch(`/sample-datasets/${sample.fileName}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      onData(text, sample.fileName, Buffer.byteLength(text, "utf8"), "json");
    } catch (e) {
      setError(`Failed to load sample: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setLoadingSample("");
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Drop zone */}
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        animate={{ borderColor: isDragging ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.06)" }}
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-colors cursor-pointer",
          "flex flex-col items-center justify-center gap-3 py-12 px-8",
          "bg-white/[0.015] hover:bg-white/[0.025]",
          isDragging && "bg-purple-500/[0.05]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,.ndjson,.jsonl,.csv"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          disabled={disabled}
        />
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Upload className="w-5 h-5 text-purple-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white/70">
            {isDragging ? "Drop to upload" : "Drop your event dataset here"}
          </p>
          <p className="text-[11px] text-white/30 mt-1">
            JSON · NDJSON · CSV &nbsp;·&nbsp; max 5 MB
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["json", "ndjson", "csv"] as const).map((fmt) => (
            <span key={fmt} className="px-2 py-0.5 text-[9px] font-mono rounded border border-white/[0.06] text-white/30">
              .{fmt}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/[0.05]"
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400/80">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sample datasets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3 h-3 text-purple-400/60" />
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Or load a sample dataset</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SAMPLE_DATASETS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => loadSample(sample)}
              disabled={disabled || !!loadingSample}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                "border-white/[0.06] bg-white/[0.02] hover:border-purple-500/30 hover:bg-purple-500/[0.04]",
                (disabled || !!loadingSample) && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <FileJson className="w-3 h-3 text-purple-400/70 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-white/70 truncate">{sample.title}</span>
              </div>
              <p className="text-[9px] text-white/30 leading-relaxed line-clamp-2">{sample.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] font-mono text-purple-400/60">{sample.eventCount} events</span>
                <span className="text-[9px] font-mono text-white/20">·</span>
                <span className="text-[9px] font-mono text-white/30">{sample.difficulty}</span>
              </div>
              {loadingSample === sample.id && (
                <p className="text-[9px] font-mono text-purple-400 mt-1">Loading…</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
