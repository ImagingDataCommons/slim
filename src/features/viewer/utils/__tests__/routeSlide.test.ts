import type { Slide } from '../../../../data/slides'
import {
  canonicalSeriesPathname,
  findSeriesSlide,
  matchSlideForSeriesRoute,
  presentationStateUIDFromSearch,
  selectedSeriesForStudyPath,
} from '../routeSlide'

function slide(partial: {
  label: string
  seriesInstanceUIDs: string[]
}): Slide {
  return {
    seriesInstanceUIDs: partial.seriesInstanceUIDs,
    volumeImages: [
      {
        SeriesInstanceUID: partial.seriesInstanceUIDs[0],
        SOPInstanceUID: `${partial.label}-sop`,
      },
    ],
  } as unknown as Slide
}

const slides = [
  slide({ label: 'a', seriesInstanceUIDs: ['1.2.3'] }),
  slide({ label: 'b', seriesInstanceUIDs: ['1.2.3.2.0.1'] }),
]

describe('presentationStateUIDFromSearch', () => {
  it('reads state when access_token is absent', () => {
    expect(presentationStateUIDFromSearch('?state=pr-1')).toBe('pr-1')
    expect(presentationStateUIDFromSearch('state=pr-1')).toBe('pr-1')
  })

  it('ignores state when access_token is present', () => {
    expect(
      presentationStateUIDFromSearch('?state=pr-1&access_token=tok'),
    ).toBeUndefined()
  })

  it('returns undefined without state', () => {
    expect(presentationStateUIDFromSearch('')).toBeUndefined()
    expect(presentationStateUIDFromSearch('?gcp=x')).toBeUndefined()
  })
})

describe('selectedSeriesForStudyPath', () => {
  it('uses the fallback when the path has no series', () => {
    expect(
      selectedSeriesForStudyPath({
        slides,
        pathname: '/studies/1.2.3',
        fallbackSeriesInstanceUID: '1.2.3',
      }),
    ).toBe('1.2.3')
  })

  it('corrects a mangled series UID that matches a slide', () => {
    expect(
      selectedSeriesForStudyPath({
        slides,
        pathname: '/studies/s/series/1.2.3.2.0.1.0',
        fallbackSeriesInstanceUID: '1.2.3',
      }),
    ).toBe('1.2.3.2.0.1')
  })

  it('keeps an unknown series UID from the path', () => {
    expect(
      selectedSeriesForStudyPath({
        slides,
        pathname: '/studies/s/series/9.9.9',
        fallbackSeriesInstanceUID: '1.2.3',
      }),
    ).toBe('9.9.9')
  })
})

describe('matchSlideForSeriesRoute', () => {
  it('reports unchanged when the selected slide already matches', () => {
    expect(
      matchSlideForSeriesRoute({
        slides,
        seriesInstanceUID: '1.2.3',
        selectedSlide: slides[0],
      }),
    ).toEqual({ kind: 'unchanged', correctedSeriesUID: undefined })
  })

  it('corrects a mangled UID of the selected slide', () => {
    expect(
      matchSlideForSeriesRoute({
        slides,
        seriesInstanceUID: '1.2.3.0',
        selectedSlide: slides[0],
      }),
    ).toEqual({ kind: 'unchanged', correctedSeriesUID: '1.2.3' })
  })

  it('looks up a derived series named after a slide series', () => {
    expect(
      matchSlideForSeriesRoute({
        slides,
        seriesInstanceUID: '1.2.3.7',
        selectedSlide: slides[0],
      }),
    ).toEqual({ kind: 'lookupDerived' })
  })

  it('returns the image slide and optional UID correction', () => {
    expect(
      matchSlideForSeriesRoute({
        slides,
        seriesInstanceUID: '1.2.3.2.0.1.0',
        selectedSlide: undefined,
      }),
    ).toEqual({
      kind: 'image',
      slide: slides[1],
      correctedSeriesUID: '1.2.3.2.0.1',
    })

    expect(
      matchSlideForSeriesRoute({
        slides,
        seriesInstanceUID: '1.2.3',
        selectedSlide: undefined,
      }),
    ).toEqual({
      kind: 'image',
      slide: slides[0],
      correctedSeriesUID: undefined,
    })
  })

  it('asks for a derived lookup when no image slide matches', () => {
    expect(
      matchSlideForSeriesRoute({
        slides,
        seriesInstanceUID: 'derived',
        selectedSlide: undefined,
      }),
    ).toEqual({ kind: 'lookupDerived' })
  })
})

describe('findSeriesSlide', () => {
  it('finds by exact or mangled series UID', () => {
    expect(findSeriesSlide(slides, '1.2.3')).toBe(slides[0])
    expect(findSeriesSlide(slides, '1.2.3.2.0.1.0')).toBe(slides[1])
  })
})

describe('canonicalSeriesPathname', () => {
  const image = slide({ label: 'a', seriesInstanceUIDs: ['1.2.3'] })

  it('replaces a mangled series UID of the slide', () => {
    expect(canonicalSeriesPathname('/studies/9/series/1.2.3.0', image)).toBe(
      '/studies/9/series/1.2.3',
    )
  })

  it('keeps a canonical or derived series UID', () => {
    expect(canonicalSeriesPathname('/studies/9/series/1.2.3', image)).toBe(
      '/studies/9/series/1.2.3',
    )
    expect(canonicalSeriesPathname('/studies/9/series/4.5.6', image)).toBe(
      '/studies/9/series/4.5.6',
    )
    expect(canonicalSeriesPathname('/studies/9/series/1.2.3.7', image)).toBe(
      '/studies/9/series/1.2.3.7',
    )
    expect(canonicalSeriesPathname('/studies/9', image)).toBe('/studies/9')
  })
})
