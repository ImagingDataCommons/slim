/**
 * DICOM objects Slim reads and writes. `example` ids point into
 * idc-examples.json; SOP Class UIDs mirror src/data/uids.tsx in the app.
 */

export type Capability = 'display' | 'create' | 'store'

export interface MatrixRow {
  id: string
  example: string
  name: string
  variant?: string
  sopClassUID: string
  standard: string
  capabilities: readonly Capability[]
  note: string
}

export interface MatrixGroup {
  title: string
  rows: readonly MatrixRow[]
}

const part3 = 'https://dicom.nema.org/medical/dicom/current/output/chtml/part03'

export const matrix: readonly MatrixGroup[] = [
  {
    title: 'Slide images',
    rows: [
      {
        id: 'wsi-brightfield',
        example: 'brightfield',
        name: 'VL Whole Slide Microscopy Image',
        variant: 'Brightfield',
        sopClassUID: '1.2.840.10008.5.1.4.1.1.77.1.6',
        standard: `${part3}/sect_A.32.8.html`,
        capabilities: ['display'],
        note: 'H&E and other stains, with ICC color management',
      },
      {
        id: 'wsi-fluorescence',
        example: 'fluorescence',
        name: 'VL Whole Slide Microscopy Image',
        variant: 'Multiplexed fluorescence',
        sopClassUID: '1.2.840.10008.5.1.4.1.1.77.1.6',
        standard: `${part3}/sect_A.32.8.html`,
        capabilities: ['display'],
        note: 'Per-channel color, window and visibility',
      },
    ],
  },
  {
    title: 'Vector annotations',
    rows: [
      {
        id: 'sr-3d',
        example: 'sr',
        name: 'Comprehensive 3D SR',
        variant: 'TID 1500 / TID 1410',
        sopClassUID: '1.2.840.10008.5.1.4.1.1.88.34',
        standard: `${part3}/sect_A.35.13.html`,
        capabilities: ['display', 'create', 'store'],
        note: 'ROIs with coded findings, saved via STOW-RS',
      },
      {
        id: 'ann',
        example: 'ann',
        name: 'Microscopy Bulk Simple Annotations',
        sopClassUID: '1.2.840.10008.5.1.4.1.1.91.1',
        standard: `${part3}/sect_A.87.html`,
        capabilities: ['display'],
        note: 'Hundreds of thousands of cells per slide',
      },
    ],
  },
  {
    title: 'Raster results',
    rows: [
      {
        id: 'seg-binary',
        example: 'seg-binary',
        name: 'Segmentation',
        variant: 'Binary',
        sopClassUID: '1.2.840.10008.5.1.4.1.1.66.4',
        standard: `${part3}/sect_A.51.html`,
        capabilities: ['display'],
        note: 'Including TILED_SPARSE at non-standard resolutions',
      },
      {
        id: 'seg-fractional',
        example: 'seg-fractional',
        name: 'Segmentation',
        variant: 'Fractional',
        sopClassUID: '1.2.840.10008.5.1.4.1.1.66.4',
        standard: `${part3}/sect_A.51.html`,
        capabilities: ['display'],
        note: 'Probability maps with an in-viewport legend',
      },
      {
        id: 'labelmap',
        example: 'labelmap',
        name: 'Labelmap Segmentation',
        variant: 'Supplement 243',
        sopClassUID: '1.2.840.10008.5.1.4.1.1.66.7',
        standard: `${part3}/sect_A.89.html`,
        capabilities: ['display'],
        note: 'One segment per pixel value',
      },
      {
        id: 'pmap',
        example: 'pmap',
        name: 'Parametric Map',
        sopClassUID: '1.2.840.10008.5.1.4.1.1.30',
        standard: `${part3}/sect_A.75.html`,
        capabilities: ['display'],
        note: 'Saliency, attention and score maps',
      },
    ],
  },
  {
    title: 'Presentation',
    rows: [
      {
        id: 'abps',
        example: 'presentation-state',
        name: 'Advanced Blending Presentation State',
        sopClassUID: '1.2.840.10008.5.1.4.1.1.11.8',
        standard: `${part3}/sect_A.33.html`,
        capabilities: ['display'],
        note: 'Restores a saved channel blending setup',
      },
    ],
  },
]

export const capabilityLabels: Record<Capability, string> = {
  display: 'Display',
  create: 'Create',
  store: 'Store',
}
