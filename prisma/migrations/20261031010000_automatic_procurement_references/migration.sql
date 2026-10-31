-- Existing document numbers stay unchanged. New procurement references are system issued.
CREATE SEQUENCE "ProcurementReferenceSequence" AS BIGINT MINVALUE 1 START WITH 1 NO CYCLE;
SELECT setval('"ProcurementReferenceSequence"'::regclass,
  GREATEST(COALESCE(MAX(value), 0), 1), COALESCE(MAX(value), 0) >= 1)
FROM (
  SELECT substring("poNumber" FROM '^BULSU-AMO-PO-([0-9]+)$')::bigint AS value FROM "IntakeRecord"
  UNION ALL
  SELECT substring("deliveryReceiptNo" FROM '^BULSU-AMO-DR-([0-9]+)$')::bigint AS value FROM "IntakeRecord"
) AS existing;

CREATE UNIQUE INDEX "IntakeRecord_generated_po_unique" ON "IntakeRecord" ("poNumber")
  WHERE "poNumber" ~ '^BULSU-AMO-PO-[0-9]+$';
CREATE UNIQUE INDEX "IntakeRecord_generated_dr_unique" ON "IntakeRecord" ("deliveryReceiptNo")
  WHERE "deliveryReceiptNo" ~ '^BULSU-AMO-DR-[0-9]+$';
