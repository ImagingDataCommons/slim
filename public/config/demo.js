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
  mode: 'dark',
  disableAnnotationTools: false,
  annotations: [
    {
      finding: { value: '85756007', schemeDesignator: 'SCT', meaning: 'Tissue' },
      findingCategory: {
        value: '91723000',
        schemeDesignator: 'SCT',
        meaning: 'Anatomical structure'
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
