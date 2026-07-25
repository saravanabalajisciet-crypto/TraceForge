import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  label?: string;
  title: string;
  description?: string;
  className?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  label,
  title,
  description,
  className,
  align = "center",
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        align === "left" && "items-start text-left",
        className
      )}
    >
      {label && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium text-purple-400 border border-purple-400/20 bg-purple-400/[0.07] tracking-widest uppercase">
          <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
          {label}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
        {title}
      </h2>
      {description && (
        <p className="text-white/50 text-base md:text-lg max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
