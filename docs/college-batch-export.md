# College-wide exports

1. Open the relevant report and choose **Export official document**.
2. Keep **All matching records (automatic)** selected.
3. Choose the college / operating unit, product category and classification. Accountable-person, count-session and status filters appear only for applicable purposes.
4. Review the included records, apply any corrections, then select **Preview document**.
5. Use worksheet selection and zoom to review the layout before choosing **Download complete document**.

The server reloads all authorized matching records. Field-review navigation does not limit the exported record set. Each supplied worksheet has a continuous item table; different recipients or dates do not repeat the form. Separate requests involving the same item retain separate rows.

Unused item rows are removed, and overflow rows inherit the template's formatting. Footer fields, formulas and drawing anchors move with the compact table. Both original ICS copies remain in the same workbook. The original-reference download retains its unfilled layout.

A changed source or template invalidates stale requests and requires a refresh. Keep corrections attached to their intended records when reviewing refreshed data. All classifications combines the relevant supplied worksheets in one file; see [classification coverage](all-classifications.md).

## Validation

The forms unit suite is `npm run test:forms`. Local integration scripts include `tests/form-batch.integration.ts`, `tests/form-collections.integration.ts` and `tests/document-preview.integration.ts`. These require the local application, configured database and existing authorized test accounts. Set `REPORT_TEST_BASE_URL` to the intended localhost server; do not run these checks against an unreviewed remote environment.
