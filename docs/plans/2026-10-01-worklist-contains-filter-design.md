# Worklist "Contains" filter

Find the studies on a server that contain a given kind of derived data, such as
parametric maps, bulk annotations or segmentations, without leaving the
worklist.

## Goals

- Nothing is queried until the user picks an entry.
- A short, named list that only covers what matters for slide microscopy.
- Clearing the filter returns to the normal worklist instantly.
- Works on Google Cloud Healthcare (IDC) and on standard DICOMweb servers.

## Server findings

Checked against the IDC proxy on 2026-10-01:

- `SOPClassUID` is rejected as a matching key at every level (400,
  "not a supported instance or study or series level attribute").
- `SOPClassesInStudy` is rejected at the study level.
- `GET /series?Modality=X` works across all studies. Pages are capped at 5000
  rows and `offset` paging works (ANN: 7,102 series, about 4 s per page).
- Series results do not include the SOP Class UID. They do include the study
  attributes the worklist shows (patient, dates, accession, study ID), but not
  `ModalitiesInStudy` or `NumberOfStudyRelatedSeries`.
- A study search without `limit` returns 100 studies, and IDC holds more than
  5,000 slide microscopy studies, so the loaded worklist is only a sample.
- `StudyInstanceUID` does not accept a list of UIDs (204 No Content).
- Parametric maps are stored with modality `OT`. `OT` also contains CT
  "Summary Series" (CT Image Storage), so modality alone is ambiguous.

Standard servers (dcm4chee, Orthanc) support `SOPClassUID` at the instance
level, which PS3.18 lists as a required matching key.

## User experience

- A "Contains" button sits next to the worklist search input. It opens a
  popover with a filter field and a grouped list:
  - Annotations: Bulk annotations, 3D SR annotations, Structured reports
  - Segmentations: Segmentation, Label map segmentation
  - Maps: Parametric map
  - Presentation states: Blending, Color, Pseudocolor, Grayscale
- The filter field matches the label, aliases (`pmap`, `ann`, `seg`), the
  modality, or a pasted SOP Class UID.
- One entry at a time. The chosen entry becomes a chip,
  "Contains: Parametric map ✕", and the header reads
  "42 studies with Parametric map", or "Up to 343 studies with Parametric map"
  while some matches are not checked yet.
- While the search runs, the header shows progress
  ("Searching the server for Parametric map… page 2").
- The text search keeps working inside the filtered set.
- The filter lives in the URL as `?contains=<entry id>`. Back clears it, and a
  reload or shared link restores it.
- Rows being checked show a small spinner in the left gutter; rows whose check
  failed show a warning icon.
- Built on the existing Radix Popover; no new dependency.

## Architecture

### Catalog

`src/features/worklist/utils/containsCatalog.ts`

Each entry has an `id`, `label`, `group`, `aliases`, `sopClassUids` (from
`StorageClasses`), `modality`, and `needsConfirmation`. That flag is true when
the modality is shared with other SOP classes.

| Entry | Modality | Confirm |
| --- | --- | --- |
| Bulk annotations | ANN | no |
| 3D SR annotations | SR | yes |
| Structured reports | SR | yes |
| Segmentation | SEG | yes |
| Label map segmentation | SEG | yes |
| Parametric map | OT | yes |
| Presentation states (4) | PR | yes |

### Search strategy

1. Try `searchForInstances({ SOPClassUID })` across all studies, with the
   study attributes as `includefield`. On success the result is exact and needs no
   confirmation.
2. On a 400, or when the server ignores the key and returns other SOP
   classes, fall back to `searchForSeries({ Modality })` and remember that
   choice per server for the session.
3. Page with `limit=5000` and `offset` until a short page comes back. Stop
   after 10 pages and mark the result partial.

The result maps each Study Instance UID to its matching Series Instance UIDs
and a study row built from the first match. These rows are the filtered
worklist, so matches outside the 100 loaded studies are found too. A loaded
row replaces the built one when available.

### Hooks

- `useContainsSearch(client, entry)` returns the status
  (`idle | searching | done | error`), page progress, the result and `retry`.
  It guards against stale responses like `useStudies`. Results are cached per
  server and entry for the session.
- `useContainsRowChecks(searchClient, studyClient, entry, candidates)` checks
  only the rows on the current page, 6 at a time, and caches each answer:
  - Rows not in the loaded worklist: a study search by UID with
    `ModalitiesInStudy=SM`. No result means no slides (for example a radiology
    segmentation), so the row drops out; a result replaces the row.
  - Entries matched on modality: the SOP class of the first instance of each
    candidate series (`limit=1&includefield=00080016`).
- `WorklistTable` reports the study UIDs on the current page after sorting.

## Error handling

- A failed search shows a message with Retry in the header. The normal
  worklist stays usable.
- A failed confirmation keeps the row listed, with a "Couldn't verify" tooltip.
- A partial result says "first 50,000 matches only".

## Testing

- Catalog matching: labels, aliases, modality, pasted UIDs.
- Search strategy: instance search success, fallback to modality on 400,
  paging, page cap, and the study attributes kept from the first match.
- Row checks: drops studies without slides or of another SOP class, and
  fetches rows outside the loaded worklist.
- Components: popover filtering and keyboard selection, chip, clear, URL
  round trip.

## Out of scope

- Selecting several entries at once.
- Matching on attributes other than the SOP class (for example label or
  overview image types).
- Studies that hold derived data but no slide microscopy series.
