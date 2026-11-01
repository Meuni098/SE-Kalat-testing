import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "danger" | "outline" | "support";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-colors disabled:bg-sand disabled:text-[#6E2B32] disabled:border-border disabled:cursor-not-allowed select-none rounded";

    const variantStyles = {
      primary:
        "bg-[#A60212] text-[#FFF4E0] hover:bg-[#85010E] active:bg-[#6E000A] border border-[#A60212]",
      secondary:
        "bg-[#FFFFFF] text-[#3B0A0F] hover:bg-cream active:bg-sand border border-border",
      accent:
        "bg-[#F5AB29] text-[#3B0A0F] hover:bg-[#D97B1A] active:bg-[#B3600E] border border-[#D97B1A]",
      danger:
        "bg-[#FEE2E2] text-[#A60212] hover:bg-[#FECACA] active:bg-[#FCA5A5] border border-[#FECACA]",
      outline:
        "bg-[#FFFFFF] text-[#A60212] hover:bg-cream active:bg-sand border border-[#A60212]",
      support:
        "bg-[#D97B1A] text-[#FFFFFF] hover:bg-[#B3600E] border border-[#D97B1A]",
    };

    const sizeStyles = {
      sm: "text-xs px-2.5 py-1.5 gap-1.5 h-8",
      md: "text-sm px-4 py-2 gap-2 h-10",
      lg: "text-base px-5 py-2.5 gap-2.5 h-12",
      icon: "w-9 h-9 p-0 items-center justify-center",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
