import type { AuditLog } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { logoutAction } from "@/actions/auth-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSession();

  let userRecord = null;
  let recentLogs: AuditLog[] = [];

  if (user?.id) {
    userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      include: { unit: true },
    });

    recentLogs = await prisma.auditLog.findMany({
      where: { actorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  const displayName = userRecord?.name || user?.name || "GLAIZA MARIE E. PASCUAL";
  const displayEmail = userRecord?.email || user?.email || "Not provided";
  const displayRole = userRecord?.role || user?.role || "ADMIN";
  const displayUnit = userRecord?.unit?.name || "Asset Management Office (AMO Central)";
  const displayUnitCode = userRecord?.unit?.code || "AMO";

  return (
    <div className="space-y-6 pb-16 select-none max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#EBD3B2] p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#FFF4E0] text-[#A60212] border border-[#A60212] px-2 py-0.5 rounded text-[11px] font-bold font-mono">
              BULSU INVENTORY SYSTEM
            </span>
            <span className="bg-[#FFF4E0] text-[#6E2B32] border border-[#EBD3B2] px-2 py-0.5 rounded text-[11px] font-mono">
              AUTHENTICATED SESSION
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            User Profile &amp; Account Settings
          </h1>
          <p className="text-xs text-[#6E2B32] font-medium mt-0.5">
            Manage your BulSU inventory credentials, unit authorization scope, and security audit log
          </p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="h-10 px-4 rounded bg-[#3B0A0F] hover:bg-[#A60212] text-[#FFF4E0] font-bold text-xs flex items-center gap-2 border border-[#4E1117] transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Sign Out Session</span>
          </button>
        </form>
      </div>

      {/* Main Profile Grid: 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Profile Card (5 Cols) */}
        <div className="md:col-span-5 space-y-4">
          <div className="bg-[#FFFFFF] border-2 border-[#3B0A0F] rounded p-6 shadow-sm text-center">
            <div className="w-20 h-20 rounded-full bg-[#A60212] text-[#F5AB29] border-4 border-[#F5AB29] flex items-center justify-center font-black text-2xl mx-auto shadow-md">
              {displayName
                .split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>

            <h2 className="text-lg font-black text-[#3B0A0F] uppercase mt-3">{displayName}</h2>
            <span className="bg-[#FFF4E0] border border-[#F5AB29] text-[#D97B1A] text-xs font-bold px-2.5 py-0.5 rounded inline-block mt-1 uppercase">
              {displayRole === "ADMIN" ? "Asset Management • Administrator" : displayRole}
            </span>

            <div className="mt-6 pt-4 border-t border-[#EBD3B2] text-left text-xs space-y-3">
              <div>
                <span className="text-[10px] text-[#6E2B32] font-bold uppercase block">
                  Official Email
                </span>
                <span className="font-mono text-[#3B0A0F] font-semibold">{displayEmail}</span>
              </div>

              <div>
                <span className="text-[10px] text-[#6E2B32] font-bold uppercase block">
                  Assigned Unit / Campus Scope
                </span>
                <span className="text-[#3B0A0F] font-bold">
                  {displayUnitCode} — {displayUnit}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#6E2B32] font-bold uppercase block">
                  COA System Authorization
                </span>
                <span className="text-[#2E7D32] font-bold flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Full Administrative &amp; Custody Access</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Audit Stream (7 Cols) */}
        <div className="md:col-span-7 space-y-4">
          <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded shadow-sm overflow-hidden">
            <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">
                  security
                </span>
                <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
                  Personal Activity Audit Trail
                </span>
              </div>
              <Link
                href="/account/my-activity"
                className="text-[11px] font-bold text-[#F5AB29] hover:underline"
              >
                View My Activity
              </Link>
            </div>

            <div className="divide-y divide-[#EBD3B2] p-2">
              {recentLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6E2B32]">
                  No recent audit activity logged for this user.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 hover:bg-[#FFF4E0]/40 transition-colors flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#A60212] block">{log.action}</span>
                      <span className="text-[11px] text-[#3B0A0F] font-mono">
                        {log.entityType} • Ref #{log.entityId.slice(0, 8)}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#6E2B32] font-mono whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
