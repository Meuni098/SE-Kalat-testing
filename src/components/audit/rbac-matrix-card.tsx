import * as React from "react";

export function RbacMatrixCard() {
  const permissions = [
    {
      feature: "Asset Registry (View & Search)",
      admin: true,
      staff: true,
      custodian: true,
      auditor: true,
    },
    {
      feature: "Register New Property & Classify",
      admin: true,
      staff: true,
      custodian: false,
      auditor: false,
    },
    {
      feature: "Mobile QR Physical Count Verification",
      admin: true,
      staff: true,
      custodian: true,
      auditor: false,
    },
    {
      feature: "Custody Transfer Approval",
      admin: true,
      staff: true,
      custodian: false,
      auditor: false,
    },
    {
      feature: "Report Missing Asset & File Blotter",
      admin: true,
      staff: true,
      custodian: true,
      auditor: false,
    },
    {
      feature: "Legal Disposal & Condemnation Docket",
      admin: true,
      staff: false,
      custodian: false,
      auditor: false,
    },
    {
      feature: "COA RPCPPE & ICS Form Export",
      admin: true,
      staff: true,
      custodian: false,
      auditor: true,
    },
    {
      feature: "Immutable Audit Log & Deduplication",
      admin: true,
      staff: false,
      custodian: false,
      auditor: true,
    },
  ];

  return (
    <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-5 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-[#EBD3B2]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#A60212] text-[20px]">
            security
          </span>
          <h2 className="text-sm font-bold text-[#3B0A0F] uppercase">
            Institutional Role-Based Access Control (RBAC) Matrix
          </h2>
        </div>
        <span className="text-xs font-mono text-[#6E2B32]">
          Philippine Data Privacy Act (RA 10173) Compliant
        </span>
      </div>

      <div className="overflow-x-auto mt-3">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#FFF4E0] border-b border-[#EBD3B2] text-[#3B0A0F] font-bold uppercase text-[11px]">
              <th className="py-2 px-3 border-r border-[#EBD3B2]">System Feature / Domain</th>
              <th className="py-2 px-3 border-r border-[#EBD3B2] text-center w-24">Admin</th>
              <th className="py-2 px-3 border-r border-[#EBD3B2] text-center w-24">Staff</th>
              <th className="py-2 px-3 border-r border-[#EBD3B2] text-center w-24">Custodian</th>
              <th className="py-2 px-3 text-center w-24">COA Auditor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EBD3B2]">
            {permissions.map((p) => (
              <tr key={p.feature} className="hover:bg-[#FFF4E0] transition-colors">
                <td className="py-2 px-3 border-r border-[#EBD3B2] font-semibold text-[#3B0A0F]">
                  {p.feature}
                </td>
                <td className="py-2 px-3 border-r border-[#EBD3B2] text-center">
                  {p.admin ? (
                    <span className="text-[#A60212] font-bold">✓ Full</span>
                  ) : (
                    <span className="text-[#6E2B32]">—</span>
                  )}
                </td>
                <td className="py-2 px-3 border-r border-[#EBD3B2] text-center">
                  {p.staff ? (
                    <span className="text-[#D97B1A] font-bold">✓ Read/Write</span>
                  ) : (
                    <span className="text-[#6E2B32]">—</span>
                  )}
                </td>
                <td className="py-2 px-3 border-r border-[#EBD3B2] text-center">
                  {p.custodian ? (
                    <span className="text-[#3B0A0F] font-bold">✓ Unit Scope</span>
                  ) : (
                    <span className="text-[#6E2B32]">—</span>
                  )}
                </td>
                <td className="py-2 px-3 text-center">
                  {p.auditor ? (
                    <span className="text-[#A60212] font-bold">✓ Read Only</span>
                  ) : (
                    <span className="text-[#6E2B32]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
