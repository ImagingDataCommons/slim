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
      style: {
        stroke: {
          color: [255, 0, 0, 1],
          width: 1
        },
        fill: {
          color: [255, 255, 255, 0.2]
        }
      }
    },
    {
      finding: {
        value: '85756007',
        schemeDesignator: 'SCT',
        meaning: 'Tissue'
      },
      style: {
        stroke: {
          color: [0, 0, 255, 1],
          width: 1
        },
        fill: {
          color: [255, 255, 255, 0.2]
        }
      }
    }
  ]
};
