import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({ className, lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-3 animate-pulse", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 rounded-lg bg-white/[0.05]",
            i === 0 && "w-3/4",
            i === 1 && "w-full",
            i === 2 && "w-1/2",
            i > 2 && "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 animate-pulse",
        className
      )}
    >
      <div className="h-4 w-1/3 rounded-lg bg-white/[0.06] mb-4" />
      <div className="h-3 w-full rounded-lg bg-white/[0.04] mb-2" />
      <div className="h-3 w-4/5 rounded-lg bg-white/[0.04] mb-6" />
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded-md bg-white/[0.05]" />
        <div className="h-6 w-20 rounded-md bg-white/[0.05]" />
      </div>
    </div>
  );
}
