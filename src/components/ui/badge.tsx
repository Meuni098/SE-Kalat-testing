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
    default: "bg-[#FFF4E0] text-[#3B0A0F] border-[#EBD3B2]",
    primary: "bg-[#A60212] text-[#FFF4E0] border-[#85010E]",
    accent: "bg-[#F5AB29] text-[#3B0A0F] border-[#D97B1A]",
    danger: "bg-[#FEE2E2] text-[#A60212] border-[#FECACA]",
    support: "bg-[#D97B1A] text-[#FFFFFF] border-[#B3600E]",
    outline: "bg-[#FFFFFF] text-[#3B0A0F] border-[#EBD3B2]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
