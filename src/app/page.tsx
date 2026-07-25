"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Terminal,
  Network,
  Brain,
  ChevronRight,
  Layers,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { SectionHeader } from "@/components/SectionHeader";
import { ScenarioCard } from "@/components/ScenarioCard";
import { scenarios } from "@/data/scenarios";

const FADE_UP = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const features = [
  {
    icon: <Terminal className="w-5 h-5" />,
    title: "Real Evidence Artifacts",
    description:
      "Analyze actual log files, memory dumps, and network captures from simulated breach scenarios.",
  },
  {
    icon: <Network className="w-5 h-5" />,
    title: "Timeline Reconstruction",
    description:
      "Piece together the attack narrative by correlating evidence across the kill chain.",
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: "MITRE ATT&CK Mapping",
    description:
      "Map discovered techniques to the ATT&CK framework for structured adversary profiling.",
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: "AI-Powered Coaching",
    description:
      "Get real-time hints and explanations from an AI coach powered by Gemini.",
  },
];

export default function HomePage() {
  return (
    <AppLayout>
      {/* ── Hero ── */}
      <section className="relative min-h-[calc(100vh-64px)] flex items-center justify-center overflow-hidden px-6">
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Glow orbs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[200px] bg-blue-600/8 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center flex flex-col items-center gap-8 py-20">
          {/* Label */}
          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/20 bg-purple-500/[0.06] text-purple-400 text-xs font-mono tracking-widest uppercase"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            PWNDORA CyberDev Summit 2026
            <ChevronRight className="w-3 h-3 opacity-50" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            {...FADE_UP}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05]"
          >
            Learn Digital Forensics{" "}
            <span className="block mt-1 bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              by Reconstructing
            </span>
            Real Cyber Attacks
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            {...FADE_UP}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg text-white/50 max-w-2xl leading-relaxed"
          >
            Interactive Incident Timeline Reconstruction Platform for PWNDORA.
            Investigate real-world breach scenarios, correlate evidence, and map
            adversary behavior to MITRE ATT&CK.
          </motion.p>

          {/* CTA */}
          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Link href="/scenarios">
              <GradientButton size="lg">
                Start Investigation
                <ArrowRight className="w-4 h-4" />
              </GradientButton>
            </Link>
            <Link href="/scenarios">
              <GradientButton variant="secondary" size="lg">
                View Scenarios
              </GradientButton>
            </Link>
          </motion.div>

          {/* Stats row */}
          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-8 pt-4"
          >
            {[
              { value: "3", label: "Scenarios" },
              { value: "50+", label: "Evidence Artifacts" },
              { value: "MITRE", label: "ATT&CK Mapped" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/30 font-mono uppercase tracking-widest mt-0.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Featured Scenarios ── */}
      <section className="px-6 py-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SectionHeader
            label="Active Scenarios"
            title="Choose Your Investigation"
            description="Each scenario is based on real-world attack patterns, curated for hands-on forensic analysis training."
            className="mb-12"
          />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scenarios.map((scenario, i) => (
            <ScenarioCard key={scenario.id} scenario={scenario} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex justify-center mt-10"
        >
          <Link href="/scenarios">
            <GradientButton variant="secondary">
              View all scenarios
              <ArrowRight className="w-4 h-4" />
            </GradientButton>
          </Link>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-24 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionHeader
              label="Platform"
              title="Built for Real Forensic Analysis"
              description="TraceForge AI combines structured investigation workflows with AI-powered guidance."
              className="mb-12"
            />
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <GlassCard hover className="p-5 h-full">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed">{f.description}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">
              Trace<span className="text-purple-400">Forge</span>{" "}
              <span className="text-white/30">AI</span>
            </span>
          </div>
          <p className="text-xs text-white/25 font-mono">
            Built for PWNDORA CyberDev Summit 2026 · DFIR Investigation Platform
          </p>
        </div>
      </footer>
    </AppLayout>
  );
}
