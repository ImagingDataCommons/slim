/**
 * Slides, DICOMweb clients and viewer sessions for slide viewer tests. Test
 * files using sessions must mock 'dicom-microscopy-viewer' with
 * {@link fakeDmvModule}.
 */
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import { formatRoiStyle } from '../../../components/SlideViewer/utils/roiUtils'
import DicomWebManager from '../../../DicomWebManager'
import { Slide } from '../../../data/slides'
import { StorageClasses } from '../../../data/uids'
import type { ViewerAccess } from '../hooks/useViewerSession'
import {
  createViewerSession,
  type ViewerSession,
} from '../services/viewerSession'
import { buildAnnotationConfig } from '../utils/annotationConfig'
import { type FakeVolumeImageViewer, fakeDmvInstances } from './fakeDmv'

export const TEST_STUDY_UID = '1.2.3'

function image(
  seriesInstanceUID: string,
  flavor: 'VOLUME' | 'LABEL',
  sopInstanceUID: string,
): dmv.metadata.VLWholeSlideMicroscopyImage {
  const fields: Partial<dmv.metadata.VLWholeSlideMicroscopyImage> = {
    StudyInstanceUID: TEST_STUDY_UID,
    SeriesInstanceUID: seriesInstanceUID,
    SOPInstanceUID: sopInstanceUID,
    SOPClassUID: StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE,
    ImageType: ['ORIGINAL', 'PRIMARY', flavor, 'NONE'],
    ContainerIdentifier: `container-${seriesInstanceUID}`,
    FrameOfReferenceUID: `for-${seriesInstanceUID}`,
    OpticalPathSequence: [
      {
        OpticalPathIdentifier: '1',
        OpticalPathDescription: 'Brightfield',
      } as dmv.metadata.OpticalPath,
    ],
    SamplesPerPixel: 3,
    PhotometricInterpretation: 'RGB',
    BitsAllocated: 8,
    Rows: 256,
    Columns: 256,
    TotalPixelMatrixRows: 1024,
    TotalPixelMatrixColumns: 1024,
    SpecimenDescriptionSequence: [],
    ContainerTypeCodeSequence: [],
    bulkdataReferences: {},
  }
  return fields as dmv.metadata.VLWholeSlideMicroscopyImage
}

/** RGB slide with one volume and one label image */
export function createTestSlide(seriesInstanceUID = '1.2.3.4'): Slide {
  return new Slide({
    images: [
      image(seriesInstanceUID, 'VOLUME', `${seriesInstanceUID}.1`),
      image(seriesInstanceUID, 'LABEL', `${seriesInstanceUID}.2`),
    ],
  })
}

/** One writable client, with searches that find nothing, for every class */
export function createTestClients(): { [key: string]: DicomWebManager } {
  const manager = new DicomWebManager({
    baseUri: 'https://example.test',
    settings: [
      { id: 'test', url: 'https://example.test/dicomWeb', write: true },
    ],
  })
  manager.searchForInstances = jest.fn().mockResolvedValue([])
  manager.searchForSeries = jest.fn().mockResolvedValue([])
  manager.storeInstances = jest.fn().mockResolvedValue(undefined)
  return {
    [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: manager,
    [StorageClasses.COMPREHENSIVE_3D_SR]: manager,
    [StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION]: manager,
    [StorageClasses.SEGMENTATION]: manager,
    [StorageClasses.PARAMETRIC_MAP]: manager,
    [StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE]: manager,
  }
}

export const TEST_ROI_STYLE: dmv.viewer.ROIStyleOptions = formatRoiStyle({})

export interface TestSession {
  session: ViewerSession
  /** The fake behind `session.volumeViewer` */
  viewer: FakeVolumeImageViewer
  access: ViewerAccess & { refreshSnapshot: jest.Mock }
}

/** A session built by the real factory on top of the fake DMV module */
export function createTestSession(
  slide: Slide = createTestSlide(),
  generation = 1,
): TestSession {
  const session = createViewerSession({
    generation,
    slide,
    clients: createTestClients(),
    preload: false,
    clustering: { isEnabled: true, thresholdInput: '' },
    annotationConfig: buildAnnotationConfig([]),
    defaultRoiStyle: TEST_ROI_STYLE,
  })
  const viewers = fakeDmvInstances.volumeViewers
  const viewer = viewers[viewers.length - 1]
  if (viewer === undefined) {
    throw new Error("mock 'dicom-microscopy-viewer' with fakeDmvModule")
  }
  return {
    session,
    viewer,
    access: { sessionRef: { current: session }, refreshSnapshot: jest.fn() },
  }
}
