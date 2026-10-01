/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import { StorageClasses } from '../../../../data/uids'
import NotificationMiddleware from '../../../../services/NotificationMiddleware'
import {
  constructViewers,
  containsROIAnnotations,
  describesSpecimenSubject,
  implementsTID1500,
  releaseViewer,
} from '../viewerUtils'

vi.mock('dicom-microscopy-viewer', () => ({
  viewer: {
    VolumeImageViewer: vi.fn(),
    LabelImageViewer: vi.fn(),
  },
}))

vi.mock('../../../../services/NotificationMiddleware', () => ({
  __esModule: true,
  default: { onError: vi.fn() },
  NotificationMiddlewareContext: {
    DMV: 'dicom-microscopy-viewer',
    SLIM: 'slim',
  },
}))

type ContentItem = dcmjs.sr.valueTypes.ContentItem

function item(
  code: string,
  overrides: Partial<Record<string, unknown>> = {},
): ContentItem {
  return {
    ValueType: 'CONTAINER',
    ConceptNameCodeSequence: [
      { CodeValue: code, CodingSchemeDesignator: 'DCM', CodeMeaning: code },
    ],
    ...overrides,
  } as ContentItem
}

describe('implementsTID1500', () => {
  it('checks the first content template', () => {
    expect(
      implementsTID1500({
        ContentTemplateSequence: [
          { MappingResource: 'DCMR', TemplateIdentifier: '1500' },
        ],
      }),
    ).toBe(true)
    expect(
      implementsTID1500({
        ContentTemplateSequence: [
          { MappingResource: 'DCMR', TemplateIdentifier: '2000' },
        ],
      }),
    ).toBe(false)
    expect(implementsTID1500({ ContentTemplateSequence: [] })).toBe(false)
  })
})

describe('describesSpecimenSubject', () => {
  const subjectClass = (value: string, scheme = 'DCM'): ContentItem =>
    item('121024', {
      ValueType: 'CODE',
      ConceptCodeSequence: [
        {
          CodeValue: value,
          CodingSchemeDesignator: scheme,
          CodeMeaning: 'Subject',
        },
      ],
    })

  it('is true when the subject class is "Specimen"', () => {
    expect(
      describesSpecimenSubject({ ContentSequence: [subjectClass('121027')] }),
    ).toBe(true)
  })

  it('is false for other subject classes', () => {
    expect(
      describesSpecimenSubject({ ContentSequence: [subjectClass('121025')] }),
    ).toBe(false)
    expect(
      describesSpecimenSubject({
        ContentSequence: [subjectClass('121027', 'SCT')],
      }),
    ).toBe(false)
  })

  it('is false without a usable subject class item', () => {
    expect(describesSpecimenSubject({ ContentSequence: [] })).toBe(false)
    expect(
      describesSpecimenSubject({
        ContentSequence: [item('121024', { ConceptCodeSequence: [] })],
      }),
    ).toBe(false)
  })
})

describe('containsROIAnnotations', () => {
  const report = (
    groups: ContentItem[],
  ): { ContentSequence: ContentItem[] } => ({
    ContentSequence: [item('126010', { ContentSequence: groups })],
  })
  const group = (region: ContentItem | undefined): ContentItem =>
    item('125007', {
      ContentSequence: region !== undefined ? [region] : [],
    })
  const scoord3d = item('111030', {
    ValueType: dcmjs.sr.valueTypes.ValueTypes.SCOORD3D,
  })
  const scoord = item('111030', { ValueType: 'SCOORD' })

  it('is true when any measurement group has a 3D image region', () => {
    expect(
      containsROIAnnotations(report([group(scoord), group(scoord3d)])),
    ).toBe(true)
  })

  it('is false when no group has a 3D image region', () => {
    expect(containsROIAnnotations(report([group(scoord)]))).toBe(false)
    expect(containsROIAnnotations(report([group(undefined)]))).toBe(false)
    expect(containsROIAnnotations(report([]))).toBe(false)
  })

  it('is false without imaging measurements', () => {
    expect(containsROIAnnotations({ ContentSequence: [] })).toBe(false)
    expect(containsROIAnnotations({ ContentSequence: [item('126010')] })).toBe(
      false,
    )
  })
})

