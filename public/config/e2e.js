/**
 * Read-only config for the manual test plan and the Playwright suite in e2e/.
 * Points at the public IDC DICOMweb proxy, so no credentials or local archive
 * are needed. Start it with `REACT_APP_CONFIG=e2e pnpm start`.
 */
window.config = {
  path: '/',
  servers: [
    {
      id: 'idc',
      url: 'https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb',
      write: false,
      retry: {
        retries: 5,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 15000,
        randomize: true,
        retryableStatusCodes: [429, 500, 502, 503, 504]
      }
    }
  ],
  disableWorklist: false,
  disableAnnotationTools: false,
  enableServerSelection: true,
  enableMemoryMonitoring: true,
  mode: 'dark',
  preload: true,
  annotations: [
    {
      finding: {
        value: '85756007',
        schemeDesignator: 'SCT',
        meaning: 'Tissue'
      },
      findingCategory: {
        value: '91723000',
        schemeDesignator: 'SCT',
        meaning: 'Anatomical structure'
      },
      geometryTypes: ['polygon', 'freehandpolygon'],
      style: {
        stroke: { color: [255, 255, 0, 1], width: 2 },
        fill: { color: [255, 255, 255, 0.2] }
      }
    },
    {
      /** No geometryTypes, so every geometry type is offered */
      finding: {
        value: '108369006',
        schemeDesignator: 'SCT',
        meaning: 'Tumor'
      },
      findingCategory: {
        value: '49755003',
        schemeDesignator: 'SCT',
        meaning: 'Morphologically abnormal structure'
      },
      evaluations: [
        {
          name: {
            value: '371441004',
            schemeDesignator: 'SCT',
            meaning: 'Histological grade'
          },
          values: [
            { value: '54102005', schemeDesignator: 'SCT', meaning: 'G1' },
            { value: '1663004', schemeDesignator: 'SCT', meaning: 'G2' },
            { value: '61026006', schemeDesignator: 'SCT', meaning: 'G3' }
          ]
        }
      ],
      style: {
        stroke: { color: [255, 0, 255, 1], width: 2 },
        fill: { color: [255, 255, 255, 0.2] }
      }
    },
    {
      finding: {
        value: '369705002',
        schemeDesignator: 'SCT',
        meaning: 'Invasive tumor border'
      },
      findingCategory: {
        value: '395557000',
        schemeDesignator: 'SCT',
        meaning: 'Tumor finding'
      },
      geometryTypes: ['line', 'freehandline'],
      style: {
        stroke: { color: [51, 102, 255, 1], width: 2 },
        fill: { color: [255, 255, 255, 0.2] }
      }
    }
  ],
  logger: {
    level: 'WARN',
    enableInProduction: false,
    enableInDevelopment: true
  }
}
