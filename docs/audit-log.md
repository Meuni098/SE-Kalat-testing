# Audit Log and My Activity

The audit system records the account performing an application action separately from the people receiving, releasing or approving property.

## Access

- **My Activity** (`/account/my-activity`) shows the signed-in active account's own permitted history.
- **Audit Log** (`/admin/security-audit`) is available to the authorized ADMIN and AUDITOR roles, with account, date, action and reference filters.
- Related asset and transaction views expose available logger/editor attribution.

Sessions reload current account status and role. Personal-history ownership and transaction payload access are enforced server-side; changing browser filters cannot widen access. Timestamps are stored as UTC instants and displayed in Asia/Manila.

## Capture

New events snapshot account identity at event time. Business changes and their required audit writes commit together. Supported operation IDs and durable retry results prevent ambiguous-response retries from creating duplicate business actions.

Audit records append rather than overwrite. The audit-table trigger rejects update, delete and truncate. This is an application/database control, not a claim that database administrators cannot alter the system or that it provides a cryptographic/legal certification.

Sensitive payload fields are restricted by the audit service. My Activity does not expose terminal IP addresses. Users losing transaction access can retain safe summaries of their own activity while restricted before/after details are withheld.

## Official documents

Account attribution and internal audit payloads are not inserted into official document layouts. Official business history remains separate from internal system-audit rows. Actual receiver, releaser and approver fields retain their business meanings.

## Database and verification

Apply the repository's additive migrations using `npx prisma migrate deploy`, run `npx prisma generate`, and restart the application. Reconcile an existing database's baseline and migration history before deployment; never reset business data as a shortcut.

Run `npm run test:audit`, `npm run test:forms` and `npx tsc --noEmit`. `npm run test:audit:integration` requires a reviewed local PostgreSQL test environment and creates a disposable schema. Keep runtime database permissions limited and migration credentials separate.

Manual checks should confirm that one user's My Activity does not expose another user's entries, revoked roles take effect, rejected actions do not create partial records, and replayed operations do not duplicate results.
