"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SessionUser } from "@/lib/auth";

interface HeaderProps {
  user: SessionUser | null;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = React.useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/inventory?search=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 right-0 left-[260px] h-16 bg-[#FFFFFF] border-b border-border z-30 px-6 flex items-center justify-between select-none">
      {/* Breadcrumb Left */}
      <div className="flex items-center gap-2 text-sm">
        <Image src="/branding/bulsu-main-campus.png" alt="Bulacan State University seal" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
        <span className="text-[#6E2B32] font-semibold">BULSU-MAIN CAMPUS</span>
        <span className="text-[#EBD3B2]">/</span>
        <span className="text-[#3B0A0F] font-bold">Property &amp; Equipment Ledger</span>
        <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-bold border font-mono badge-solid badge-maroon">
          FY 2024–2025
        </span>
      </div>

      {/* Center-Right Operational Controls */}
      <div className="flex items-center gap-4">
        {/* Global Fast Search */}
        <form onSubmit={handleSearch} className="relative w-[300px]">
          <span className="material-symbols-outlined absolute left-3 top-2 text-[#6E2B32] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search product code, serial, or unit..."
            className="w-full h-9 bg-cream pl-9 pr-3 rounded border border-border text-xs font-medium text-[#3B0A0F] placeholder-[#6E2B32] focus:outline-none focus:border-[#A60212]"
          />
        </form>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/scanner"
            className="h-9 px-3 rounded bg-[#FFFFFF] border border-border hover:bg-cream text-[#3B0A0F] font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#A60212]">
              qr_code_scanner
            </span>
            <span>QR Scanner</span>
          </Link>

          <Link
            href="/reports/inventory"
            className="h-9 px-3 rounded bg-[#FFFFFF] border border-border hover:bg-cream text-[#3B0A0F] font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#D97B1A]">
              bar_chart
            </span>
            <span>COA Reports</span>
          </Link>

          <Link
            href="/intake"
            className="h-9 px-3.5 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-1.5 border border-[#A60212] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>New Intake</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
