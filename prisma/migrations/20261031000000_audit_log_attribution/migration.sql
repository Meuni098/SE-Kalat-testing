ALTER TABLE "AuditLog"
  ADD COLUMN "actorNameSnapshot" TEXT,
  ADD COLUMN "actorRoleSnapshot" TEXT,
  ADD COLUMN "actorKind" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "eventKind" TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "entityReference" TEXT,
  ADD COLUMN "relatedAssetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "operationId" TEXT,
  ADD COLUMN "reason" TEXT;
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt", "id");
CREATE INDEX "AuditLog_actorId_createdAt_id_idx" ON "AuditLog"("actorId", "createdAt", "id");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_id_idx" ON "AuditLog"("entityType", "entityId", "createdAt", "id");
CREATE INDEX "AuditLog_relatedAssetIds_idx" ON "AuditLog" USING GIN ("relatedAssetIds");
CREATE UNIQUE INDEX "AuditLog_operationId_action_entityType_entityId_key" ON "AuditLog"("operationId", "action", "entityType", "entityId");

-- Do not backfill event-time identities from today's account names.
-- A trigger protects application history even when a development DB role owns tables.
CREATE FUNCTION reject_audit_log_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit history is append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON "AuditLog"
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_log_mutation();
