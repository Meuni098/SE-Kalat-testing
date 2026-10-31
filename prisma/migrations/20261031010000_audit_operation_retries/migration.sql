CREATE TABLE "AuditOperation" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuditOperation_actorId_operationId_key" ON "AuditOperation"("actorId", "operationId");
