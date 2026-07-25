import { Bot, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

export function CoachPlaceholder() {
  return (
    <GlassCard glow className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-purple-500/20 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">AI Coach</p>
          <p className="text-[10px] font-mono text-white/30">Powered by Gemini</p>
        </div>
        <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full border border-yellow-400/20 bg-yellow-400/[0.06]">
          <Sparkles className="w-2.5 h-2.5 text-yellow-400" />
          <span className="text-[9px] font-mono text-yellow-400">Phase 2</span>
        </div>
      </div>

      <div className="space-y-2">
        {[
          "Analyze suspicious event patterns",
          "Suggest next investigation steps",
          "Explain MITRE techniques",
          "Generate incident narrative",
        ].map((hint, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
          >
            <span className="w-1 h-1 rounded-full bg-purple-400/40 flex-shrink-0" />
            <p className="text-xs text-white/40">{hint}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-white/20 text-center mt-4 font-mono">
        Gemini integration · Phase 2
      </p>
    </GlassCard>
  );
}
