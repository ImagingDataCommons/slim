import type * as dmv from 'dicom-microscopy-viewer'

import {
  DEFAULT_ANNOTATION_COLOR_PALETTE,
  DEFAULT_ANNOTATION_OPACITY,
} from '../../../../components/SlideViewer/constants'
import { formatRoiStyle } from '../../../../components/SlideViewer/utils/roiUtils'
import {
  annotationStyleToRoiStyle,
  RoiStyleRegistry,
} from '../roiStyleRegistry'

const style = (color: number[], width = 2): dmv.viewer.ROIStyleOptions =>
  formatRoiStyle({ stroke: { color, width }, fill: { color } })

const DEFAULT_STYLE = style([1, 1, 1], 4)
const TUMOR_STYLE = style([200, 0, 0], 2)

const createRegistry = (): RoiStyleRegistry =>
  new RoiStyleRegistry({
    configuredStyles: { tumor: TUMOR_STYLE },
    findingKeys: ['tumor', 'necrosis'],
  })

describe('annotationStyleToRoiStyle', () => {
  it('lightens the fill unless only the contour is drawn', () => {
    const filled = annotationStyleToRoiStyle(
      { color: [10, 240, 0], opacity: 0.5, contourOnly: false },
      { radius: 4, strokeWidth: 3 },
    )
    expect(filled.stroke?.color).toEqual([10, 240, 0, 0.5])
    expect(filled.stroke?.width).toBe(3)
    expect(filled.fill?.color).toEqual([35, 255, 25, 0.5])
    expect(filled.image?.circle?.radius).toBe(4)

    const contour = annotationStyleToRoiStyle({
      color: [10, 240, 0],
      opacity: 0.5,
      contourOnly: true,
    })
    expect(contour.fill?.color.slice(0, 4)).toEqual([0, 0, 0, 0])
  })
})

describe('RoiStyleRegistry', () => {
  it('starts configured findings with their style; others use the live default', () => {
    const registry = createRegistry()

    expect(registry.findingStyle('tumor', DEFAULT_STYLE)).toBe(TUMOR_STYLE)
    expect(registry.findingStyle('necrosis', DEFAULT_STYLE)).toBe(DEFAULT_STYLE)
    expect(registry.findingStyle('necrosis', TUMOR_STYLE)).toBe(TUMOR_STYLE)
    expect(registry.findingStyle(undefined, TUMOR_STYLE)).toBe(TUMOR_STYLE)
    expect(registry.findingFillColor('tumor')).toEqual(TUMOR_STYLE.fill?.color)
    expect(registry.findingFillColor('necrosis')).toBeUndefined()
  })

  it('draws with the preference default even when the finding has a config style', () => {
    const registry = createRegistry()

    expect(registry.drawStyle('tumor', DEFAULT_STYLE)).toBe(DEFAULT_STYLE)
    expect(registry.drawStyle('necrosis', DEFAULT_STYLE)).toBe(DEFAULT_STYLE)
    expect(registry.drawStyle(undefined, DEFAULT_STYLE)).toBe(DEFAULT_STYLE)
  })

  it('keeps an added ROI style only when it differs from the configured one', () => {
    const registry = createRegistry()
    const own = style([0, 0, 200])

    registry.recordAddedRoi('configured', 'tumor', TUMOR_STYLE)
    registry.recordAddedRoi('custom', 'tumor', own)

    expect(registry.styleForRoi('configured', 'tumor', DEFAULT_STYLE)).toBe(
      TUMOR_STYLE,
    )
    expect(registry.styleForRoi('custom', 'tumor', DEFAULT_STYLE)).toBe(own)
  })

  it('gives an unstyled finding a palette color once', () => {
    const registry = new RoiStyleRegistry({
      configuredStyles: {},
      findingKeys: [],
    })

    registry.registerAnnotationStyle('roi-1', 'tumor', {
      radius: 5,
      strokeWidth: 4,
    })
    registry.registerAnnotationStyle('roi-1', 'tumor', {
      radius: 5,
      strokeWidth: 4,
    })

    expect(registry.copyAnnotationStyles()).toEqual({
      'roi-1': {
        color: DEFAULT_ANNOTATION_COLOR_PALETTE[0],
        opacity: DEFAULT_ANNOTATION_OPACITY,
        contourOnly: false,
      },
    })
    expect(registry.findingFillColor('tumor')).toBeDefined()
    expect(registry.findingStyle('tumor', DEFAULT_STYLE).stroke?.width).toBe(4)
  })

  it('takes the list color from the finding style when present', () => {
    const registry = createRegistry()

    registry.registerAnnotationStyle('roi-1', 'tumor', { radius: 5 })

    expect(registry.copyAnnotationStyles()['roi-1'].color).toEqual([200, 0, 0])
  })

  it('restyles the ROI and its finding, and forgets removed ROIs', () => {
    const registry = createRegistry()
    const restyled = style([0, 100, 0])
    const options = { color: [0, 100, 0], opacity: 1, contourOnly: false }

    registry.applyAnnotationStyle('roi-1', 'tumor', options, restyled)

    expect(registry.findingStyle('tumor', DEFAULT_STYLE)).toBe(restyled)
    expect(registry.styleForRoi('roi-1', undefined, DEFAULT_STYLE)).toBe(
      restyled,
    )
    expect(registry.copyAnnotationStyles()).toEqual({ 'roi-1': options })

    registry.forget('roi-1')

    expect(registry.copyAnnotationStyles()).toEqual({})
    expect(registry.styleForRoi('roi-1', undefined, DEFAULT_STYLE)).toBe(
      DEFAULT_STYLE,
    )
  })
})
