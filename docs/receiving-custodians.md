# Receiving custodians and item receipts

Receiver identity is separate from the account logging a transaction and from the person formally accountable for the asset.

## Item receipts

Use **People → Item Receipts** (`/people/item-receipts`) to record the actual person receiving a specific registered item. Select the active unit and item, then use a registered eligible person or enter the supported new-person details. The office contact is an optional suggestion rather than the compulsory receiver for every item.

Receipts preserve receiver, item, unit, remarks, recorder and server-time snapshots. Later edits do not rewrite prior receipt evidence. Receipts do not themselves transfer the item, change accountability, or grant login access. Complete an applicable transfer first when the item belongs in another unit; register unrecorded items before recording their receipt.

ADMIN and STAFF perform supported receipt writes. AUDITOR has read-only access, and CUSTODIAN reads only their linked unit. Server-side checks use the persisted active account and current source state. New-person registration, receipt creation and required audit writes commit atomically. Operation IDs prevent duplicate results after uncertain responses.

## Office designations

The compatibility route `/people/receiving-custodians` maintains the office's receiving designation and history where authorized. It is separate from item-specific receivers and is not required to record every item receipt.

Assignment/replacement/removal preserves existing asset accountability and login roles. Removing a designation does not delete the person or their property responsibilities. Direct-entry person fields belong to the business receiver, not the encoding account.

## Database setup

Apply the full migration history to a new, empty database with `npx prisma migrate deploy`, then generate the Prisma client. For an existing database, verify its baseline and migration history before reconciliation; do not mark a baseline applied blindly or reset existing data.

## Verification

```bash
npx tsx --test tests/receiving-custodian.test.ts tests/manual-person.test.ts
npx tsx tests/receiving-custodian.integration.ts
npx tsc --noEmit
```

Review each integration script's environment and disposable-schema behavior before running it. Browser review should verify manual receiver entry, saved history, role/unit restrictions, conflicting source updates, and safe retry behavior.
