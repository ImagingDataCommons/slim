---
title: Any DICOMweb archive, any identity provider
eyebrow: Interoperability
summary: Slim runs fully client-side in front of any DICOMweb-conformant PACS, VNA or cloud archive, with OpenID Connect sign-in.
order: 7
icon: Network
screenshot: server
bullets:
  - Google Cloud Healthcare API, dcm4chee-arc-light, Orthanc and other DICOMweb servers
  - Switch servers at runtime, including path-only Google Cloud DICOM store paths
  - OpenID Connect with authorization code + PKCE, or the implicit grant
  - Upgrades HTTP bulk data URLs to HTTPS when the archive returns internal links
---

There is no Slim backend. The app is a static bundle that talks to your archive with QIDO-RS, WADO-RS and STOW-RS, so it can be hosted on any static web server, a cloud bucket or Firebase Hosting. Authentication uses [oidc-client-ts](https://github.com/authts/oidc-client-ts); providers can also be configured at runtime from the server dialog.
