"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ExtractedIoc, IocKind } from "@/types/v2";
import { getIocKindLabel, getIocIcon, groupIocsByKind } from "@/lib/v2/iocExtraction";
import { Globe, Network, Link, Hash, User, Server, Folder, Cpu, Tag, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface IocPanelProps {
  iocs: ExtractedIoc[];
  onIocClick?: (ioc: ExtractedIoc) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  ip:       <Globe className="w-3.5 h-3.5" />,
  domain:   <Network className="w-3.5 h-3.5" />,
  url:      <Link className="w-3.5 h-3.5" />,
  hash:     <Hash className="w-3.5 h-3.5" />,
  email:    <Mail className="w-3.5 h-3.5" />,
  user:     <User className="w-3.5 h-3.5" />,
  host:     <Server className="w-3.5 h-3.5" />,
  file:     <Folder className="w-3.5 h-3.5" />,
  process:  <Cpu className="w-3.5 h-3.5" />,
  tag:      <Tag className="w-3.5 h-3.5" />,
};

export function IocPanel({ iocs, onIocClick }: IocPanelProps) {
  const [expanded, setExpanded] = useState<IocKind | null>(null);
  const grouped = groupIocsByKind(iocs);

  if (iocs.length === 0) {
    return (
      <p className="text-xs text-white/25 font-mono text-center py-4">No IOCs extracted.</p>
    );
  }

  const priorityOrder: IocKind[] = [
    "ipv4", "ipv6", "domain", "url", "email",
    "hash_sha256", "hash_sha1", "hash_md5",
    "filepath", "process", "username", "hostname",
  ];

  const orderedKinds = priorityOrder.filter((k) => grouped[k]?.length > 0);

  return (
    <div className="space-y-2">
      {orderedKinds.map((kind) => {
        const kindIocs = grouped[kind];
        const isExpanded = expanded === kind;
        const iconKey = getIocIcon(kind);

        return (
          <div key={kind} className="rounded-lg border border-white/[0.05] overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : kind)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-purple-400/70">{ICON_MAP[iconKey]}</span>
                <span className="text-xs font-medium text-white/60">{getIocKindLabel(kind)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-white/25">{kindIocs.length}</span>
                <span className={cn("text-[10px] text-white/20 transition-transform", isExpanded && "rotate-90")}>›</span>
              </div>
            </button>

            {isExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="border-t border-white/[0.04] px-3 py-2 space-y-1.5"
              >
                {kindIocs.slice(0, 20).map((ioc) => (
                  <div
                    key={ioc.id}
                    onClick={() => onIocClick?.(ioc)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded px-2 py-1.5",
                      "bg-white/[0.01] hover:bg-white/[0.04] transition-colors",
                      onIocClick && "cursor-pointer"
                    )}
                  >
                    <code className="text-[10px] font-mono text-white/60 truncate">{ioc.value}</code>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ioc.attackStage && (
                        <span className="text-[8px] font-mono text-purple-400/50 border border-purple-500/15 rounded px-1">
                          {ioc.attackStage}
                        </span>
                      )}
                      <span className="text-[9px] font-mono text-white/20">{ioc.count}×</span>
                    </div>
                  </div>
                ))}
                {kindIocs.length > 20 && (
                  <p className="text-[9px] font-mono text-white/20 text-center">+{kindIocs.length - 20} more</p>
                )}
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}
