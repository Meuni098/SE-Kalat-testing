"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface InventoryNavTabsProps {
  amoCount?: number;
  transferredCount?: number;
  totalCount?: number;
}

export function InventoryNavTabs({
  amoCount,
  transferredCount,
  totalCount,
}: InventoryNavTabsProps) {
  const pathname = usePathname();

  const tabs = [
    {
      name: "AMO Central Holdings",
      subtitle: "In-House / Received Items",
      href: "/inventory/central",
      icon: "warehouse",
      count: amoCount,
      activeColor: "border-[#A60212] text-[#A60212] bg-[#FFFFFF]",
    },
    {
      name: "Transferred in Colleges",
      subtitle: "Deployed Academic Property",
      href: "/inventory/transferred",
      icon: "domain",
      count: transferredCount,
      activeColor: "border-[#A60212] text-[#A60212] bg-[#FFFFFF]",
    },
    {
      name: "Master University Registry",
      subtitle: "Consolidated Master Ledger",
      href: "/inventory",
      icon: "menu_book",
      count: totalCount,
      activeColor: "border-[#A60212] text-[#A60212] bg-[#FFFFFF]",
    },
  ];

  return (
    <div className="flex items-center gap-2 border-b border-border pb-0 bg-[#FAF7F2] p-1 rounded-t select-none overflow-x-auto">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/inventory"
            ? pathname === "/inventory"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-t text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              isActive
                ? `${tab.activeColor} shadow-xs font-black`
                : "border-transparent text-[#6E2B32] hover:text-[#3B0A0F] hover:bg-cream"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                isActive ? "text-[#A60212]" : "text-[#6E2B32]"
              }`}
            >
              {tab.icon}
            </span>

            <div className="flex flex-col text-left">
              <span className="leading-tight">{tab.name}</span>
              <span className="text-[10px] font-normal leading-none">
                {tab.subtitle}
              </span>
            </div>

            {typeof tab.count === "number" && (
              <span
                className={` ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold  badge-solid ${
                  isActive
                    ? "border badge-solid badge-maroon"
                    : "border badge-solid badge-slate"
                }`}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
