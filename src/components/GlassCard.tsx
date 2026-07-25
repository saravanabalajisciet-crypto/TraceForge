"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function GlassCard({
  children,
  className,
  hover = false,
  glow = false,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.4)]",
        glow && "shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_32px_rgba(139,92,246,0.08)]",
        hover &&
          "transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.05] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_16px_48px_rgba(0,0,0,0.5)]",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
