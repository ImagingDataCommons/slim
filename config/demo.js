window.config = {
  path: '/slim',
  servers: [
    {
      id: 'demo',
      url: window.slim.env.SLIM_DEMO_DICOMWEB_URL,
      write: false
    }
  ],
  preload: true,
  disableAnnotationTools: false,
  annotations: [
    {
      finding: { value: '85756007', schemeDesignator: 'SCT', meaning: 'Tissue' }
    }
  ],
  // Logger configuration
  logger: {
    level: 'WARN', // DEBUG, LOG, WARN, ERROR, NONE
    enableInProduction: false,
    enableInDevelopment: true
  }
}
