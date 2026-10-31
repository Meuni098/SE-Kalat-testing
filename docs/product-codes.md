# Automatic product codes and QR labels

Individual registered assets receive server-generated product codes. Catalog product templates do not receive individual-item codes. Existing historical identifiers are retained.

The database sequence and unique constraint protect code allocation. Codes are not reassigned after deletion or failure; gaps are expected. Preserve the sequence when restoring a database and do not reset it while keeping previously issued item records.

## Registration and delivery

Creation uses the audited transaction and operation-replay workflow. Repeating an operation with identical input returns its committed result; reusing the same operation ID with different input is rejected. Delivery writes and required inspection/audit records commit atomically.

QR confirmation and batch selection use the recorded product code. A blocked preview popup should not cause users to repeat registration. Existing asset lookup continues to support authorized historical codes.

## Migration

Apply all migrations with `npx prisma migrate deploy`. Stop incompatible creation writers during cutover, preserve historical codes and allocation state, deploy the updated application, and then resume creation. Do not restore the former random-code writer after migrating the allocator.

## Verification

```bash
npm run test:products
npm run test:products:integration
npm run test:audit
npx tsc --noEmit
npx next build --webpack
```

Integration scripts require local PostgreSQL and use disposable schemas. Read the scripts and environment checks before running them. They cover concurrent allocation, replay, changed-payload conflicts, rollback, delivery quantities, authorization and migration initialization.
