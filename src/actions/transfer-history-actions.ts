"use server";
import { actualProductDescription, productDescriptionInclude } from "@/lib/product-description";
import { AuditLogService } from "@/lib/audit-log-service";
import type { TransactionAttribution } from "@/types/audit-log";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export interface AssetTransferHistoryEvent {
  id: string;
  transferId?: string;
  type: "INTAKE" | "INSPECTION" | "TRANSFER" | "RETURN";
  date: string;
  title: string;
  originUnit: {
    id: string;
    code: string;
    name: string;
  };
  destinationUnit: {
    id: string;
    code: string;
    name: string;
  };
  releasingPerson?: {
    id: string;
    fullName: string;
    position: string;
  } | null;
  receivingPerson?: {
    id: string;
    fullName: string;
    position: string;
  } | null;
  requestedBy: {
    id: string;
    name: string;
  };
  decidedBy?: {
    id: string;
    name: string;
  } | null;
  status: "COMPLETED" | "APPROVED" | "PENDING" | "REJECTED" | "ACCEPTED";
  remarks?: string | null;
  ptrNumber?: string;
  metadata?: string;
}

export interface AssetTransferHistoryPayload {
  assetId: string;
  propertyNo: string;
  assetName: string;
  description?: string | null;
  classification: string;
  categoryName: string;
  acquisitionCost: number;
  acquisitionDate: string;
  currentUnit: {
    id: string;
    code: string;
    name: string;
    unitType: string;
  };
  currentCustodian: {
    id: string;
    fullName: string;
    position: string;
    employeeNo: string;
  } | null;
  isInAmoCustody: boolean;
  canViewAudit: boolean;
  attribution: TransactionAttribution;
  totalTransfersCount: number;
  events: AssetTransferHistoryEvent[];
}

