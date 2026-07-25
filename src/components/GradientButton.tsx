"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const GradientButton = forwardRef<
  HTMLButtonElement,
  GradientButtonProps
>(({ variant = "primary", size = "md", className, children, ...props }, ref) => {
  const base =
    "relative inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 disabled:opacity-50 disabled:pointer-events-none overflow-hidden";

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  const variants = {
    primary:
      "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-[0_0_24px_rgba(139,92,246,0.3)] hover:shadow-[0_0_32px_rgba(139,92,246,0.5)] hover:from-purple-500 hover:to-blue-500",
    secondary:
      "border border-white/10 bg-white/[0.05] text-white/80 hover:bg-white/[0.08] hover:border-white/20 hover:text-white",
    ghost:
      "text-white/60 hover:text-white hover:bg-white/[0.06]",
  };

  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(base, sizes[size], variants[variant], className)}
      {...(props as React.ComponentPropsWithRef<typeof motion.button>)}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
});

GradientButton.displayName = "GradientButton";
