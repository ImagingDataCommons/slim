window.config = {
  path: '/',
  servers: [
    {
      id: 'preview',
      url: window.slim.env.SLIM_PREVIEW_DICOMWEB_URL,
      write: false
    }
  ],
  disableWorklist: false,
  disableAnnotationTools: false,
  enableServerSelection: true,
  mode: 'light',
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
    }
  ],
  // Logger configuration
  logger: {
    level: 'WARN', // DEBUG, LOG, WARN, ERROR, NONE
    enableInProduction: false,
    enableInDevelopment: true
  }
}
