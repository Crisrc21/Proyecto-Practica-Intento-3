import { cn } from "@/shared/lib/classnames";

interface ProgressProps {
  value: number;
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/45", className)}>
      <div
        className="h-full rounded-full bg-emerald-500 transition-all dark:bg-emerald-400"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
