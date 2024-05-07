window.config = {
  path: '/slim',
  servers: [
    {
      id: 'demo',
      url: 'https://idc-external-006.uc.r.appspot.com/dcm4chee-arc/aets/DCM4CHEE/rs',
      write: false
    }
  ],
  preload: true,
  disableAnnotationTools: false,
  annotations: [
    {
      finding: { value: '85756007', schemeDesignator: 'SCT', meaning: 'Tissue' }
    }
  ]
}
