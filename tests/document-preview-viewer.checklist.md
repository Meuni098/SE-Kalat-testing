# Document preview verification

Implemented November 1, 2026 using `../feature-implementation-prompt.md` and `../feature-spec-document-preview-fidelity.md`.

## Behavior

- Open Reports → Export official document → Preview document.
- Fit width is the default and never enlarges the artifact above 100%. All worksheets use the widest visible sheet; select PAR or Sheet26 to fit an individual worksheet.
- Actual size and numeric zoom retain source column geometry. Scroll within the document to reach content at larger zoom.
- Expand preview opens a native modal; Collapse or Escape returns to the preparation window with worksheet and zoom unchanged and focus on Expand preview.
- A new generated preview resets to Fit width. Resizing does not change a numeric zoom selection.
- Word uses the label Document. Spreadsheet selectors count worksheets, not printed pages.
- Preview remains an approximate HTML rendering. Office typography, unsupported objects, source clipping, and printed pagination are not guaranteed to match.

## Implementation boundaries

Export generation, binary templates, database schema, and download routes are unchanged. The preview response adds optional `sheets[].width` in CSS pixels (including paper padding for Word), measured by the server-side renderer. This allows fitting without scripts or same-origin access inside the sandbox. Older responses fall back to the existing Word paper width.

`src/lib/document-preview-view.ts` owns validated zoom and ordinal worksheet selection. No sheet ID is interpolated into CSS. `DocumentLayoutPreviewPanel` measures only its outer container, coalesces resize updates with animation frames, and releases observers on unmount. No new dependencies or environment variables.

Nested preview dialog cancel/close events stop propagation so they do not close the containing export dialog. Background page scrolling is locked while expanded and restored when collapsed or unmounted.

## Automated checks

Run from the application directory:

```powershell
npm run test:forms
npx tsc --noEmit
npm run lint
$env:REPORT_TEST_BASE_URL='http://localhost:3000'
npx tsx tests/document-preview.integration.ts
```

The integration harness requires the local database and an active administrator. It reads authorized report data and creates normal download audit entries; it does not seed or modify business records. The local data must include both classifications to exercise combined coverage. It compares decompressed Office parts before and after preview, ignoring only ZIP metadata and Office generation timestamps, and checks filenames, MIME types, audit behavior, stale sources, original references, manual Word values, and unauthenticated requests.

Unit fixtures cover hidden columns, merged cells, row dimensions, wrapping, borders, number formatting, empty worksheets, repeated rendering, input-buffer immutability, legacy XLS, DOCX page geometry and conflicting table widths, malicious literal text, size limits, and fit/zoom validation.

## Browser checks

Use the development server's configured `localhost` origin. The separately running production server on port 3002 serves its previous build until rebuilt; it does not hot reload source changes. Development resources can be blocked when accessed through a different origin such as `127.0.0.1`.

| Scenario | Expected result |
|---|---|
| Filled PAR + ICS at 1280×720, 1920×1080, and 375×812 | In Fit width, iframe document scrollWidth equals clientWidth; all columns fit. |
| Select PAR, then ICS | Only selected worksheet visible; Fit width recalculates. |
| 150% at 375px width | Horizontal document scrolling available; entire paper reachable. |
| 125%, then resize | 125% retained. |
| Expand, then Escape | Only preview collapses; preparation dialog stays open; focus returns to Expand preview. |
| Expand, then Collapse | Same selection/zoom retained; no duplicate iframe remains. |
| Preview original after filled preview | New artifact resets to Fit width and retains original-reference labeling. |
| Original PAR `.xls` | Template title and one PAR worksheet rendered. |
| Document request `.docx` | Requestor and purpose tables remain available; label is Document. |
| Retry, stale input, changed scope, access failure | Existing protections apply; old protected content is removed on known access failure. |

## Recorded results

- Final form/export suite: all 111 tests passed, including viewer and Word geometry regressions.
- API integration on the development checkout: passed, including unchanged normalized export parts and preview-versus-download audit behavior.
- TypeScript check: passed.
- Lint of changed source and test files: passed.
- Repository lint: seven existing `no-explicit-any` errors in `src/actions/people-actions.ts`, `src/app/(dashboard)/master-data/page.tsx`, and `src/components/people/property-clearance-modal.tsx`; unrelated warnings also remain.
- Browser: desktop/mobile fit, worksheet switching, numeric zoom, resize persistence, original XLS, DOCX, Escape, Collapse, and focus restoration verified. Browser checks exposed nested dialog event propagation and Word table-grid overflow; both were corrected and retested. The Word paper's scrollWidth now equals its clientWidth at mobile size, and the containing iframe has no horizontal overflow in Fit width.
- Screenshots: `.qa/preview-fidelity/par-desktop.jpg` and `.qa/preview-fidelity/word-mobile.jpg`.
- Existing dashboard navigation has a fixed desktop sidebar. The expanded viewer fits mobile width; this feature does not redesign the surrounding dashboard for mobile.

## Follow-up boundary

Exact Office print rendering and PDF conversion remain deferred as specified. No source row heights or cell padding were changed just to make the HTML preview look different from the exported template.

Suggested commit message: `fix(reports): improve document preview fit and Word layout`.
