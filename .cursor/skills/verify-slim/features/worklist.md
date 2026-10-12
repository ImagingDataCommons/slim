# Study worklist

The landing page lists studies from the configured DICOMweb server in a paged table. Users can filter by text columns and click a row to open the study in the viewer.

## Sub-features

- `worklist-list` loads the first page of studies via QIDO (`worklist`).
- `worklist-filter` narrows the list with a column search such as Patient ID (`worklist`).
- `worklist-open` opens a study by clicking its row and lands on its first slide (`worklist`).
- `worklist-paginate` changes page and page size (no journey yet).
- `worklist-reset` clears a column filter with `Reset` (no journey yet).
- `worklist-back` returns from the viewer via the header `unordered-list` button (no journey yet).

## How to get to it (user POV)

- Open `http://localhost:3100/`.
- In the viewer, click the header list icon ("Go to worklist").

## Driving it with drive.mjs

Preconditions:

- `doctor.sh` passes, so the DICOMweb server answers QIDO with CORS.
- The proxy holds patient `C3L-00965`.

- **List.** Load the root page. Run `node scripts/drive.mjs worklist`. `.slim-worklist .ant-table-row` has 20 rows, the footer reads `1-20 of 100 studies`, and `dicomweb.jsonl` holds a `/studies?...` response with status 200.
- **Filter.** Click the search icon in the `Patient ID` header (`.ant-table-filter-trigger`), type `C3L-00965` into `Search`, and click `Search`. Every visible row contains `C3L-00965`, and a QIDO request carries `PatientID=C3L-00965`.
- **Open.** Click the first row. The URL becomes `/studies/2.25.2110.../series/<first slide>` and an `.ol-viewport` renders.
- **Proof.** Look for `01-worklist.png`, `02-worklist-filtered.png`, and `03-study-opened.png` in the evidence dir, and `"passed": true` in `result.json`.

## Gotchas

- The IDC proxy caps QIDO totals at 100 studies, so the total proves only that QIDO worked, not the archive size.
- Only Accession Number, Study ID, Patient ID, and Patient's Name have filter triggers. Dates, sex, and modalities don't.
- Filters are server-side QIDO matches. Partial values depend on the server's fuzzy-matching support.
