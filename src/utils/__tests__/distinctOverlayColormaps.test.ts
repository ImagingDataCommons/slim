/** skipcq: JS-C1003 */

import type * as dmv from 'dicom-microscopy-viewer'
import type { Mock } from 'vitest'

import {
  applyDistinctFractionalSegmentPalettes,
  applyDistinctParametricMapPalettes,
} from '../distinctOverlayColormaps'

vi.mock('dicom-microscopy-viewer', () => ({
  color: {
    createDistinctColormap: ({ index }: { index: number }) => [
      [index, index, index],
    ],
    buildPaletteColorLookupTable: ({ data }: { data: number[][] }) => ({
      table: data[0][0],
    }),
  },
}))

type Viewer = dmv.viewer.VolumeImageViewer
type Segment = ReturnType<Viewer['getAllSegments']>[number]
type Mapping = ReturnType<Viewer['getAllParameterMappings']>[number]

const palette = {} as dmv.color.PaletteColorLookupTable

interface FakeSegment {
  uid: string
  number: number
  type?: 'BINARY' | 'FRACTIONAL'
  lab?: number[]
}

function segmentViewer(segments: FakeSegment[]): {
  viewer: dmv.viewer.VolumeImageViewer
  setSegmentStyle: Mock
} {
  const setSegmentStyle = vi.fn()
  const fake: Partial<dmv.viewer.VolumeImageViewer> = {
    getAllSegments: () =>
      segments.map(
        (segment) =>
          ({
            uid: segment.uid,
            number: segment.number,
          }) as Segment,
      ),
    getSegmentMetadata: (uid: string) => {
      const segment = segments.find((item) => item.uid === uid)
      if (segment === undefined) return []
      const item = {
        SegmentNumber: segment.number,
        SegmentLabel: segment.uid,
        SegmentedPropertyCategoryCodeSequence: [],
        SegmentedPropertyTypeCodeSequence: [],
        RecommendedDisplayCIELabValue: segment.lab,
      }
      const metadata: Partial<dmv.metadata.Segmentation> = {
        SegmentationType: segment.type,
        SegmentSequence: [item],
      }
      return [metadata as dmv.metadata.Segmentation]
    },
    getSegmentStyle: () => ({ opacity: 0.7, paletteColorLookupTable: palette }),
    setSegmentStyle,
  }
  return { viewer: fake as dmv.viewer.VolumeImageViewer, setSegmentStyle }
}

describe('applyDistinctFractionalSegmentPalettes', () => {
  it('cycles palettes over fractional segments without a display color', () => {
    const { viewer, setSegmentStyle } = segmentViewer([
      { uid: 'a', number: 1, type: 'FRACTIONAL' },
      { uid: 'b', number: 2, type: 'BINARY' },
      { uid: 'c', number: 3, type: 'FRACTIONAL', lab: [50, 10, -20] },
      { uid: 'd', number: 4, type: 'FRACTIONAL' },
    ])
    applyDistinctFractionalSegmentPalettes(viewer)
    expect(setSegmentStyle.mock.calls).toEqual([
      ['a', { opacity: 0.7, paletteColorLookupTable: { table: 0 } }],
      ['d', { opacity: 0.7, paletteColorLookupTable: { table: 1 } }],
    ])
  })

  it('leaves a single fractional segment alone', () => {
    const { viewer, setSegmentStyle } = segmentViewer([
      { uid: 'a', number: 1, type: 'FRACTIONAL' },
      { uid: 'b', number: 2 },
    ])
    applyDistinctFractionalSegmentPalettes(viewer)
    expect(setSegmentStyle).not.toHaveBeenCalled()
  })
})

describe('applyDistinctParametricMapPalettes', () => {
  function mappingViewer(count: number): {
    viewer: dmv.viewer.VolumeImageViewer
    setParameterMappingStyle: Mock
  } {
    const setParameterMappingStyle = vi.fn()
    const fake: Partial<dmv.viewer.VolumeImageViewer> = {
      getAllParameterMappings: () =>
        Array.from(
          { length: count },
          (_, index) => ({ uid: `m${index}` }) as Mapping,
        ),
      getParameterMappingStyle: () => ({
        opacity: 1,
        limitValues: [0, 10],
        paletteColorLookupTable: palette,
      }),
      setParameterMappingStyle,
    }
    return {
      viewer: fake as dmv.viewer.VolumeImageViewer,
      setParameterMappingStyle,
    }
  }

  it('gives each mapping its own palette', () => {
    const { viewer, setParameterMappingStyle } = mappingViewer(2)
    applyDistinctParametricMapPalettes(viewer)
    expect(setParameterMappingStyle.mock.calls).toEqual([
      [
        'm0',
        {
          opacity: 1,
          limitValues: [0, 10],
          paletteColorLookupTable: { table: 0 },
        },
      ],
      [
        'm1',
        {
          opacity: 1,
          limitValues: [0, 10],
          paletteColorLookupTable: { table: 1 },
        },
      ],
    ])
  })

  it('leaves a single mapping alone', () => {
    const { viewer, setParameterMappingStyle } = mappingViewer(1)
    applyDistinctParametricMapPalettes(viewer)
    expect(setParameterMappingStyle).not.toHaveBeenCalled()
  })
})
