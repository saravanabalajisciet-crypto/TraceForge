import { Grid3X3, ExternalLink } from "lucide-react";

const TACTICS = [
  { id: "TA0001", name: "Initial Access", techniques: ["T1566", "T1190"] },
  { id: "TA0002", name: "Execution", techniques: ["T1059"] },
  { id: "TA0003", name: "Persistence", techniques: ["T1547"] },
  { id: "TA0008", name: "Lateral Movement", techniques: ["T1021", "T1570"] },
  { id: "TA0011", name: "Command & Control", techniques: ["T1071"] },
  { id: "TA0040", name: "Impact", techniques: ["T1486"] },
];

export function MitrePlaceholder() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white/80">MITRE ATT&CK Coverage</h3>
        </div>
        <a
          href="https://attack.mitre.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-mono text-white/30 hover:text-purple-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          ATT&CK Framework
        </a>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {TACTICS.map((tactic) => (
          <div
            key={tactic.id}
            className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
          >
            <p className="text-[9px] font-mono text-purple-400/60 uppercase tracking-widest">
              {tactic.id}
            </p>
            <p className="text-[11px] font-semibold text-white/70 leading-tight">
              {tactic.name}
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {tactic.techniques.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-purple-500/15 text-purple-400/80 border border-purple-500/20"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] font-mono text-white/20 text-center mt-1">
        Full ATT&CK matrix mapping · Implementation phase 2
      </p>
    </div>
  );
}
