import { render, screen } from '@testing-library/react'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type * as React from 'react'
import { MemoryRouter } from 'react-router'

import { WorklistCard, WorklistCardSkeleton } from '../WorklistCard'

const study = {
  StudyInstanceUID: '1.2.3',
  PatientName: { Alphabetic: 'first^patient' },
  PatientID: 'P1',
  StudyDate: '20210128',
  AccessionNumber: 'A-99',
  ModalitiesInStudy: ['SM'],
  NumberOfStudyRelatedSeries: 2,
} as dmv.metadata.Study

function renderCard(marker?: React.ReactNode): void {
  render(
    <MemoryRouter>
      <WorklistCard
        study={study}
        hiddenColumnIds={[]}
        isCompact={false}
        onOpen={() => {}}
        marker={marker}
      />
    </MemoryRouter>,
  )
}

describe('WorklistCard', () => {
  it('keeps the check marker in flow instead of overlaying the name', () => {
    renderCard(<span role="status">Checking for Segmentation…</span>)

    const marker = screen.getByRole('status')
    expect(marker.parentElement?.className).toContain('flex-none')
    expect(marker.parentElement?.className).not.toContain('absolute')
    expect(screen.getByRole('row').className).toContain('flex')
  })

  it('reserves the marker column while a check is pending', () => {
    renderCard(null)
    const gutter = screen.getByRole('row').firstElementChild
    expect(gutter?.className).toContain('w-5')
    expect(gutter?.className).toContain('flex-none')
  })

  it('does not indent a card when no marker slot is passed', () => {
    renderCard()
    const first = screen.getByRole('row').firstElementChild
    expect(first?.className).not.toContain('w-5')
    expect(first).toHaveAttribute('role', 'cell')
  })
})

describe('WorklistCardSkeleton', () => {
  it('stacks placeholders instead of a table grid', () => {
    const { container } = render(
      <WorklistCardSkeleton isCompact={false} delayMs={0} />,
    )

    const row = container.firstElementChild
    expect(row?.className).not.toContain('grid')
    expect(row?.className).toContain('px-4')
    expect(
      container.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(1)
  })
})
