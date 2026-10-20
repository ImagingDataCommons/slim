import { render, screen } from '@testing-library/react'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

import {
  type LayoutMode,
  LayoutModeProvider,
} from '../../../../contexts/LayoutModeContext'
import { WorklistTable } from '../WorklistTable'

const COMPACT: LayoutMode = {
  compactChrome: true,
  overlayPanels: true,
  coarsePointer: true,
}

const DESKTOP: LayoutMode = {
  compactChrome: false,
  overlayPanels: false,
  coarsePointer: false,
}

const pagination = { pageIndex: 0, pageSize: 20 }

const study = {
  StudyInstanceUID: '1.2.3',
  PatientName: { Alphabetic: 'first^patient' },
  PatientID: 'P1',
  StudyDate: '20210128',
  AccessionNumber: 'A-99',
  ModalitiesInStudy: ['SM'],
  NumberOfStudyRelatedSeries: 2,
} as dmv.metadata.Study

function renderTable({
  compact,
  isLoading,
  data = [],
  renderRowMarker,
}: {
  compact: boolean
  isLoading: boolean
  data?: dmv.metadata.Study[]
  renderRowMarker?: (study: dmv.metadata.Study) => ReactNode
}): ReturnType<typeof render> {
  return render(
    <LayoutModeProvider value={compact ? COMPACT : DESKTOP}>
      <MemoryRouter>
        <WorklistTable
          data={data}
          isLoading={isLoading}
          emptyMessage="None"
          isCompact={false}
          onRowClick={() => {}}
          pagination={pagination}
          onPaginationChange={() => {}}
          renderRowMarker={renderRowMarker}
        />
      </MemoryRouter>
    </LayoutModeProvider>,
  )
}

describe('WorklistTable', () => {
  it('stacks card skeletons under compact chrome instead of a column grid', () => {
    const { container } = renderTable({ compact: true, isLoading: true })

    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    expect(screen.getByText('Loading studies…')).toBeInTheDocument()
    expect(container.querySelector('.grid.w-full')).toBeNull()
    expect(
      container.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(1)
  })

  it('keeps table-grid skeletons on desktop chrome', () => {
    const { container } = renderTable({ compact: false, isLoading: true })

    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
    expect(container.querySelector('.grid.w-full')).not.toBeNull()
  })

  it('keeps the row check marker in flow on compact cards', () => {
    renderTable({
      compact: true,
      isLoading: false,
      data: [study],
      renderRowMarker: () => <span role="status">Checking</span>,
    })

    const marker = screen.getByRole('status')
    expect(marker.parentElement?.className).toContain('flex-none')
    expect(marker.parentElement?.className).not.toContain('absolute')
    expect(screen.getByRole('row').className).toContain('flex')
  })
})
