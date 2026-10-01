import * as React from "react";
import { cn } from "@/shared/lib/classnames";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "success" | "warning" | "danger" | "muted";
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        tone === "default" && "bg-primary/10 text-primary ring-primary/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/25",
        tone === "success" && "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
        tone === "warning" && "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
        tone === "danger" && "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25",
        tone === "muted" && "bg-muted text-muted-foreground ring-border dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700",
        className
      )}
      {...props}
    />
  );
}
