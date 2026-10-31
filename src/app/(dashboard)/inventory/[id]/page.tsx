import { TransactionAttribution } from "@/components/audit/transaction-attribution";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AssetIdentityCard } from "@/components/inventory/asset-identity-card";
import { LifecycleTimeline, TimelineEvent } from "@/components/inventory/lifecycle-timeline";
import { QrVerifiedCard } from "@/components/inventory/qr-verified-card";
import { getItemReceiptsAction } from "@/actions/receiving-custodian-actions";

export const dynamic = "force-dynamic";

interface AssetDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const viewer = await getSession();
  if (!viewer) notFound();
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      category: true,
      unit: true,
      accountablePerson: true,
      inspections: { include: { inspector: true } },
      transferRequests: { include: { fromUnit: true, toUnit: true, requestedBy: true } },
      physicalCountEntries: { include: { session: true } },
      missingReports: { include: { reportedBy: true } },
      disposals: true,
    },
  });

  if (!asset || asset.isDeleted || (viewer.role === "CUSTODIAN" && asset.unitId !== viewer.unitId)) {
    notFound();
  }

  const allUnits = await prisma.unit.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  // Construct chronological lifecycle events
  const events: TimelineEvent[] = [];
  const receipts = await getItemReceiptsAction({ assetId: asset.id });
  if (receipts.success) {
    for (const receipt of receipts.data.items) {
      events.push({ id: `receipt-${receipt.id}`, date: new Date(receipt.receivedAt),
        title: `Item Received by ${receipt.receiverName}`,
        description: `${receipt.unitCode} · ${receipt.receiverEmployeeNo}. ${receipt.remarks}`,
        icon: "assignment_ind", dotColor: "bg-[#D97B1A]",
        metadata: `Recorded by ${receipt.recordedByName} · Receipt recorded`,
      });
    }
  }

  // 1. Initial Intake / Registration
  events.push({
    id: `acq-${asset.id}`,
    date: asset.acquisitionDate,
    title: "Procurement Intake & Master Registration",
    description: `Asset registered into AMO Ledger with classification ${asset.classification}. Assigned product code ${asset.propertyNo}.`,
    icon: "inventory",
    dotColor: "bg-[#A60212]",
    metadata: `Cost: ₱${asset.acquisitionCost.toLocaleString()} • Initial Condition: ${asset.condition}`,
  });

  // 2. Inspections
  for (const ins of asset.inspections) {
    events.push({
      id: `ins-${ins.id}`,
      date: ins.inspectedAt,
      title: `Technical Inspection: ${ins.result}`,
      description: ins.remarks || "Conforming to technical specifications with zero defects.",
      icon: "verified",
      dotColor: "bg-[#F5AB29]",
      metadata: `Inspector: ${ins.inspector.name}`,
    });
  }

  // 3. Custody Transfers
  for (const tr of asset.transferRequests) {
    events.push({
      id: `tr-${tr.id}`,
      date: tr.requestedAt,
      title: `Custody Transfer (${tr.status})`,
      description: `Transfer from ${tr.fromUnit.code} to ${tr.toUnit.code}. ${tr.remarks || ""}`,
      icon: "swap_horiz",
      dotColor: "bg-[#D97B1A]",
      metadata: `Requested by ${tr.requestedBy.name}`,
    });
  }

  // 4. Physical Count Scans
  for (const pc of asset.physicalCountEntries) {
    events.push({
      id: `pc-${pc.id}`,
      date: pc.countedAt,
      title: `Annual Physical Inventory: ${pc.foundStatus.replace(/_/g, " ")}`,
      description: `${pc.session.title}. ${pc.scannedLocation ? `Location: ${pc.scannedLocation}.` : ""} ${pc.remarks || ""}`,
      icon: "qr_code_scanner",
      dotColor: "bg-[#F5AB29]",
      metadata: `Session FY ${pc.session.fiscalYear}`,
    });
  }

  // 5. Missing Reports
  for (const mr of asset.missingReports) {
    events.push({
      id: `mr-${mr.id}`,
      date: mr.reportedAt,
      title: `Missing Property Investigation: ${mr.status}`,
      description: `Last seen at ${mr.locationLastSeen}. Circumstances: ${mr.circumstances}`,
      icon: "assignment_late",
      dotColor: "bg-[#A60212]",
      metadata: `Reported by ${mr.reportedBy.name}`,
    });
  }

  // 6. Disposals
  for (const disp of asset.disposals) {
    events.push({
      id: `disp-${disp.id}`,
      date: disp.proposedAt,
      title: `Legal Condemnation & Disposal Docket: ${disp.status}`,
      description: `Docket #${disp.docketNo}. Method: ${disp.method}. Scrap value: ₱${disp.appraisedScrapValue.toLocaleString()}. ${disp.reason}`,
      icon: "gavel",
      dotColor: "bg-[#3B0A0F]",
      metadata: disp.coaApprovalRef || "COA Circular No. 89-296",
    });
  }

  return (
    <div className="space-y-6 pb-16">
      <TransactionAttribution entityType="ASSET" entityId={asset.id} />
      {/* Back Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EBD3B2] flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Link
            href={
              asset.unit.code === "AMO" || asset.unit.code === "STORAGE"
                ? "/inventory/central"
                : "/inventory/transferred"
            }
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A60212] hover:underline"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>
              Back to{" "}
              {asset.unit.code === "AMO" || asset.unit.code === "STORAGE"
                ? "AMO Central Holdings"
                : "Transferred in Colleges"}
            </span>
          </Link>
          <span className="text-[#EBD3B2]">|</span>
          <Link
            href="/inventory"
            className="text-xs font-semibold text-[#6E2B32] hover:text-[#3B0A0F] hover:underline"
          >
            Master Registry
          </Link>
        </div>
        <span className="text-xs font-mono text-[#6E2B32]">
          Official COA Asset Dossier
        </span>
      </div>

      {/* 2-Column Grid (8fr / 4fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Identity & Timeline */}
        <div className="lg:col-span-8 space-y-6">
          <AssetIdentityCard asset={asset} allUnits={allUnits} />
          <LifecycleTimeline events={events} />
        </div>

        {/* Right Column (4 cols): QR Card & Custodian Card */}
        <div className="lg:col-span-4 space-y-6">
          <QrVerifiedCard
            propertyNo={asset.propertyNo}
            assetName={asset.name}
            unitCode={asset.unit.code}
          />

          {/* Received By Card */}
          <div className="bg-[#FFFFFF] border border-[#EBD3B2] rounded p-5 select-none">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#3B0A0F] pb-2 border-b border-[#EBD3B2]">
              College &amp; Received By
            </h3>

            <div className="mt-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded bg-[#FFF4E0] border border-[#EBD3B2] flex items-center justify-center text-[#A60212]">
                <span className="material-symbols-outlined text-[22px]">badge</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#3B0A0F]">
                  {asset.accountablePerson?.fullName || "Unassigned"}
                </p>
                <p className="text-[11px] text-[#6E2B32]">
                  {asset.accountablePerson?.position || "Storage Pool"}
                </p>
                <p className="text-[10px] text-[#A60212] font-mono mt-0.5">
                  Unit: {asset.unit.name} ({asset.unit.code})
                </p>
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
