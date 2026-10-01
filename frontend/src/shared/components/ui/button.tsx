import * as React from "react";
import { cn } from "@/shared/lib/classnames";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variant === "default" &&
            "bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md",
          variant === "secondary" &&
            "bg-secondary text-secondary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary/90 hover:shadow-md",
          variant === "outline" &&
            "border border-border bg-white/90 text-foreground hover:-translate-y-0.5 hover:bg-muted hover:text-foreground hover:shadow-sm dark:bg-stone-900/80 dark:text-stone-200 dark:hover:bg-stone-800 dark:hover:text-white",
          variant === "ghost" && "text-foreground hover:bg-muted hover:text-foreground dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white",
          size === "sm" && "h-8 px-3",
          size === "md" && "h-10 px-4",
          size === "icon" && "size-9",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
