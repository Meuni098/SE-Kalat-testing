import * as React from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  badgeText?: string;
  badgeVariant?: "primary" | "accent" | "danger" | "support";
  trend?: string;
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  badgeText,
  badgeVariant = "primary",
  trend,
  className,
}: KpiCardProps) {
  const badgeColors = {
    primary: "bg-[#FFF4E0] text-[#A60212] border-[#A60212]",
    accent: "bg-[#FFF4E0] text-[#D97B1A] border-[#F5AB29]",
    danger: "bg-[#FEE2E2] text-[#A60212] border-[#FECACA]",
    support: "bg-[#FFF4E0] text-[#3B0A0F] border-[#EBD3B2]",
  };

  return (
    <div
      className={cn(
        "bg-[#FFFFFF] border border-[#EBD3B2] rounded p-5 flex flex-col justify-between select-none",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between text-[#6E2B32]">
          <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
          <span className="material-symbols-outlined text-[20px] text-[#A60212]">{icon}</span>
        </div>
        <div className="text-3xl font-black text-[#3B0A0F] mt-2 font-mono tabular-nums tracking-tight">
          {value}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#EBD3B2] text-xs">
        {subtitle && <span className="text-[#6E2B32] font-medium">{subtitle}</span>}
        {badgeText && (
          <span
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold border font-mono",
              badgeColors[badgeVariant]
            )}
          >
            {badgeText}
          </span>
        )}
        {trend && <span className="text-[11px] font-bold text-[#D97B1A]">{trend}</span>}
      </div>
    </div>
  );
}
