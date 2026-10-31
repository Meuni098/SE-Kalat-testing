# Supplied forms and document preview

The application fills registered forms from authorized records. It does not accept client-provided filesystem paths or use an external document viewer.

| Form | Business purpose |
|---|---|
| PAR / ICS | PPE / semi-expendable accountability and item acknowledgment |
| RPCPPE / RPCSP | Physical count results |
| PTR / ITR | Property / inventory transfers |
| Return workbook | PPE return requests and the supplied semi-expendable returned-item receipt |
| Documented Information | A manual request for document copies |

Documented Information is under Requests & Returns, not a substitute for Category History. A pending return request does not prove that an item has physically been received back.

## API and access

The authenticated `/api/export/forms` endpoint provides metadata, matching options, field review, visual preview, history lookup and download. Request filters and record IDs are validated server-side. The persisted active account and its college assignment control access, including when cookie claims or browser filters differ.

Automatic output reloads source records and rejects stale source/template versions. Formula inputs and computed fields remain protected from inappropriate edits. Text stays literal in Excel and is escaped in the sandboxed preview.

Visual previews are private/no-store and do not create download audit events or consume the download allowance. Preview and download use the same generated document and applied changes. The existing size and rate limits protect rendering/export work; oversized previews return an explicit error rather than hide records.

## Preservation

Original forms remain in `resources/export-templates`. Verified legacy-XLS working copies remain in `resources/workbook-templates`; keep the manifest with them. The published references omit personal sample identities while retaining their form layouts.

Generated automatic reports have compact item tables and actual descriptions only. Original-reference previews/downloads retain the supplied unfilled rows. See [the export guide](single-workbook-export.md).

## Verification

Run `npm run test:forms` and `npx tsc --noEmit`. The existing local API integration scripts test selection coverage, stale versions, authorization and preview/download parity. Review representative documents in Excel or Word before relying on their printed pagination.
