export interface PersonSummary {
  id: string;
  employeeNo: string;
  fullName: string;
  position: string;
  email: string | null;
}

export interface ReceivingCustodianRow {
  unit: { id: string; code: string; name: string; unitType: string; campus: string; isActive: boolean };
  person: PersonSummary | null;
  assignedAt: string | null;
  revision: number;
}

export type ReceivingErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION_ERROR" |
  "NOT_FOUND" | "UNIT_INACTIVE" | "PERSON_UNIT_MISMATCH" | "EMPLOYEE_NO_EXISTS" |
  "ALREADY_ASSIGNED" | "NOT_ASSIGNED" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL_ERROR";

export type ActionResult<T> = { success: true; data: T } |
  { success: false; code: ReceivingErrorCode; error: string; fieldErrors?: Record<string, string> };

export interface DirectoryFilters {
  query?: string;
  campus?: string;
  unitType?: string;
  status?: "ALL" | "ASSIGNED" | "UNASSIGNED";
  includeInactive?: boolean;
  page?: number;
}

export interface DirectoryData {
  items: ReceivingCustodianRow[];
  total: number;
  page: number;
  pageSize: 25;
  canManage: boolean;
  unlinked: boolean;
}

export type AssignInput = { unitId: string; expectedRevision: number; reason: string } & (
  { mode: "EXISTING"; personId: string } |
  { mode: "NEW"; person: { employeeNo?: string; fullName: string; position: string; email?: string } }
);

export interface RemoveInput { unitId: string; expectedRevision: number; reason: string }

export interface ReceivingCustodianHistoryEntry {
  id: string;
  unitId: string;
  action: string;
  actorName: string;
  beforePerson: PersonSummary | null;
  afterPerson: PersonSummary | null;
  reason: string;
  revision: number;
  createdAt: string;
}
