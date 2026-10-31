-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "receivingCustodianAssignedAt" TIMESTAMP(3),
ADD COLUMN     "receivingCustodianId" TEXT,
ADD COLUMN     "receivingCustodianRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Unit_receivingCustodianId_key" ON "Unit"("receivingCustodianId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_receivingCustodianId_fkey" FOREIGN KEY ("receivingCustodianId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
