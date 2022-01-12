window.config = {
  // This must match the location configured for web server
  path: "/viewer",
  servers: [
    {
      id: "local",
      // This must match the proxy location configured for the web server
      url: "http://localhost:8008/dicomweb",
      write: true
    }
  ],
  disableWorklist: false,
  disableAnnotationTools: false,
  annotations: [
    {
      finding: {
        value: '108369006',
        schemeDesignator: 'SCT',
        meaning: 'Tumor'
      },
      style: {
        stroke: {
          color: [251, 134, 4, 1],
          width: 2
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
          color: [51, 204, 51, 1],
          width: 2
        },
        fill: {
          color: [255, 255, 255, 0.2]
        }
      }
    }
  ]
};
