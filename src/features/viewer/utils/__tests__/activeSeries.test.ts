import { visibleDerivedSeriesUIDs } from '../activeSeries'

describe('visibleDerivedSeriesUIDs', () => {
  it('collects the series of the visible groups, segments and mappings', () => {
    const series = visibleDerivedSeriesUIDs(
      {
        annotationGroups: [
          { uid: 'g1', seriesInstanceUID: 'ann' },
          { uid: 'g2', seriesInstanceUID: 'ann-hidden' },
        ],
        segments: [{ uid: 's1', seriesInstanceUID: 'seg' }],
        mappings: [{ uid: 'm1', seriesInstanceUID: 'pm' }],
      },
      {
        annotationGroupUIDs: new Set(['g1']),
        segmentUIDs: new Set(['s1']),
        mappingUIDs: new Set(),
      },
    )

    expect([...series]).toEqual(['ann', 'seg'])
  })
})
