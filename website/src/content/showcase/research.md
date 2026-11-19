---
title: Computational pathology research
organization: Nature Communications, 2023
summary: The design and capabilities of Slim are described in a peer-reviewed article on interoperable slide microscopy viewing and annotation for imaging data science.
order: 3
url: https://doi.org/10.1038/s41467-023-37224-2
tags: [Peer-reviewed, AI, Annotation]
stats:
  - value: '2023'
    label: published in Nature Communications
  - value: 'TID 1500'
    label: standard annotation output
examples: [sr, pmap]
links:
  - label: Read the article
    href: https://doi.org/10.1038/s41467-023-37224-2
  - label: highdicom
    href: https://github.com/ImagingDataCommons/highdicom
---

The article *Interoperable slide microscopy viewer and annotation tool for imaging data science and computational pathology* (Gorman et al., Nature Communications 14:1572, 2023) explains why Slim stores everything in DICOM: images, the annotations experts draw on them, and the results AI models produce.

## From annotation to model and back

Experts annotate regions in Slim, which stores them as DICOM Comprehensive 3D SR. Python libraries such as [highdicom](https://github.com/ImagingDataCommons/highdicom) read those annotations to train models. The models write their output back as DICOM Segmentation, Parametric Map or Microscopy Bulk Simple Annotations, and Slim displays it next to the original slide.

Because every step uses the same standard, the loop works across institutions and archives without custom converters.
