# Slim: interoperable web viewer and annotation tool for computational pathology

*Slim* is a single-page application for interactive visualization and annotation of digital whole slide microscopy images and derived image analysis results in standard DICOM format.
The application is based on the [dicom-microscopy-viewer](https://github.com/MGHComputationalPathology/dicom-microscopy-viewer) JavaScript library and runs fully client side without any custom server components.
It relies on [DICOMweb](https://www.dicomstandard.org/dicomweb/) RESTful services to search for, retrieve, and store imaging data and can thereby simply be placed in front of any DICOMweb-conformant Image Management System (IMS), Picture Archiving and Communication (PACS), or Vendor Neutral Archive (VNA).

## Explore

### National Cancer Institute's Imaging Data Commons

*Slim* serves as the slide microscopy viewer of the [National Cancer Institute's Imaging Data Commons (IDC)](https://datacommons.cancer.gov/repository/imaging-data-commons).

<img src="docs/screenshots/IDC_CPTAC_C3L-00965-26.png" alt="IDC CPTAC C3L-00965-26" width="100%">

Use *Slim* to visually explore public IDC cancer imaging data collections by visiting the IDC web portal: [portal.imaging.datacommons.cancer.gov](https://portal.imaging.datacommons.cancer.gov/).

## Features

### Display of images

*Slim* enables interactive visualization of DICOM VL Whole Slide Microscopy Image instances in a vendor-neutral and device-independent manner.

Interoperability with various image acquisition and management systems was successfully demonstrated interoperability at the [DICOM WG-26 Connectathon at Path Visions 2020](https://digitalpathologyassociation.org/past-presentations#PV20) and the [DICOM WG-26 Hackathon at Path Visions 2021](https://digitalpathologyassociation.org/past-presentations#PV21).
Shown below are screenshots of examples images that are publicly available on the NEMA FTP server at [medical.nema.org](ftp://medical.nema.org).

|     | Vendor | Illumination | Stain |
| :-: |:------ |:------------ | :---  |
| <img src="docs/screenshots/NEMA_Roche_TriChrome.png" alt="NEMA Roche Brightfield" width="350"> | Roche Tissue Diagnostics | Brightfield | Trichrome |
| <img src="docs/screenshots/NEMA_3DHISTECH_HE.png" alt="NEMA 3DHISTECH Brightfield" width="350"> | 3DHISTECH | Brightfield | H&E |
| <img src="docs/screenshots/NEMA_3DHISTECH_DAPI-FITC-Rhodamine.png" alt="NEMA 3DHISTECH Flourescence" width="350"> | 3DHISTECH | Fluorescence | DAPI, FITC, Rhodamine |
| <img src="docs/screenshots/NEMA_SamanTree_Histolog.png" alt="NEMA SamanTree Flourescence" width="350"> | SamanTree Medical | Fluorescence | Histolog |

### Display of image annotations and analysis results

Slime further allows for interative visualization of image annotations and analysis results.
The viewer currently supports the following types of DICOM instances:

Vector graphics:

- [DICOM Comprehensive 3D SR](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.35.13.html) instances that are structured according to template [TID 1500 "Measurements Report"](https://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#sect_TID_1500) and contain planar image region of interest (ROI) annotations structured according to template [TID 1410 "Planar ROI Measurements and Qualitative Evaluations"](http://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#sect_TID_1410)
- [DICOM Microscopy Bulk Simple Annotations](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.87.html) instances that contain groups of many ROI annotations (e.g., single cells)

Raster graphics:

- [DICOM Segmentation](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.51.html) instances that contain binary or fractional segmentation masks
- [DICOM Parametric Map](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.75.html) instances that contain saliency maps, attention maps, class activation maps, etc.


|     | DICOM IOD |
| :-: |:--------- |
| <img src="docs/screenshots/IDC_CPTAC_C3N-01016-22_segmentation.png" alt="IDC CPTAC Segmentation" width="350"> | Segmentation |
| <img src="docs/screenshots/IDC_CPTAC_C3N-01016-22_parametric_map.png" alt="IDC CPTAC Parametric Map" width="350"> | Parametric Map |
| <img src="docs/screenshots/IDC_CPTAC_C3N-01016-22_annotation.png" alt="IDC CPTAC Comprehensive 3D SR" width="350"> | Comprehensive 3D SR |
| <img src="docs/screenshots/IDC_TCGA_TCGA-05-4244-01Z-00-DX1_segmentation.png" alt="IDC TCGA Segmentation" width="350"> | Segmentation |
| <img src="docs/screenshots/IDC_TCGA_TCGA-05-4244-01Z-00-DX1_bulk_annotations.png" alt="IDC TCGA Segmentation" width="350"> | Microscopy Bulk Simple Annotations |


### Annotation of images

In addition to display, *Slim* provides annotation tools that allow users to create graphical image region of interest (ROI) annotations and store them as [DICOM Comprehensive 3D SR](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.35.13.html) instances using SR template [TID 1500 "Measurement Report"](http://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#sect_TID_1500).
ROIs are stored as 3D spatial coordinates (SCOORD3D) in millimeter unit according to SR template [TID 1410 "Planar ROI Measurements and Qualitative Evaluations"](http://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#sect_TID_1410) together with measurements and qualitative evaluations (labels).
Specifically, [Image Region](http://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#para_b68aa0a9-d0b1-475c-9630-fbbd48dc581d) is used to store the vector graphic data and [Finding](http://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_A.html#para_c4ac1cac-ee86-4a86-865a-8137ebe1bd95) is used to describe what has been annotated using a standard medical terminology such as [SNOMED CT](https://www.snomed.org/).
The terms that can be chosen by a user can be configured (see [AppConfig.d.ts](src/AppConfig.d.ts)).


## Autentication and authorization

Users can authenticate and authorize the application to access data via [OpenID Connect (OIDC)](https://openid.net/connect/) based on the [OAuth 2.0](https://oauth.net/2/) protocol using either the [authorization code grant type](https://oauth.net/2/grant-types/authorization-code/) (with [Proof Key for Code Exchange (PKCE)](https://oauth.net/2/pkce/) extension) or the legacy [implicit grant type](https://oauth.net/2/grant-types/implicit/).

## Configuration

The app can be configured via a `public/config/{name}.js` JavaScript configuration file.
Please refer to the [AppConfig.d.ts](src/AppConfig.d.ts) file for configuration options.

The configuration can be changed at build-time using the `REACT_APP_CONFIG` environment variable.

## Deployment

Download the latest release from [github.com/herrmannlab/slim/releases](https://github.com/herrmannlab/slim/releases) and then run the following commands to install build dependencies and build the app:

```none
yarn install
PUBLIC_URL=/ yarn build
```

Once the app has been built, the content of the `build` folder can be directly served by a static web server at `/`.


### Local

The repository provides a [Docker compose file](https://docs.docker.com/compose/compose-file/) to deploy a static web server and a [dcm4chee-arc-light](https://github.com/dcm4che/dcm4chee-arc-light) DICOMweb server on localhost for local app development and testing:

```none
docker-compose up -d
```

The local deployment serves the app via an NGINX web server at `http://localhost:8008` and exposes the DICOMweb services at `http://localhost:8008/dicomweb`.
Once the serives are up, one can store DICOM objects in the archive using the [Store transaction of the DICOMweb Studies Service](http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_10.5.html).

The command line interface of the [dicomweb-client Python package](https://dicomweb-client.readthedocs.io/en/latest/usage.html#command-line-interface-cli) makes storing DICOM files in the archive straight forward:

```none
dicomweb_client -vv --url http://localhost:8008/dicomweb store instances -h
```

The local deployment uses the default configuration file `public/config/local.js`:

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
        value: '85756007',
        schemeDesignator: 'SCT',
        meaning: 'Tissue'
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
```

Customize the configuration according to your needs at either build-time or run-time.

### Google Cloud Platform

*Slim* can be readily configured to connect to a secured DICOMweb endpoint of the [Google Cloud Healthcare API](https://cloud.google.com/healthcare) with OIDC authentication:

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
          color: [255, 255, 0, 1],
          width: 2
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

```none
yarn install
yarn start
```

This will serve the app via a development server at [http://localhost:3000](http://localhost:3000) using the default `local` configuration.

The configuration can be specified using the `REACT_APP_CONFIG` environment variable, which can be set either in the `.env` file or directly in the command line:

```none
REACT_APP_CONFIG=local yarn start
```
