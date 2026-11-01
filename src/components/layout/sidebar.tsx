"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth-actions";
import { SessionUser } from "@/lib/auth";

interface SidebarProps {
  user: SessionUser | null;
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
  roleRequired?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const navigation: NavGroup[] = [
    {
      group: "DASHBOARD",
      items: [
        {
          name: "Dashboard",
          href: "/dashboard",
          icon: "dashboard",
        },
      ],
    },
    {
      group: "INVENTORY",
      items: [
        {
          name: "AMO Central Holdings",
          href: "/inventory/central",
          icon: "warehouse",
        },
        {
          name: "Transferred in Colleges",
          href: "/inventory/transferred",
          icon: "domain",
        },
        {
          name: "Master University Registry",
          href: "/inventory",
          icon: "menu_book",
        },
        {
          name: "Transfer Requests",
          href: "/inventory/transfers",
          icon: "sync_alt",
        },
        {
          name: "Return Requests",
          href: "/inventory/returns",
          icon: "assignment_return",
        },
        {
          name: "QR Scanner",
          href: "/inventory/scanner",
          icon: "qr_code_scanner",
        },
        {
          name: "Generate QR",
          href: "/inventory/generate-qr",
          icon: "qr_code_2",
        },
      ],
    },
    {
      group: "PHYSICAL INVENTORY",
      items: [
        {
          name: "Physical Inventory",
          href: "/physical-inventory",
          icon: "fact_check",
        },
        {
          name: "Inspection Records",
          href: "/physical-inventory/inspections",
          icon: "schedule",
        },
        {
          name: "Other",
          href: "/physical-inventory/other",
          icon: "inventory",
        },
      ],
    },
    {
      group: "PEOPLE",
      items: [
        {
          name: "Item Receipts",
          href: "/people/item-receipts",
          icon: "assignment_ind",
        },
        {
          name: "Faculty/Staff Inventory",
          href: "/people/faculty-staff",
          icon: "badge",
        },
      ],
    },
    {
      group: "MASTER DATA",
      items: [
        {
          name: "Colleges & Units",
          href: "/master-data/colleges",
          icon: "domain",
          roleRequired: "STAFF",
        },
        {
          name: "Product Categories",
          href: "/master-data/categories",
          icon: "category",
          roleRequired: "STAFF",
        },
        {
          name: "Product Catalog",
          href: "/master-data/products",
          icon: "inventory_2",
          roleRequired: "STAFF",
        },
      ],
    },
    {
      group: "REPORTS",
      items: [
        {
          name: "Inventory Reports",
          href: "/reports/inventory",
          icon: "bar_chart",
        },
        {
          name: "Category History Export",
          href: "/reports/category-history",
          icon: "history_edu",
        },
        {
          name: "Accountable Person Report",
          href: "/reports/accountable-person",
          icon: "assignment_ind",
        },
        {
          name: "Physical Inventory Reports",
          href: "/reports/physical-inventory",
          icon: "assignment_turned_in",
        },
        {
          name: "Transfer Reports",
          href: "/reports/transfers",
          icon: "receipt_long",
        },
        {name:"Requests & Returns",href:"/reports/requests-returns",icon:"assignment_return"},
      ],
    },
    {
      group: "OPERATIONS & CONTROL",
      items: [
        {
          name: "Procurement Delivery Intake",
          href: "/intake",
          icon: "local_shipping",
        },
        {
          name: "Missing Item Desk",
          href: "/missing",
          icon: "assignment_late",
        },
        {
          name: "Legal Disposal & Auction",
          href: "/disposal",
          icon: "gavel",
        },
        {
          name: "Data Deduplication Engine",
          href: "/data-engine/deduplication",
          icon: "auto_fix_high",
        },
        {
          name: "Audit Log",
          href: "/admin/security-audit",
          icon: "admin_panel_settings",
          roleRequired: "AUDITOR",
        },
      ],
    },
    {
      group: "ACCOUNT",
      items: [
        { name: "My Activity", href: "/account/my-activity", icon: "history" },
        {
          name: "Profile",
          href: "/account/profile",
          icon: "account_circle",
        },
      ],
    },
  ];

