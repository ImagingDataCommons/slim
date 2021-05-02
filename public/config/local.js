window.config = {
  path: "/",
  /** This is an array, but we'll only use the first entry for now */
  servers: [
    {
      id: "local",
      url: "http://localhost:8008/dicomweb",
      write: true
    }
  ],
  annotations: [
    {
      finding: {
        value: '108369006',
        schemeDesignator: 'SCT',
        meaning: 'Tumor'
      },
      color: [255, 0, 0]
    },
    {
      finding: {
        value: '85756007',
        schemeDesignator: 'SCT',
        meaning: 'Tissue'
      },
      color: [0, 0, 255]
    }

  ]
};
