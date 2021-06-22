/*const gcpProject = "idc-sandbox-000"
const gcpLocation = "europe-west6"
const gcpDataset = "htan-dev"
const gcpStore = "LUNG-1-LN-20210604"*/
const gcpProject = "idc-htan-000"
const gcpLocation = "europe-west6"
const gcpDataset = "devdatahatan"
const gcpStore = "HTA9_1_BA_L_ROI04-20210612"
const gcpClientID = "763502697625-v5ql2spnpj4jai8lsd27jav6g6d68tg9.apps.googleusercontent.com"
window.config = {
  path: "/",
  servers: [
    {
      id: "gcp",
      url: `https://healthcare.googleapis.com/v1/projects/${gcpProject}/locations/${gcpLocation}/datasets/${gcpDataset}/dicomStores/${gcpStore}/dicomWeb`,
      write: true
    }
  ],
  oidc: {
    authority: "https://accounts.google.com",
    clientId: gcpClientID,
    scope: "email profile openid https://www.googleapis.com/auth/cloud-healthcare",
    grantType: "implicit"
  },
  annotations: [
    {
      finding: {
        value: '108369006',
        schemeDesignator: 'SCT',
        meaning: 'Neoplasm'
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
    }
  ]
};
