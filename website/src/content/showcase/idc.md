---
title: NCI Imaging Data Commons
organization: National Cancer Institute
summary: Slim is the slide microscopy viewer of the NCI Imaging Data Commons, a cloud-based environment of publicly available cancer imaging data.
order: 1
url: https://imaging.datacommons.cancer.gov
tags: [Production, Google Cloud Healthcare API, Public data]
stats:
  - value: '76,000+'
    label: slide microscopy series
  - value: '27,000+'
    label: pathology segmentations
  - value: '7,000+'
    label: bulk annotation series
examples: [brightfield, fluorescence, ann, seg-binary]
links:
  - label: IDC portal
    href: https://portal.imaging.datacommons.cancer.gov
  - label: IDC documentation
    href: https://learn.canceridc.dev
  - label: IDC user forum
    href: https://discourse.canceridc.dev
---

The [NCI Imaging Data Commons (IDC)](https://imaging.datacommons.cancer.gov) is a node of the NCI [Cancer Research Data Commons](https://datacommons.cancer.gov). It hosts radiology, digital pathology and multiplexed fluorescence images, together with image-derived data such as segmentations and annotations, all in DICOM and free to access without registration.

Every slide microscopy series in IDC opens in Slim. The IDC viewer serves data from the Google Cloud Healthcare API, and the public IDC proxy exposes the same data over DICOMweb, which is what the live examples on this site use.

## Why DICOM matters here

IDC collects data from many sources: TCGA, CPTAC, HTAN, and AI analysis results contributed by research groups. Keeping all of it in one standard means one viewer works for everything. Bulk nuclei annotations, AI segmentations and multiplexed immunofluorescence open in Slim the same way as an H&E slide.

The IDC team maintains Slim and [dicom-microscopy-viewer](https://github.com/ImagingDataCommons/dicom-microscopy-viewer), and new data types in IDC drive new features in the viewer.

## Explore the data

Use the [IDC portal](https://portal.imaging.datacommons.cancer.gov) to browse collections, or try the live examples below. Each one opens a public IDC study in Slim.
