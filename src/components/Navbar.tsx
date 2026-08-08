"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Scenarios", href: "/scenarios" },
  { label: "Investigation", href: "/investigation" },
  { label: "Investigate V2", href: "/investigate/upload" },
  { label: "Report", href: "/report" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl border-b border-white/[0.06]" />

      <nav className="relative max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)] group-hover:shadow-[0_0_24px_rgba(139,92,246,0.6)] transition-shadow duration-300">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base text-white tracking-tight">
            Trace<span className="text-purple-400">Forge</span>{" "}
            <span className="text-white/40 font-normal">AI</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "text-white"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-white/[0.07] border border-white/[0.08]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/40 font-mono">PWNDORA 2026</span>
          </div>
        </div>

        {/* Mobile menu toggle */}
        <button
          aria-label="Toggle navigation menu"
          className="md:hidden text-white/60 hover:text-white transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="relative md:hidden border-t border-white/[0.06] bg-black/80 backdrop-blur-xl"
        >
          <div className="px-6 py-4 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "text-white bg-white/[0.07]"
                      : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}
    </header>
  );
}
