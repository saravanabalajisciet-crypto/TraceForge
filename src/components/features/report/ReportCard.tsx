import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

interface ReportCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}

export function ReportCard({
  title,
  icon,
  children,
  className,
  accentColor = "text-purple-400",
}: ReportCardProps) {
  return (
    <GlassCard className={cn("p-6", className)}>
      <div className="flex items-center gap-2.5 mb-4">
        <span className={cn("w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0", accentColor)}>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>
      </div>
      {children}
    </GlassCard>
  );
}
