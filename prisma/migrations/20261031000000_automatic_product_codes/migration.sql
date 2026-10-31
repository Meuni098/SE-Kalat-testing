-- Global product identity, independent of college, year and classification.
-- Stop legacy creation writers before migration/deployment. Existing labels are untouched.
CREATE SEQUENCE "ProductCodeSequence" AS BIGINT MINVALUE 1 START WITH 1 NO CYCLE;

SELECT setval('"ProductCodeSequence"'::regclass,
  GREATEST(COALESCE(MAX(substring("propertyNo" FROM '^BULSU-AMO-([0-9]+)$')::bigint), 0), 1),
  COALESCE(MAX(substring("propertyNo" FROM '^BULSU-AMO-([0-9]+)$')::bigint), 0) >= 1)
FROM "Asset";
