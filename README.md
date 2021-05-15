# SliM: Slide microscopy image display and annotation system for thin clients

A lightweight server-less single-page application based for interactive visualization of digital slide microscopy (SM) images and associated image annotations in standard DICOM format.
The application is based on the [dicom-microscopy-viewer](https://github.com/MGHComputationalPathology/dicom-microscopy-viewer) library and can simply be placed in front of a [DICOMweb](https://www.dicomstandard.org/dicomweb/) compatible Image Management System (IMS), Picture Archiving and Communication (PACS), or Vendor Neutral Archive (VNA).

## Image display

The app will search the IMS for studies containing SM images and visualize image instances of the DICOM VL Whole Slide Microscopy Image SOP Storage Class.

## Image annotation

The app allows users to create graphical image region of interest (ROI) annotations and store them as DICOM Comprehensive 3D SR documents using SR template [TID 1500 "Measurement Report"](http://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#sect_TID_1500).
ROIs are stored as 3D spatial coordinates (SCOORD3D) according to SR template [TID 1410 "Planar ROI Measurements and Qualitative Evaluations"](http://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#sect_TID_1410) together with any measurements or qualitative evaluations derived thereof.
Specifically, [Image Region](http://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#para_b68aa0a9-d0b1-475c-9630-fbbd48dc581d) is used to store the vector graphic data and [Finding](http://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#para_c4ac1cac-ee86-4a86-865a-8137ebe1bd95) is used to describe what has been annotated using a standard medical terminology such as SNOMED CT.

The app will also search the IMS for existing SR documents and visualize any ROI annotations contained in DICOM Comprehensive 3D SR documents (image region, finding, and any measurement or qualitative evaluation stored according to TID 1410).

## Autentication and authorization

Users can authenticate and authorize the application to access data via [OpenID Connect (OIDC)](https://openid.net/connect/) based on the [OAuth 2.0](https://oauth.net/2/) protocol with the [application code grant type](https://oauth.net/2/grant-types/authorization-code/) and [Proof Key for Code Exchange (PKCE)](https://oauth.net/2/pkce/) extension or the legacy [implicit grant type](https://oauth.net/2/grant-types/implicit/).

## Configuration

The app can be configured via a `public/config/{name}.js` JavaScript configuration file.
Please refer to the `AppConfig.d.ts` file for configuration options.

The configuration can be changed at build-time using the `REACT_APP_CONFIG` environment variable or at run-time by update the content the configuration file.

## Deployment

### Local

The repository provides a [Docker compose file](https://docs.docker.com/compose/compose-file/) to locally deploy a web server and a [dcm4chee-arc-light](https://github.com/dcm4che/dcm4chee-arc-light) DICOMweb server for local app development and testing:

    $ docker-compose up -d

Serves the app via an NGINX web server at `http://localhost:8008` and exposes the DICOMweb RESTful services at `http://localhost:8008/dicomweb`.

The app will be configured using the default configuration `public/config/local.js`:

```js
window.config = {
  path: "/",
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
        meaning: 'Neoplasm'
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
    }
  ]
};
```


### Google Cloud Platform

Here is an example configuration `public/config/gcp.js` for running the app with the [Google Healthcare API](https://cloud.google.com/healthcare) and OIDC authentication/authorization:

```js
const gcpProject = ""
const gcpLocation = ""
const gcpDataset = ""
const gcpStore = ""
const gcpClientID = ""
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
          color: [255, 0, 0, 1],
          width: 1
        },
        fill: {
          color: [255, 255, 255, 0.2]
        }
      }
    }
  ]
};
```

#### OAuth 2.0 configuration

Create an [OIDC client ID for web application](https://developers.google.com/identity/sign-in/web/sign-in).

Note that Google's OIDC implementation does currently not yet support the authorization code grant type with PKCE challenge.
For the time being, the legacy implicit grand type has to be used.


## Development

To install requirements and run the app for local development, run the following commands:

    $ yarn install
    $ yarn start

This will serve the app via a development server at [http://localhost:3000](http://localhost:3000) using the `local` configuration.

A different configuration can be used by setting the `REACT_APP_CONFIG` environment variable in the `.env` file or via the command line:

    $ REACT_APP_CONFIG=gcp yarn start
