"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Navbar } from "@/components/Navbar";
import { UploadZone } from "@/components/features/v2/UploadZone";
import { DatasetOverview } from "@/components/features/v2/DatasetOverview";
import { ProcessingStages } from "@/components/features/v2/ProcessingStages";
import {
  DatasetOverview as DatasetOverviewType,
  ProcessingStage,
  DEFAULT_PROCESSING_STAGES,
  IngestionFormat,
} from "@/types/v2";

type PageState = "idle" | "previewing" | "processing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("idle");
  const [overview, setOverview] = useState<DatasetOverviewType | null>(null);
  const [stages, setStages] = useState<ProcessingStage[]>(DEFAULT_PROCESSING_STAGES);
  const [errorMsg, setErrorMsg] = useState("");

  // Raw data held for reconstruction
  const [pendingData, setPendingData] = useState<{
    rawData: string; fileName: string; fileSizeBytes: number; format?: IngestionFormat;
  } | null>(null);

  // ── Step 1: File selected → ingest preview ────────────────────────────────
  const handleData = useCallback(async (
    rawData: string, fileName: string, fileSizeBytes: number, format?: IngestionFormat
  ) => {
    setErrorMsg("");
    setPageState("processing");
    setStages(DEFAULT_PROCESSING_STAGES.map((s, i) =>
      i === 0 ? { ...s, status: "active" } : s
    ));

    try {
      // Upload stage
      await tick();
      setStages((prev) => prev.map((s) => s.id === "upload" ? { ...s, status: "complete" } :
        s.id === "parse" ? { ...s, status: "active" } : s));

      const res = await fetch("/api/v2/events/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: rawData, format, fileName, fileSizeBytes }),
      });

      setStages((prev) => prev.map((s) => s.id === "parse" ? { ...s, status: "complete" } : s));

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ingestion failed.");

      setStages((prev) => prev.map((s) =>
        s.id === "normalize" ? { ...s, status: "complete" } : s
      ));

      setPendingData({ rawData, fileName, fileSizeBytes, format });
      setOverview(json.overview);
      setPageState("previewing");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Upload failed.");
      setPageState("error");
    }
  }, []);

  // ── Step 2: User clicks Reconstruct ──────────────────────────────────────
  const handleReconstruct = useCallback(async () => {
    if (!pendingData) return;
    setPageState("processing");
    setErrorMsg("");

    const stageIds = ["upload", "parse", "normalize", "correlate", "reconstruct", "mitre", "ioc", "ready"];
    // Mark first 3 done (already done from ingest step)
    setStages(DEFAULT_PROCESSING_STAGES.map((s, i) => {
      if (i < 3) return { ...s, status: "complete" };
      if (i === 3) return { ...s, status: "active" };
      return s;
    }));

    try {
      // Simulate stage progression while waiting for API
      const advanceStage = async (activeId: string, completeId: string) => {
        setStages((prev) => prev.map((s) =>
          s.id === completeId ? { ...s, status: "complete" } :
          s.id === activeId ? { ...s, status: "active" } : s
        ));
        await tick(300);
      };

      const reconstructionPromise = fetch("/api/v2/investigation/reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: pendingData.rawData,
          format: pendingData.format,
          fileName: pendingData.fileName,
          fileSizeBytes: pendingData.fileSizeBytes,
        }),
      });

      await advanceStage("reconstruct", "correlate");
      await advanceStage("mitre", "reconstruct");
      await advanceStage("ioc", "mitre");

      const res = await reconstructionPromise;
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? "Reconstruction failed.");

      setStages((prev) => prev.map((s) =>
        stageIds.includes(s.id) ? { ...s, status: "complete" } : s
      ));

      await tick(400);
      router.push(`/investigate/${json.datasetId}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Reconstruction failed.");
      setPageState("error");
    }
  }, [pendingData, router]);

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col overflow-hidden">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] bg-purple-900/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-blue-900/10 rounded-full blur-[80px]" />
      </div>

      <Navbar />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-purple-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Evidence-Driven Investigation</h1>
          <p className="text-sm text-white/40 max-w-md">
            Upload a security event dataset and TraceForge will reconstruct the attack chain automatically.
          </p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <Link href="/scenarios" className="flex items-center gap-1.5 text-[11px] font-mono text-purple-400/60 hover:text-purple-400 transition-colors">
              <ArrowLeft className="w-3 h-3" />
              Back to Scenarios
            </Link>
            <span className="text-white/10">·</span>
            <span className="text-[10px] font-mono text-white/20">
              V2 · No Gemini required for reconstruction
            </span>
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {(pageState === "idle" || pageState === "error") && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <UploadZone onData={handleData} disabled={false} />
              {pageState === "error" && errorMsg && (
                <p className="text-xs text-red-400 text-center mt-4">{errorMsg}</p>
              )}
            </motion.div>
          )}

          {pageState === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6">
              <p className="text-sm text-white/50 font-mono">Analysing your dataset…</p>
              <ProcessingStages stages={stages} />
            </motion.div>
          )}

          {pageState === "previewing" && overview && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DatasetOverview
                overview={overview}
                onReconstruct={handleReconstruct}
                isReconstructing={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function tick(ms = 200) { return new Promise((r) => setTimeout(r, ms)); }
