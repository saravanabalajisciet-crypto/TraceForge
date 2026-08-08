"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, ChevronDown, Check, WifiOff } from "lucide-react";
import { SupportedLanguage, SUPPORTED_LANGUAGES } from "@/types/v2";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "traceforge:language";
const DEFAULT_LANG: SupportedLanguage = "en";

interface LanguageSwitcherProps {
  onLanguageChange?: (lang: SupportedLanguage) => void;
  className?: string;
}

export function LanguageSwitcher({ onLanguageChange, className }: LanguageSwitcherProps) {
  const [current, setCurrent] = useState<SupportedLanguage>(DEFAULT_LANG);
  const [open, setOpen] = useState(false);

  // Load persisted preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      if (saved && saved in SUPPORTED_LANGUAGES) {
        setCurrent(saved);
        onLanguageChange?.(saved);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function select(lang: SupportedLanguage) {
    setCurrent(lang);
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    onLanguageChange?.(lang);
  }

  const langs = Object.entries(SUPPORTED_LANGUAGES) as [SupportedLanguage, string][];

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05] transition-all"
        aria-label="Select language"
      >
        <Globe className="w-3 h-3 text-white/40" />
        <span className="text-[11px] font-medium text-white/60">
          {SUPPORTED_LANGUAGES[current]}
        </span>
        <ChevronDown className={cn("w-2.5 h-2.5 text-white/25 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-away */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-white/[0.08] bg-[#0a0a12] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-white/[0.05]">
                <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest">Language</p>
              </div>

              {langs.map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => select(code)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
                >
                  <span className={cn(
                    "text-xs",
                    current === code ? "text-white font-medium" : "text-white/50"
                  )}>{label}</span>
                  {current === code && <Check className="w-3 h-3 text-purple-400" />}
                </button>
              ))}

              {/* Note */}
              <div className="px-3 py-2 border-t border-white/[0.05]">
                <div className="flex items-start gap-1.5">
                  <WifiOff className="w-2.5 h-2.5 text-white/20 flex-shrink-0 mt-0.5" />
                  <p className="text-[8px] font-mono text-white/20 leading-relaxed">
                    Tamil, Hindi &amp; Malayalam use AI translation. English shown as fallback if unavailable.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Hook for consuming language preference ───────────────────────────────────

export function useLanguage(): SupportedLanguage {
  const [lang, setLang] = useState<SupportedLanguage>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      if (saved && saved in SUPPORTED_LANGUAGES) setLang(saved);
    } catch { /* ignore */ }

    // Listen for changes from other tabs / components
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue && e.newValue in SUPPORTED_LANGUAGES) {
        setLang(e.newValue as SupportedLanguage);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return lang;
}