describe('constructViewers', () => {
  const VolumeImageViewer = vi.mocked(dmv.viewer.VolumeImageViewer)
  const LabelImageViewer = vi.mocked(dmv.viewer.LabelImageViewer)
  const activateSelectInteraction = vi.fn()
  const client = {} as dwc.api.DICOMwebClient
  const clients = {
    [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: client,
  }
  const image = {
    ContainerIdentifier: 'S1',
  } as dmv.metadata.VLWholeSlideMicroscopyImage

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    // biome-ignore lint/complexity/useArrowFunction: `new` needs a function implementation
    VolumeImageViewer.mockImplementation(function () {
      return {
        activateSelectInteraction,
      } as Partial<dmv.viewer.VolumeImageViewer> as dmv.viewer.VolumeImageViewer
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds the volume viewer and activates selection', () => {
    const { volumeViewer, labelViewer } = constructViewers({
      clients,
      slide: { volumeImages: [image], labelImages: [] },
      preload: true,
    })
    expect(volumeViewer).toBeDefined()
    expect(labelViewer).toBeUndefined()
    expect(activateSelectInteraction).toHaveBeenCalledWith({})
    expect(VolumeImageViewer).toHaveBeenCalledWith(
      expect.objectContaining({
        clientMapping: clients,
        metadata: [image],
        preload: true,
        useTileGridResolutions: false,
        annotationOptions: undefined,
      }),
    )
  })

  it('passes the clustering threshold to the annotation options', () => {
    constructViewers({
      clients,
      slide: { volumeImages: [image], labelImages: [] },
      clusteringPixelSizeThreshold: 0.002,
    })
    expect(VolumeImageViewer).toHaveBeenCalledWith(
      expect.objectContaining({
        annotationOptions: { clusteringPixelSizeThreshold: 0.002 },
      }),
    )
  })

  it('builds a label viewer from the first label image', () => {
    const label = {
      ContainerIdentifier: 'L1',
    } as dmv.metadata.VLWholeSlideMicroscopyImage
    constructViewers({
      clients,
      slide: { volumeImages: [image], labelImages: [label] },
    })
    expect(LabelImageViewer).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        metadata: label,
        orientation: 'vertical',
      }),
    )
  })

  it('reports DMV errors through the notification middleware', () => {
    constructViewers({
      clients,
      slide: { volumeImages: [image], labelImages: [] },
    })
    const options = VolumeImageViewer.mock.calls[0][0] as {
      errorInterceptor: (error: Error) => void
    }
    const error = new Error('tile failed')
    options.errorInterceptor(error)
    expect(NotificationMiddleware.onError).toHaveBeenCalledWith(
      'dicom-microscopy-viewer',
      error,
    )
  })

  it('notifies and rethrows when the viewer cannot be created', () => {
    VolumeImageViewer.mockImplementation(() => {
      throw new Error('no WebGL')
    })
    expect(() =>
      constructViewers({
        clients,
        slide: { volumeImages: [image], labelImages: [] },
      }),
    ).toThrow('no WebGL')
    expect(NotificationMiddleware.onError).toHaveBeenCalledWith(
      'slim',
      expect.objectContaining({ message: 'Failed to instantiate viewer' }),
    )
  })

  it('cleans up the volume viewer when the label viewer cannot be created', () => {
    const cleanup = vi.fn()
    // biome-ignore lint/complexity/useArrowFunction: `new` needs a function implementation
    VolumeImageViewer.mockImplementation(function () {
      return {
        activateSelectInteraction,
        cleanup,
      } as Partial<dmv.viewer.VolumeImageViewer> as dmv.viewer.VolumeImageViewer
    })
    LabelImageViewer.mockImplementation(() => {
      throw new Error('bad label')
    })
    const label = {
      ContainerIdentifier: 'L1',
    } as dmv.metadata.VLWholeSlideMicroscopyImage

    expect(() =>
      constructViewers({
        clients,
        slide: { volumeImages: [image], labelImages: [label] },
      }),
    ).toThrow('bad label')
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})

describe('releaseViewer', () => {
  it('cleans up the viewer and ignores a missing one', () => {
    const cleanup = vi.fn()
    releaseViewer({ cleanup })
    releaseViewer(undefined)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('logs instead of throwing when cleanup fails', () => {
    const cleanup = vi.fn(() => {
      throw new Error('already gone')
    })
    expect(() => releaseViewer({ cleanup })).not.toThrow()
  })
})
