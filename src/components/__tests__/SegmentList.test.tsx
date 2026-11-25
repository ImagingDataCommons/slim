import { fireEvent, render, screen } from '@testing-library/react'
import type * as dmv from 'dicom-microscopy-viewer'
import type { Mock } from 'vitest'

import SegmentList, { type SegmentListProps } from '../SegmentList'

function makeSegment(
  uid: string,
  label: string,
  isAbsent = false,
): dmv.segment.Segment {
  return {
    uid,
    number: 1,
    label,
    algorithmName: 'Test',
    algorithmType: 'AUTOMATIC',
    studyInstanceUID: '1.2',
    seriesInstanceUID: '1.2.3',
    sopInstanceUIDs: ['1.2.3.4'],
    isAbsent,
  } as unknown as dmv.segment.Segment
}

function renderList(overrides: Partial<SegmentListProps> = {}): {
  onBulkSegmentVisibilityChange: Mock
} {
  const onBulkSegmentVisibilityChange = vi.fn()
  const segments = overrides.segments ?? [
    makeSegment('tumor', 'Tumor'),
    makeSegment('stroma', 'Stroma'),
    makeSegment('absent', 'Absent class', true),
  ]
  render(
    <SegmentList
      segments={segments}
      visibleSegmentUIDs={new Set()}
      metadata={Object.fromEntries(segments.map(({ uid }) => [uid, []]))}
      defaultSegmentStyles={Object.fromEntries(
        segments.map(({ uid }) => [uid, { opacity: 0.75, color: [255, 0, 0] }]),
      )}
      onSegmentVisibilityChange={vi.fn()}
      onBulkSegmentVisibilityChange={onBulkSegmentVisibilityChange}
      onSegmentStyleChange={vi.fn()}
      onSegmentClick={vi.fn()}
      {...overrides}
    />,
  )
  return { onBulkSegmentVisibilityChange }
}

describe('SegmentList', () => {
  it('leaves absent segments out of the count and of Show all', () => {
    const { onBulkSegmentVisibilityChange } = renderList({
      visibleSegmentUIDs: new Set(['tumor']),
    })

    expect(screen.getByText('1 of 2 visible')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show all segments' }))
    expect(onBulkSegmentVisibilityChange).toHaveBeenCalledWith([
      { uid: 'stroma', isVisible: true },
    ])
  })

  it('disables Show all once every present segment is shown', () => {
    renderList({ visibleSegmentUIDs: new Set(['tumor', 'stroma']) })

    expect(screen.getByText('2 of 2 visible')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Show all segments' }),
    ).toBeDisabled()
  })

  it('keeps the visibility controls for a single segment', () => {
    renderList({ segments: [makeSegment('tumor', 'Tumor')] })

    expect(screen.getByText('0 of 1 visible')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Show all segments' }),
    ).toBeEnabled()
  })
})
