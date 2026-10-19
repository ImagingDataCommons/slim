import { describe, expect, it } from 'vitest'

import { buildDerivedLegendRows, paletteGradient } from '../derivedLegend'

describe('buildDerivedLegendRows', () => {
  it('includes fractional segments with palettes and skips binary', () => {
    const rows = buildDerivedLegendRows({
      segments: [
        {
          uid: 'frac',
          label: 'TILs',
          propertyType: { CodeMeaning: 'Tumor infiltration' },
        } as never,
        {
          uid: 'bin',
          label: 'Nuclei',
          propertyType: { CodeMeaning: 'Nucleus' },
        } as never,
      ],
      segmentMetadata: {
        frac: [{ SegmentationType: 'FRACTIONAL' } as never],
        bin: [{ SegmentationType: 'BINARY' } as never],
      },
      segmentStyles: {
        frac: {
          opacity: 1,
          paletteColorLookupTable: {
            data: [
              [0, 0, 0],
              [255, 0, 0],
            ],
          },
        },
        bin: {
          opacity: 1,
          paletteColorLookupTable: {
            data: [
              [0, 0, 0],
              [0, 255, 0],
            ],
          },
        },
      },
      visibleSegmentUIDs: new Set(['frac']),
      mappings: [],
      mappingStyles: {},
      visibleMappingUIDs: new Set(),
    })

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'frac',
        kind: 'segment',
        title: 'Tumor infiltration',
        isVisible: true,
      }),
    ])
  })

  it('includes parametric maps with palettes', () => {
    const rows = buildDerivedLegendRows({
      segments: [],
      segmentMetadata: {},
      segmentStyles: {},
      visibleSegmentUIDs: new Set(),
      mappings: [{ uid: 'ki67', label: 'Ki-67' } as never],
      mappingStyles: {
        ki67: {
          opacity: 0.8,
          paletteColorLookupTable: {
            data: [
              [0, 0, 255],
              [255, 255, 0],
            ],
          },
        },
      },
      visibleMappingUIDs: new Set(),
    })

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'ki67',
        kind: 'mapping',
        title: 'Ki-67',
        isVisible: false,
      }),
    ])
  })
})

describe('paletteGradient', () => {
  it('builds a CSS gradient from RGB stops', () => {
    expect(
      paletteGradient([
        [0, 0, 0],
        [255, 0, 0],
      ]),
    ).toBe('linear-gradient(to right, rgb(0, 0, 0), rgb(255, 0, 0))')
  })
})
