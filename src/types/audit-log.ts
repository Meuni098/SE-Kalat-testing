export interface AuditLogQuery {
  fromDate?: string;
  toDate?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  assetId?: string;
  reference?: string;
  cursor?: string;
  limit?: 25 | 50 | 100;
}
export type AuditErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR';
export type AuditResult<T> = { success: true; data: T } | { success: false; code: AuditErrorCode; error: string };
export interface AuditListItem {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  attributionSource: 'SNAPSHOT' | 'CURRENT_ACCOUNT_FALLBACK' | 'UNAVAILABLE';
  action: string;
  entityType: string;
  entityId: string;
  entityReference: string;
  createdAt: string;
  summary: string;
}
export interface AuditDetail extends AuditListItem {
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  ipAddress?: string | null;
  payloadVisible: boolean;
}
export interface AuditPage { items: AuditListItem[]; nextCursor: string | null; hasMore: boolean; }
export interface TransactionAttribution {
  originallyLoggedBy: { name: string; at: string; source: AuditListItem['attributionSource'] } | null;
  lastUpdatedBy: { name: string; at: string; source: AuditListItem['attributionSource'] } | null;
}