  const getInitials = (name?: string) => {
    if (!name) return "GP";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const displayName = user?.name || "GLAIZA MARIE E. PASCUAL";
  const displayRole = user?.role === "ADMIN" ? "Asset Management" : (user?.role || "Asset Management");

  return (
    <aside className="w-[260px] min-w-[260px] h-screen bg-[#3B0A0F] border-r border-[#4E1117] flex flex-col justify-between select-none fixed top-0 left-0 z-40">
      {/* University brand */}
      <div className="flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#4E1117] bg-[#32080C]">
          <Image src="/branding/bulsu-main-campus.png" alt="Bulacan State University seal" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" />
          <div className="flex flex-col">
            <span className="text-xs font-black text-[#FFF4E0] tracking-tight uppercase leading-tight font-sans">
              BULSU-MAIN CAMPUS
            </span>
            <span className="text-[11px] text-[#F5AB29] font-bold tracking-wide leading-tight">
              Inventory System
            </span>
            <span className="text-[9px] text-[#EBD3B2] font-semibold leading-none mt-1 ">
              AMO Property Division
            </span>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex flex-col space-y-3.5 px-2 py-2 overflow-y-auto max-h-[calc(100vh-230px)] scrollbar-thin scrollbar-thumb-[#6E2B32]">
          {navigation.map((group) => {
            const filteredItems = group.items.filter(
              (item) => !item.roleRequired || user?.role === "ADMIN" || user?.role === item.roleRequired
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={group.group} className="flex flex-col space-y-0.5">
                <span className="text-[10px] uppercase font-black tracking-wider text-[#F5AB29] px-3 py-1 ">
                  {group.group}
                </span>
                {filteredItems.map((item) => {
                  const isActive =
                    item.href === "/inventory"
                      ? pathname === "/inventory"
                      : pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));


                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-[#F5AB29] text-[#3B0A0F] font-bold shadow-sm"
                          : "text-[#FFF4E0] hover:bg-[#4E1117] hover:text-[#F5AB29]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`material-symbols-outlined text-[17px] ${
                            isActive ? "text-[#3B0A0F]" : "text-[#EBD3B2]"
                          }`}
                          style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          {item.icon}
                        </span>
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded badge-solid badge-amber">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer User Profile & System Controls */}
      <div className="p-2.5 border-t border-[#4E1117] flex flex-col gap-1.5 bg-[#32080C]">
        <div className="bg-[#4E1117] border border-[#6E2B32] rounded p-2 flex items-center justify-between">
          <Link href="/account/profile" className="flex items-center gap-2 overflow-hidden transition-opacity">
            <div className="w-8 h-8 rounded bg-[#A60212] text-[#F5AB29] flex items-center justify-center font-black text-xs border border-[#F5AB29] flex-shrink-0">
              {getInitials(displayName)}
            </div>
            <div className="flex flex-col overflow-hidden max-w-[135px]">
              <span className="text-[#FFF4E0] text-[11px] font-extrabold truncate leading-tight uppercase">
                {displayName}
              </span>
              <span className="text-[10px] text-[#F5AB29] font-bold truncate">
                {displayRole}
              </span>
            </div>
          </Link>
          <button
            onClick={() => logoutAction()}
            title="Logout"
            className="text-[#EBD3B2] hover:text-[#FFF4E0] p-1.5 rounded hover:bg-[#6E2B32] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1 text-[9px] text-[#EBD3B2]">
          <span>BULSU-MAIN CAMPUS • COA 2020-006</span>
          <span className="font-mono text-[#F5AB29] font-bold">v3.0-CAMPUS</span>
        </div>
      </div>
    </aside>
  );
}
