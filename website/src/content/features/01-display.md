---
title: Whole slide images, brightfield and fluorescence
eyebrow: Display
summary: Vendor-neutral display of DICOM VL Whole Slide Microscopy Image instances, from H&E brightfield to multiplexed immunofluorescence.
order: 1
icon: Microscope
screenshot: fluorescence
example: fluorescence
bullets:
  - Brightfield and multichannel fluorescence slides in the same viewer
  - Per-channel color, window and visibility under Optical paths
  - ICC color management, gamma and interpolation under Display options
  - Advanced Blending Presentation States restore a saved channel setup
---

Slim renders the tiled image pyramid of a DICOM whole slide image directly in the browser using [dicom-microscopy-viewer](https://github.com/ImagingDataCommons/dicom-microscopy-viewer). There is no server-side rendering and no proprietary format: if the archive serves DICOMweb, Slim can display it.

Interoperability with acquisition and archive systems from several vendors was demonstrated at the DICOM WG-26 Connectathon at Path Visions 2020 and the WG-26 Hackathon at Path Visions 2021.
