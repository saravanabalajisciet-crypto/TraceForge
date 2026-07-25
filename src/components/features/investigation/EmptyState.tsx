import Link from "next/link";
import { ShieldAlert, ArrowLeft, FileSearch } from "lucide-react";
import { GradientButton } from "@/components/GradientButton";

interface EmptyStateProps {
  variant: "no-scenario" | "no-evidence";
}

export function EmptyState({ variant }: EmptyStateProps) {
  if (variant === "no-scenario") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Investigation Selected</h2>
        <p className="text-white/40 text-sm max-w-sm mb-8 leading-relaxed">
          Select a scenario from the Scenario Library to begin your DFIR investigation.
        </p>
        <Link href="/scenarios">
          <GradientButton size="md">
            <ArrowLeft className="w-4 h-4" />
            Return to Scenario Library
          </GradientButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <FileSearch className="w-6 h-6 text-white/20" />
      </div>
      <p className="text-sm text-white/30 font-mono">No evidence has been added to the investigation.</p>
    </div>
  );
}
