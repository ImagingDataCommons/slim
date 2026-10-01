import { fireEvent, render, screen } from '@testing-library/react'
import * as dcmjs from 'dcmjs'
import type * as dmv from 'dicom-microscopy-viewer'

import SegmentItem, { type SegmentItemProps } from '../../SegmentItem'

const concept = (meaning: string): dcmjs.sr.coding.CodedConcept =>
  new dcmjs.sr.coding.CodedConcept({
    value: '1',
    schemeDesignator: 'SCT',
    meaning,
  })

function makeSegment(isAbsent = false): dmv.segment.Segment {
  return {
    uid: 'segment-1',
    number: 1,
    label: 'Nuclei',
    algorithmType: 'AUTOMATIC',
    algorithmName: 'Seg',
    propertyCategory: concept('Tissue'),
    propertyType: concept('Nucleus'),
    studyInstanceUID: '1.2',
    seriesInstanceUID: '1.2.3',
    sopInstanceUIDs: ['1.2.3.4'],
    isAbsent,
  }
}

function renderItem(overrides: Partial<SegmentItemProps> = {}): {
  onVisibilityChange: jest.Mock
  onStyleChange: jest.Mock
} {
  const onVisibilityChange = jest.fn()
  const onStyleChange = jest.fn()
  render(
    <SegmentItem
      segment={makeSegment()}
      isVisible
      defaultStyle={{ opacity: 0.5, color: [255, 0, 0] }}
      onVisibilityChange={onVisibilityChange}
      onStyleChange={onStyleChange}
      onClick={jest.fn()}
      {...overrides}
    />,
  )
  return { onVisibilityChange, onStyleChange }
}

describe('SegmentItem', () => {
  it('toggles the segment visibility', () => {
    const { onVisibilityChange } = renderItem()
    fireEvent.click(screen.getByRole('button', { name: 'Show Nuclei' }))
    expect(onVisibilityChange).toHaveBeenCalledWith({
      segmentUID: 'segment-1',
      isVisible: false,
    })
  })

  it('commits only the opacity when the slider changes', () => {
    const { onStyleChange } = renderItem()
    const slider = screen.getByRole('slider', { name: 'Opacity of Nuclei' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onStyleChange).toHaveBeenCalledTimes(1)
    expect(onStyleChange).toHaveBeenCalledWith({
      segmentUID: 'segment-1',
      styleOptions: { opacity: 0.51 },
    })
    expect(screen.getByText('51%')).toBeInTheDocument()
  })

  it('disables the controls of an absent segment', () => {
    const { onVisibilityChange } = renderItem({ segment: makeSegment(true) })
    const toggle = screen.getByRole('button', { name: 'Show Nuclei' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(onVisibilityChange).not.toHaveBeenCalled()
    expect(screen.getByText('Absent')).toBeInTheDocument()
  })
})
