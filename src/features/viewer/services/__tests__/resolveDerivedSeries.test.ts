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

function client(
  retrieveSeriesMetadata: () => Promise<unknown[]>,
): DicomWebManager {
  return {
    retrieveSeriesMetadata: vi.fn(retrieveSeriesMetadata),
  } as unknown as DicomWebManager
}

describe('resolveDerivedSeriesSlide', () => {
  it('finds a derived series on a store of its storage class', async () => {
    const slide = createTestSlide(IMAGE_SERIES)
    const slideClient = client(async () => {
      throw new Error('404')
    })
    const annotationClient = client(async () => [derivedMetadata])
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
    expect(slideClient.retrieveSeriesMetadata).toHaveBeenCalledTimes(1)
  })

  it('stops at the slide client when it has the series', async () => {
    const slide = createTestSlide(IMAGE_SERIES)
    const slideClient = client(async () => [derivedMetadata])
    const annotationClient = client(async () => [derivedMetadata])
    await resolveDerivedSeriesSlide({
      clients: {
        [StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION]: annotationClient,
        [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: slideClient,
      },
      slides: [slide],
      studyInstanceUID: STUDY,
      seriesInstanceUID: DERIVED_SERIES,
    })

    expect(annotationClient.retrieveSeriesMetadata).not.toHaveBeenCalled()
  })

  it('is unresolved when no store has the series', async () => {
    const empty = client(async () => [])
    const resolution = await resolveDerivedSeriesSlide({
      clients: { [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: empty },
      slides: [createTestSlide(IMAGE_SERIES)],
      studyInstanceUID: STUDY,
      seriesInstanceUID: DERIVED_SERIES,
    })

    expect(resolution.kind).toBe('unresolved')
  })
})
