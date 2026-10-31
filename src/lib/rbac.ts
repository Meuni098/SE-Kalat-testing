import { SessionUser } from "./auth";

export type UserRole = "ADMIN" | "STAFF" | "CUSTODIAN" | "AUDITOR";

export function canManageReceivingCustodians(role: string): boolean {
  return role === "ADMIN" || role === "STAFF";
}

export function canReadReceivingUnit(role: string, actorUnitId: string | null, unitId: string): boolean {
  return canManageReceivingCustodians(role) || role === "AUDITOR" ||
    (role === "CUSTODIAN" && actorUnitId === unitId);
}

export function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canApproveTransfer(role: UserRole): boolean {
  return role === "ADMIN" || role === "STAFF";
}

export function canManageDisposal(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canConductAudit(role: UserRole): boolean {
  return role === "ADMIN" || role === "STAFF" || role === "AUDITOR";
}

export function canEditAsset(user: SessionUser, assetUnitId?: string | null): boolean {
  if (user.role === "ADMIN" || user.role === "STAFF") return true;
  if (user.role === "CUSTODIAN" && user.unitId && assetUnitId) {
    return user.unitId === assetUnitId;
  }
  return false;
}

export function canExportCOAReports(role: UserRole): boolean {
  return role === "ADMIN" || role === "STAFF" || role === "AUDITOR";
}

export function canViewSecurityAudit(role: UserRole): boolean {
  return role === "ADMIN" || role === "AUDITOR";
}
