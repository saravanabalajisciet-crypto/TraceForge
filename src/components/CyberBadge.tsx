import { cn } from "@/lib/utils";

interface CyberBadgeProps {
  label: string;
  className?: string;
  variant?: "default" | "purple" | "blue" | "red" | "green" | "yellow" | "zinc";
}

const variantMap: Record<NonNullable<CyberBadgeProps["variant"]>, string> = {
  default: "text-white/60 border-white/10 bg-white/[0.04]",
  purple: "text-purple-400 border-purple-400/25 bg-purple-400/10",
  blue: "text-blue-400 border-blue-400/25 bg-blue-400/10",
  red: "text-red-400 border-red-400/25 bg-red-400/10",
  green: "text-emerald-400 border-emerald-400/25 bg-emerald-400/10",
  yellow: "text-yellow-400 border-yellow-400/25 bg-yellow-400/10",
  zinc: "text-zinc-500 border-zinc-500/25 bg-zinc-500/10",
};

export function CyberBadge({ label, className, variant = "default" }: CyberBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-medium border tracking-wide",
        variantMap[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
