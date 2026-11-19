---
title: A worklist that knows about derived data
eyebrow: Worklist
summary: Search studies, sort and page through results, and find the ones that hold segmentations, annotations, maps or presentation states.
order: 5
icon: ListFilter
screenshot: worklist
bullets:
  - Search by patient name, patient ID, study ID or accession number
  - The Contains filter finds studies with bulk annotations, 3D SR, segmentations, label maps, parametric maps or presentation states
  - Sortable columns, pagination and compact 32px rows
  - The Contains filter lives in the URL, so a filtered worklist is a shareable link
---

The Contains filter searches by SOP Class UID at the instance level, and falls back to the series modality on servers that do not support it, such as Google Cloud. Rows on the current page are then checked for slides and the exact SOP class, and results are cached for the session.
