import type DicomWebManager from '../../../../DicomWebManager'
import { StorageClasses } from '../../../../data/uids'
import { createTestSlide } from '../../testing/fixtures'
import { resolveDerivedSeriesSlide } from '../resolveDerivedSeries'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')

const STUDY = '2.25.1'
const IMAGE_SERIES = '2.25.900000000000000000000000000000000000002'
const DERIVED_SERIES = '2.25.900000000000000000000000000000000000099'

/** DICOM JSON of a derived instance referencing the image series */
const derivedMetadata = {
  '0020000E': { vr: 'UI', Value: [DERIVED_SERIES] },
  '00080018': { vr: 'UI', Value: ['2.25.7'] },
  '00081115': {
    vr: 'SQ',
    Value: [{ '0020000E': { vr: 'UI', Value: [IMAGE_SERIES] } }],
  },
}

/** Client whose stores have the series when `metadata` is given */
function client(
  metadata?: unknown[],
  options: { failRetrieve?: boolean } = {},
): DicomWebManager {
  return {
    searchForSeries: vi.fn(async () =>
      metadata === undefined
        ? []
        : [{ '0020000E': { Value: [DERIVED_SERIES] } }],
    ),
    retrieveSeriesMetadata: vi.fn(async () => {
      if (options.failRetrieve === true) throw new Error('500')
      return metadata ?? []
    }),
  } as unknown as DicomWebManager
}

describe('resolveDerivedSeriesSlide', () => {
  it('finds a derived series on a store of its storage class', async () => {
    const slide = createTestSlide(IMAGE_SERIES)
    const slideClient = client()
    const annotationClient = client([derivedMetadata])
    const resolution = await resolveDerivedSeriesSlide({
      clients: {
        default: slideClient,
        [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: slideClient,
        [StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION]: annotationClient,
      },
      slides: [slide],
      studyInstanceUID: STUDY,
      seriesInstanceUID: DERIVED_SERIES,
    })

    expect(resolution.kind).toBe('referenced')
    if (resolution.kind === 'referenced') {
      expect(resolution.slide).toBe(slide)
    }
    /** Stores without the series are searched, never asked to retrieve */
    expect(slideClient.searchForSeries).toHaveBeenCalledTimes(1)
    expect(slideClient.retrieveSeriesMetadata).not.toHaveBeenCalled()
  })

  it('retrieves from the first client in order that has the series', async () => {
    const slide = createTestSlide(IMAGE_SERIES)
    const slideClient = client([derivedMetadata])
    const annotationClient = client([derivedMetadata])
    await resolveDerivedSeriesSlide({
      clients: {
        [StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION]: annotationClient,
        [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: slideClient,
      },
      slides: [slide],
      studyInstanceUID: STUDY,
      seriesInstanceUID: DERIVED_SERIES,
    })

    expect(slideClient.retrieveSeriesMetadata).toHaveBeenCalledTimes(1)
    expect(annotationClient.retrieveSeriesMetadata).not.toHaveBeenCalled()
  })

  it('asks the other clients when one search fails', async () => {
    const slide = createTestSlide(IMAGE_SERIES)
    const failing = client()
    vi.mocked(failing.searchForSeries).mockRejectedValue(new Error('500'))
    const annotationClient = client([derivedMetadata])
    const resolution = await resolveDerivedSeriesSlide({
      clients: {
        [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: failing,
        [StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION]: annotationClient,
      },
      slides: [slide],
      studyInstanceUID: STUDY,
      seriesInstanceUID: DERIVED_SERIES,
    })

    expect(resolution.kind).toBe('referenced')
  })

  it('is unresolved when no store has the series', async () => {
    const resolution = await resolveDerivedSeriesSlide({
      clients: { [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: client() },
      slides: [createTestSlide(IMAGE_SERIES)],
      studyInstanceUID: STUDY,
      seriesInstanceUID: DERIVED_SERIES,
    })

    expect(resolution.kind).toBe('unresolved')
  })

  it('is unresolved instead of rejecting when metadata cannot be read', async () => {
    const malformed = client([{ '0020000E': { vr: 'XX' } }], {
      failRetrieve: true,
    })
    const resolution = await resolveDerivedSeriesSlide({
      clients: { [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: malformed },
      slides: [createTestSlide(IMAGE_SERIES)],
      studyInstanceUID: STUDY,
      seriesInstanceUID: DERIVED_SERIES,
    })

    expect(resolution.kind).toBe('unresolved')
  })
})
