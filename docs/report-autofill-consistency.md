# Report purpose and automatic filling

## Choosing a form

| Report area | Relevant supplied documents |
|---|---|
| Accountable Person Report | PAR for PPE, ICS for semi-expendable items |
| Physical Inventory Reports | RPCPPE and RPCSP |
| Transfer Reports | PTR and ITR |
| Requests & Returns | Return request / returned-item receipt; manual Document Requests |
| Inventory Reports | Related accountability and count forms; none is a generic inventory-list template |
| Category History | Chronological event table, with applicable event-specific supporting forms |

College, category and classification filter records. They do not change the business purpose of a document. **All classifications** keeps the relevant PPE and semi-expendable worksheets together in one Excel file.

## Sources and corrections

Item acknowledgments use recorded receipt identity where available, with current accountability used only by its supported fallback path. Transfers use recorded transaction relationships; physical counts use the latest supported recorded result per item. Missing official numbers, signatures and approvals are not invented.

Automatic Description cells equal the saved description, without product-name prefixes or generated receiver/status/college/date lines. Blank descriptions retain their selected item rows. Genuine remarks and reasons use dedicated fields. Conflicting form-wide values remain blank rather than being attributed to every row.

Applied row corrections follow the selected records; header corrections apply to the worksheet. The field editor limits item targets to active rows. Changing selection, scope or applied values invalidates the old visual preview.

## Layout and verification

Only selected item rows are generated. Keep original headings, columns, fonts, borders, formal signature sections and required copies. Rebase footer positions, formulas, merged ranges, drawings and print bounds when rows are removed or added. Data can wrap within its existing columns; never silently discard a selected record to make a page fit.

Use **Preview document** before downloading. The preview shows the generated data and layout, with worksheet selection and zoom. Office pagination and some native drawing features may differ, so verify printed submissions in their native application.

Run `npm run test:forms`, `npx tsc --noEmit` and the relevant local integration scripts. For a production compilation check, run `npx next build --webpack`.
