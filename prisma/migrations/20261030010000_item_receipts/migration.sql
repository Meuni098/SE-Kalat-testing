-- CreateTable
CREATE TABLE "ItemReceipt" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "receivedByPersonId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverEmployeeNo" TEXT NOT NULL,
    "receiverPosition" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "propertyNo" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemReceipt_operationId_key" ON "ItemReceipt"("operationId");

-- CreateIndex
CREATE INDEX "ItemReceipt_unitId_receivedAt_idx" ON "ItemReceipt"("unitId", "receivedAt");

-- CreateIndex
CREATE INDEX "ItemReceipt_assetId_receivedAt_idx" ON "ItemReceipt"("assetId", "receivedAt");

-- AddForeignKey
ALTER TABLE "ItemReceipt" ADD CONSTRAINT "ItemReceipt_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReceipt" ADD CONSTRAINT "ItemReceipt_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReceipt" ADD CONSTRAINT "ItemReceipt_receivedByPersonId_fkey" FOREIGN KEY ("receivedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReceipt" ADD CONSTRAINT "ItemReceipt_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
