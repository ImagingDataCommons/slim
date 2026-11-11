import { describe, expect, it } from 'vitest'

import { buildDerivedLegendRows } from '../derivedLegend'

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
        frac: [{ SegmentationType: 'FRACTIONAL', BitsAllocated: 8 } as never],
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
      mappingMetadata: {},
      mappingStyles: {},
      visibleMappingUIDs: new Set(),
    })

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'frac',
        kind: 'segment',
        title: 'Tumor infiltration',
        minLabel: '0',
        maxLabel: '255',
        isVisible: true,
      }),
    ])
    expect(rows[0].palette.data).toHaveLength(2)
  })

  it('includes parametric maps with real-world bounds when present', () => {
    const rows = buildDerivedLegendRows({
      segments: [],
      segmentMetadata: {},
      segmentStyles: {},
      visibleSegmentUIDs: new Set(),
      mappings: [{ uid: 'ki67', label: 'Ki-67' } as never],
      mappingMetadata: {
        ki67: [
          {
            BitsAllocated: 16,
            RealWorldValueMappingSequence: [
              {
                RealWorldValueFirstValueMapped: 0,
                RealWorldValueLastValueMapped: 100,
                RealWorldValueSlope: 0.01,
                RealWorldValueIntercept: 0,
              },
            ],
          } as never,
        ],
      },
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
        minLabel: '0.00',
        maxLabel: '1.00',
        isVisible: false,
      }),
    ])
  })
})
