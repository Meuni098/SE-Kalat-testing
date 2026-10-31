"use client";

import * as React from "react";
import { getStaffClearanceAction } from "@/actions/people-actions";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ClearanceModalProps {
  personId: string;
  fullName: string;
  employeeNo: string;
  unitCode: string;
}

export function PropertyClearanceModal({
  personId,
  fullName,
  employeeNo,
  unitCode,
}: ClearanceModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [clearanceData, setClearanceData] = React.useState<any>(null);

  const handleOpen = async () => {
    setIsOpen(true);
    setLoading(true);
    const res = await getStaffClearanceAction(personId);
    setLoading(false);
    if (res?.success) {
      setClearanceData(res.person);
    }
  };

  const handlePrint = () => {
    if (!clearanceData) return;
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>BulSU Certificate of Property Clearance — ${fullName}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; }
            .inst { font-size: 14pt; font-weight: bold; text-transform: uppercase; }
            .office { font-size: 11pt; font-weight: bold; margin-top: 4px; }
            .campus { font-size: 10pt; font-style: italic; }
            .cert-title { text-align: center; font-size: 16pt; font-weight: bold; margin: 30px 0; letter-spacing: 1px; }
            .body-text { font-size: 12pt; line-height: 1.8; text-align: justify; }
            .name { font-weight: bold; text-decoration: underline; }
            .status-box { border: 2px solid #000; padding: 12px; margin: 20px 0; text-align: center; font-weight: bold; font-size: 12pt; }
            .sig-table { width: 100%; margin-top: 60px; font-size: 11pt; }
            .sig-table td { width: 50%; vertical-align: top; }
            .line { border-bottom: 1px solid #000; width: 220px; margin-top: 40px; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="inst">Bulacan State University</div>
            <div class="office">Asset Management Office • Property Custody Division</div>
            <div class="campus">Bustos Campus, Bulacan</div>
          </div>

          <div class="cert-title">CERTIFICATE OF PROPERTY CLEARANCE</div>

          <div class="body-text">
            This is to certify that <strong>${fullName}</strong> (${employeeNo}), assigned to <strong>${unitCode}</strong>, has undergone official property verification in accordance with Commission on Audit (COA) Circular 2020-006.
          </div>

          <div class="status-box">
            ${
              clearanceData.isCleared
                ? "STATUS: CLEARED OF ALL PROPERTY &amp; ASSET LIABILITIES"
                : `STATUS: NOT CLEARED — ${clearanceData.liabilitiesCount} UNACCOUNTED/PENDING ASSET(S)`
            }
          </div>

          ${
            !clearanceData.isCleared
              ? `
            <div style="font-size: 10pt; margin-top: 10px;">
              <strong>Outstanding Property Items:</strong>
              <ul>
                ${clearanceData.liabilities
                  .map((a: any) => `<li>[${a.propertyNo}] ${a.name} — Status: ${a.status}</li>`)
                  .join("")}
              </ul>
            </div>
          `
              : `
            <div class="body-text">
              The records of the Asset Management Office confirm that the above-named employee holds zero (0) active property acknowledgments or equipment custody slips. This clearance is issued for retirement, transfer, separation, or promotional requirements.
            </div>
          `
          }

          <table class="sig-table">
            <tr>
              <td>
                <div>Verified by:</div>
                <div class="line"></div>
                <strong>GLAIZA MARIE E. PASCUAL</strong><br />
                Asset Management Officer
              </td>
              <td>
                <div>Approved by:</div>
                <div class="line"></div>
                <strong>Head of Inventory / AMO Director</strong><br />
                Bulacan State University
              </td>
            </tr>
          </table>

          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <>
      <button
        onClick={handleOpen}
        title="Check and print COA Property Clearance"
        className="h-8 px-2.5 rounded bg-[#FFF4E0] hover:bg-[#EBD3B2] text-[#A60212] font-bold text-xs inline-flex items-center gap-1 border border-[#EBD3B2] transition-colors"
      >
        <span className="material-symbols-outlined text-[15px]">verified_user</span>
        <span>Clearance</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#3B0A0F]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border-2 border-[#A60212] rounded-lg max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#EBD3B2]">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#A60212]">
                  COA Property Accountability Review
                </span>
                <h3 className="text-base font-extrabold text-[#3B0A0F]">
                  Property Clearance Status
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#6E2B32] hover:text-[#3B0A0F] p-1 rounded hover:bg-[#FFF4E0]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-[#6E2B32]">
                Verifying property accountability records...
              </div>
            ) : clearanceData ? (
              <div className="mt-4 space-y-4">
                <div className="bg-[#FFF4E0] border border-[#EBD3B2] p-3 rounded text-xs space-y-1">
                  <div className="font-bold text-[#3B0A0F] text-sm">{fullName}</div>
                  <div className="text-[11px] text-[#6E2B32]">
                    Emp #{employeeNo} • Unit: {unitCode}
                  </div>
                </div>

                <div
                  className={`p-4 rounded border text-center space-y-1 ${
                    clearanceData.isCleared
                      ? "bg-[#E8F5E9] border-[#A5D6A7] text-[#2E7D32]"
                      : "bg-[#FFEBEE] border-[#FFCDD2] text-[#C62828]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[32px] block mx-auto">
                    {clearanceData.isCleared ? "verified" : "warning"}
                  </span>
                  <h4 className="text-sm font-black uppercase">
                    {clearanceData.isCleared
                      ? "CLEARED OF PROPERTY LIABILITIES"
                      : `${clearanceData.liabilitiesCount} UNRETURNED ASSETS PENDING`}
                  </h4>
                  <p className="text-xs">
                    {clearanceData.isCleared
                      ? "Zero active property liabilities found in AMO records. Eligible for official clearance."
                      : "The employee currently holds active assets that must be surrendered or transferred before clearance."}
                  </p>
                </div>

                {!clearanceData.isCleared && (
                  <div className="max-h-[140px] overflow-y-auto space-y-1.5 border border-[#EBD3B2] p-2 rounded bg-white">
                    {clearanceData.liabilities.map((a: any) => (
                      <div
                        key={a.id}
                        className="text-xs flex items-center justify-between p-1.5 bg-[#FFF4E0]/40 rounded"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#A60212]">
                            {a.propertyNo}
                          </span>
                          <span className="block text-[11px] text-[#3B0A0F] truncate max-w-[220px]">
                            {a.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#D97B1A] uppercase">
                          {a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EBD3B2]">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="h-9 px-4 rounded border border-[#EBD3B2] text-[#3B0A0F] text-xs font-bold"
                  >
                    Close
                  </button>
                  <button
                    onClick={handlePrint}
                    className="h-9 px-4 rounded bg-[#A60212] hover:bg-[#85010E] text-[#FFF4E0] font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    <span>Print Clearance Certificate</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
