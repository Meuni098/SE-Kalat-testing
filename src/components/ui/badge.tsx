import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "accent" | "danger" | "support" | "outline";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: " badge-solid badge-slate",
    primary: " badge-solid badge-maroon",
    accent: " badge-solid badge-amber",
    danger: "badge-solid badge-crimson",
    support: " badge-solid badge-amber",
    outline: " badge-solid badge-slate",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border select-none badge-solid",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
