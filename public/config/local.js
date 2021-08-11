window.config = {
  path: "/",
  /** This is an array, but we'll only use the first entry for now */
  servers: [
    {
      id: "local",
      url: "https://idc-external-006.uc.r.appspot.com",
      write: true,
      retry: {
        retries: 5,
        factor: 3,
        minTimeout: 1 * 1000,
        maxTimeout: 60 * 1000,
        randomize: true,
        retryableStatusCodes: [429, 500, 404],
      },
      errorMessages: [
        { status: 429, message: 'Failed 429!' },
        { status: 404, message: 'Failed 404!' },
      ]
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
