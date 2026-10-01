/**
 * Site-wide names and links. Demo links resolve against PUBLIC_SLIM_DEMO_URL
 * so a preview build can point at a different Slim deployment.
 */

const repo = 'https://github.com/ImagingDataCommons/slim'

/** Slim deployment that loads data from the IDC public proxy */
export const DEFAULT_DEMO_URL = 'https://idc-external-006.web.app'

/** IDC production viewer, used when no demo deployment is configured */
export const IDC_VIEWER_URL =
  'https://viewer.imaging.datacommons.cancer.gov/slim'

export const demoUrl: string = (
  import.meta.env.PUBLIC_SLIM_DEMO_URL ||
  DEFAULT_DEMO_URL ||
  IDC_VIEWER_URL
).replace(/\/+$/, '')

export const site = {
  name: 'Slim',
  title: 'Slim · DICOM slide microscopy viewer',
  tagline: 'Slide microscopy viewer. Open-source. Web-based. DICOM-native.',
  description:
    'Slim is an open-source, zero-footprint web viewer and annotation tool for DICOM whole slide images, built for digital pathology and imaging data science.',
  repo,
  links: {
    github: repo,
    releases: `${repo}/releases`,
    issues: `${repo}/issues`,
    newIssue: `${repo}/issues/new/choose`,
    pulls: `${repo}/pulls`,
    wiki: `${repo}/wiki`,
    readme: `${repo}#readme`,
    configuration: `${repo}/blob/master/docs/CONFIGURATION.md`,
    conformance: `${repo}/blob/master/DICOM-Conformance-Statement.md`,
    contributing: `${repo}/blob/master/CONTRIBUTING.md`,
    changelog: `${repo}/blob/master/docs/CHANGELOG.md`,
    license: `${repo}/blob/master/LICENSE`,
    dockerCompose: `${repo}/blob/master/docker-compose.yml`,
    dmv: 'https://github.com/ImagingDataCommons/dicom-microscopy-viewer',
    idc: 'https://imaging.datacommons.cancer.gov',
    idcPortal: 'https://portal.imaging.datacommons.cancer.gov',
    idcViewer: IDC_VIEWER_URL,
    idcForum: 'https://discourse.canceridc.dev',
    idcProxyPolicy: 'https://learn.canceridc.dev/portal/proxy-policy',
    crdc: 'https://datacommons.cancer.gov',
    /** IDC's page in the NCI Cancer Research Data Commons; where the IDC logo links */
    idcCrdc: 'https://datacommons.cancer.gov/repository/imaging-data-commons',
    paper: 'https://doi.org/10.1038/s41467-023-37224-2',
    dicomweb: 'https://www.dicomstandard.org/dicomweb',
    wg26: 'https://www.dicomstandard.org/activity/wgs/wg-26',
  },
  nav: [
    { href: '/features/', label: 'Features' },
    { href: '/showcase/', label: 'Showcase' },
    { href: '/release-notes/', label: 'Release notes' },
    { href: '/docs/', label: 'Docs' },
    { href: '/about/', label: 'About' },
    { href: '/support/', label: 'Support' },
  ],
} as const

/** Deep link into the demo viewer for one series, optionally with a presentation state */
export function demoSeriesUrl(
  studyInstanceUID: string,
  seriesInstanceUID: string,
  stateSeriesInstanceUID?: string,
): string {
  const url = `${demoUrl}/studies/${studyInstanceUID}/series/${seriesInstanceUID}`
  return stateSeriesInstanceUID ? `${url}?state=${stateSeriesInstanceUID}` : url
}
