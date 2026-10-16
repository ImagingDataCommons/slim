/** Config for local verification / e2e runs against the public IDC proxy. */
window.config = {
  path: '/',
  servers: [
    {
      id: 'e2e',
      url: 'https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb',
      write: false,
      retry: {
        retries: 6,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 30000,
        randomize: true,
        retryableStatusCodes: [429, 500, 502, 503, 504]
      }
    }
  ],
  disableWorklist: false,
  disableAnnotationTools: true,
  enableServerSelection: false,
  mode: 'light',
  preload: true,
  annotations: []
}
