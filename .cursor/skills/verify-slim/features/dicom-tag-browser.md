# DICOM tag browser

From any viewer page, users can open a dialog that lists the DICOM attributes of the study's series and instances, with a search box to narrow the tags.

## Sub-features

- `tags-open` opens the dialog from the header `file-search` icon on a viewer route (`tag-browser`).
- `tags-search` filters rows by keyword and shows the matching value (`tag-browser`).
- `tags-series` switches series or instance in the dialog's selector (no journey yet).
- `tags-hidden-on-worklist` hides the button on the worklist (no journey yet).

## How to get to it (user POV)

- On `/studies/...` or `/projects/.../study/...`, click the header icon with tooltip `Dicom Tag Browser`.

## Driving it with drive.mjs

Preconditions:

- `doctor.sh` passes.
- The H&E study exists on the proxy.

- **Open.** Load the H&E deep link and click `.ant-layout-header button:has([aria-label="file-search"])`. Run `node scripts/drive.mjs tag-browser`. A modal appears with a `Search DICOM tags...` input and more than 100 tag rows.
- **Search.** Type `PatientID`. After the 300ms debounce, a row shows `PatientID` with value `C3L-00965`.
- **Proof.** Look for `01-tag-browser.png` and `02-tag-browser-search.png`, with row counts in `result.json`.

## Gotchas

- The header buttons have no accessible names, only hover tooltips. Target the antd icon's `aria-label`.
- Search is debounced by 300ms. Wait before reading rows.