export async function getAssetTransferHistoryAction(
  assetId: string
): Promise<{ success: boolean; data?: AssetTransferHistoryPayload; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "Unauthorized access" };
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        category: true,
        unit: true,
        accountablePerson: true,
        intakeItems: {
          include: {
            intakeRecord: true,
            inspections: { include: { inspector: true } },
          },
        },
        inspections: {
          include: { inspector: true, intakeItem: productDescriptionInclude.inspections.select.intakeItem },
          orderBy: { inspectedAt: "asc" },
        },
        transferRequests: {
          include: {
            fromUnit: true,
            toUnit: true,
            fromPerson: true,
            toPerson: true,
            requestedBy: true,
            decidedBy: true,
          },
          orderBy: { requestedAt: "asc" },
        },
        returnRequests: {
          orderBy: { requestedAt: "asc" },
        },
      },
    });

    if (!asset || (user.role === "CUSTODIAN" && asset.unitId !== user.unitId)) {
      return { success: false, error: "Asset not found" };
    }

    const events: AssetTransferHistoryEvent[] = [];

    // 1. Genesis: Procurement Delivery Intake & Central Receiving Event
    const primaryIntake = asset.intakeItems[0];
    if (primaryIntake?.intakeRecord) {
      const rec = primaryIntake.intakeRecord;
      events.push({
        id: `intake-${rec.id}`,
        type: "INTAKE",
        date: rec.deliveryDate.toISOString(),
        title: "Procurement Delivery Intake & Central Warehousing",
        originUnit: {
          id: "SUPPLIER",
          code: "VENDOR",
          name: rec.supplierName,
        },
        destinationUnit: {
          id: asset.unitId,
          code: "AMO",
          name: "Asset Management Office (Central Holding)",
        },
        releasingPerson: {
          id: "SUPPLIER_AGENT",
          fullName: rec.supplierName,
          position: "Authorized Delivery Courier",
        },
        receivingPerson: asset.accountablePerson
          ? {
              id: asset.accountablePerson.id,
              fullName: asset.accountablePerson.fullName,
              position: asset.accountablePerson.position,
            }
          : {
              id: "AMO_INSPECTOR",
              fullName: "AMO Receiving Custodian",
              position: "Property Inspector",
            },
        requestedBy: {
          id: "SYSTEM",
          name: `PO #${rec.poNumber}`,
        },
        status: "COMPLETED",
        remarks: rec.remarks || `Delivered under DR #${rec.deliveryReceiptNo} & PO #${rec.poNumber}.`,
        metadata: `PO #${rec.poNumber} • DR #${rec.deliveryReceiptNo}`,
      });
    } else {
      // Fallback initial acquisition event for seeded/imported assets
      events.push({
        id: `acq-${asset.id}`,
        type: "INTAKE",
        date: asset.acquisitionDate.toISOString(),
        title: "Initial Property Intake & Ledger Registration",
        originUnit: {
          id: "PROCUREMENT",
          code: "SUPPLY",
          name: "University Procurement Supply Depot",
        },
        destinationUnit: {
          id: asset.unitId,
          code: "AMO",
          name: "Asset Management Office (Central Warehouse)",
        },
        receivingPerson: asset.accountablePerson
          ? {
              id: asset.accountablePerson.id,
              fullName: asset.accountablePerson.fullName,
              position: asset.accountablePerson.position,
            }
          : null,
        requestedBy: {
          id: "SYSTEM",
          name: "AMO Custodial Registry",
        },
        status: "COMPLETED",
        remarks: actualProductDescription(asset) || "Officially registered into university asset inventory.",
        metadata: `Initial Property Tag: ${asset.propertyNo}`,
      });
    }

    // 2. Technical Inspections
    for (const ins of asset.inspections) {
      events.push({
        id: `ins-${ins.id}`,
        type: "INSPECTION",
        date: ins.inspectedAt.toISOString(),
        title: `COA Technical Inspection (${ins.result})`,
        originUnit: {
          id: "AMO",
          code: "AMO",
          name: "Asset Management Office",
        },
        destinationUnit: {
          id: asset.unitId,
          code: asset.unit.code,
          name: asset.unit.name,
        },
        requestedBy: {
          id: ins.inspector.id,
          name: ins.inspector.name,
        },
        status: ins.result === "ACCEPTED" ? "ACCEPTED" : "REJECTED",
        remarks: ins.remarks || "Item conforms to technical specifications with zero defects.",
        metadata: `Inspector: ${ins.inspector.name}`,
      });
    }

    // 3. Custodial Transfer Requests (PTR Movements)
    for (const tr of asset.transferRequests) {
      const ptrIndex = tr.id.substring(0, 8).toUpperCase();
      events.push({
        id: `transfer-${tr.id}`,
        transferId: tr.id,
        type: "TRANSFER",
        date: (tr.decidedAt || tr.requestedAt).toISOString(),
        title: `Property Transfer: ${tr.fromUnit.code} ➔ ${tr.toUnit.code}`,
        originUnit: {
          id: tr.fromUnit.id,
          code: tr.fromUnit.code,
          name: tr.fromUnit.name,
        },
        destinationUnit: {
          id: tr.toUnit.id,
          code: tr.toUnit.code,
          name: tr.toUnit.name,
        },
        releasingPerson: tr.fromPerson
          ? {
              id: tr.fromPerson.id,
              fullName: tr.fromPerson.fullName,
              position: tr.fromPerson.position,
            }
          : null,
        receivingPerson: tr.toPerson
          ? {
              id: tr.toPerson.id,
              fullName: tr.toPerson.fullName,
              position: tr.toPerson.position,
            }
          : null,
        requestedBy: {
          id: tr.requestedBy.id,
          name: tr.requestedBy.name,
        },
        decidedBy: tr.decidedBy
          ? {
              id: tr.decidedBy.id,
              name: tr.decidedBy.name,
            }
          : null,
        status:
          tr.status === "APPROVED"
            ? "APPROVED"
            : tr.status === "REJECTED"
            ? "REJECTED"
            : "PENDING",
        remarks: tr.remarks || "Inter-unit property custody transfer.",
        ptrNumber: `PTR-BULSU-${ptrIndex}`,
        metadata: `PTR-BULSU-${ptrIndex}`,
      });
    }

    // 4. Return Requests
    for (const ret of asset.returnRequests) {
      events.push({
        id: `ret-${ret.id}`,
        type: "RETURN",
        date: (ret.decidedAt || ret.requestedAt).toISOString(),
        title: `Property Surrender / Return (${ret.status})`,
        originUnit: {
          id: asset.unitId,
          code: asset.unit.code,
          name: asset.unit.name,
        },
        destinationUnit: {
          id: "AMO",
          code: "AMO",
          name: "Asset Management Office (Central Salvage / Warehouse)",
        },
        requestedBy: {
          id: ret.returnedBy,
          name: ret.returnedBy,
        },
        status: ret.status === "APPROVED" ? "APPROVED" : "PENDING",
        remarks: ret.reason || "Returned to central custody.",
      });
    }

    // Sort events strictly chronological
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const isInAmoCustody =
      asset.unit.code === "AMO" ||
      asset.unit.code === "STORAGE" ||
      asset.unit.unitType !== "ACADEMIC";

    const payload: AssetTransferHistoryPayload = {
      assetId: asset.id,
      propertyNo: asset.propertyNo,
      assetName: asset.name,
      description: actualProductDescription(asset),
      classification: asset.classification,
      categoryName: asset.category.name,
      acquisitionCost: asset.acquisitionCost,
      acquisitionDate: asset.acquisitionDate.toISOString(),
      currentUnit: {
        id: asset.unit.id,
        code: asset.unit.code,
        name: asset.unit.name,
        unitType: asset.unit.unitType,
      },
      currentCustodian: asset.accountablePerson
        ? {
            id: asset.accountablePerson.id,
            fullName: asset.accountablePerson.fullName,
            position: asset.accountablePerson.position,
            employeeNo: asset.accountablePerson.employeeNo,
          }
        : null,
      isInAmoCustody,
      canViewAudit: ["ADMIN", "AUDITOR"].includes(user.role),
      attribution: await new AuditLogService(prisma, user.id).attribution("ASSET", asset.id),
      totalTransfersCount: asset.transferRequests.length,
      events,
    };

    return { success: true, data: payload };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load transfer history";
    return { success: false, error: errorMsg };
  }
}
