import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { PropertyClearanceModal } from "@/components/people/property-clearance-modal";

export const dynamic = "force-dynamic";

export default async function FacultyStaffPage() {
  await getSession();

  const staff = await prisma.person.findMany({
    include: {
      unit: true,
      assets: {
        include: { category: true },
      },
    },
    orderBy: { fullName: "asc" },
  });

  const totalAssignedValue = staff.reduce((total, p) => {
    return total + p.assets.reduce((sum, a) => sum + (a.acquisitionCost || 0), 0);
  }, 0);

  const staffWithAssetsCount = staff.filter((p) => p.assets.length > 0).length;

  return (
    <div className="space-y-6 pb-16 select-none">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-border p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          <h1 className="text-2xl font-black text-[#3B0A0F] tracking-tight uppercase mt-1">
            Faculty &amp; Staff Asset Custody Directory
          </h1>
        </div>

      </div>

      {/* KPI Overview Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Faculty &amp; Staff Registered
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {staff.length} <span className="text-xs font-normal text-[#6E2B32]">Employees</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">badge</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Staff With Active Custody
            </span>
            <span className="text-2xl font-black text-[#A60212] font-mono mt-0.5 block">
              {staffWithAssetsCount}{" "}
              <span className="text-xs font-normal text-[#6E2B32]">Holding Property</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#A60212] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-border p-4 rounded flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#6E2B32] uppercase tracking-wider block">
              Total Custody Valuation
            </span>
            <span className="text-2xl font-black text-[#3B0A0F] font-mono mt-0.5 block">
              {formatCurrency(totalAssignedValue)}
            </span>
          </div>
          <div className="w-10 h-10 rounded bg-cream border border-border text-[#D97B1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </div>
        </div>
      </div>

      {/* Main Staff Directory Table */}
      <div className="bg-[#FFFFFF] border border-border rounded shadow-sm overflow-hidden">
        <div className="bg-[#3B0A0F] px-4 py-3 border-b border-[#4E1117] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F5AB29] text-[20px]">group</span>
            <span className="text-xs font-bold text-[#FFF4E0] uppercase tracking-wider">
              Faculty / Staff Custody Register
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded border badge-solid badge-amber">
            {staff.length} Personnel
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-cream text-[#3B0A0F] border-b border-border font-black uppercase text-[11px]">
                <th className="py-2.5 px-3">Employee No.</th>
                <th className="py-2.5 px-3">Full Name &amp; Position</th>
                <th className="py-2.5 px-3">Campus Unit / College</th>
                <th className="py-2.5 px-3">Issued Assets</th>
                <th className="py-2.5 px-3">Total Asset Valuation</th>
                <th className="py-2.5 px-3">Clearance Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((p) => {
                const totalVal = p.assets.reduce((sum, a) => sum + (a.acquisitionCost || 0), 0);
                const isCleared = p.assets.length === 0;

                return (
                  <tr key={p.id} className="hover:bg-cream transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#A60212]">
                      {p.employeeNo}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-[#3B0A0F] block">{p.fullName}</span>
                      <span className="text-[11px] text-[#6E2B32]">{p.position}</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-[#3B0A0F] block">{p.unit.code}</span>
                      <span className="text-[10px] text-[#6E2B32]">{p.unit.name}</span>
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-[#3B0A0F]">
                      {p.assets.length} item(s)
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-[#A60212]">
                      {formatCurrency(totalVal)}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={` inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider  badge-solid ${
                          isCleared
                            ? "border badge-solid badge-green"
                            : "border badge-solid badge-amber"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{isCleared ? "CLEARED" : `${p.assets.length} ACTIVE`}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <PropertyClearanceModal
                        personId={p.id}
                        fullName={p.fullName}
                        employeeNo={p.employeeNo}
                        unitCode={p.unit.code}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
