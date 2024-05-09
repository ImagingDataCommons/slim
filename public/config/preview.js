window.config = {
  path: '/',
  servers: [
    {
      id: 'preview',
      url: 'https://idc-external-006.uc.r.appspot.com/dcm4chee-arc/aets/DCM4CHEE/rs',
      write: false
    }
  ],
  disableWorklist: false,
  disableAnnotationTools: false,
  enableServerSelection: true,
  mode: "light",
  preload: true,
  annotations: [
    {
      finding: { value: '85756007', schemeDesignator: 'SCT', meaning: 'Tissue' },
      style: {
        stroke: {
          color: [51, 204, 51, 1],
          width: 2
        },
        fill: {
          color: [255, 255, 255, 0.2]
        }
      }
    },
  ]
}
