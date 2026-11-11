import { render, screen } from '@testing-library/react'

import {
  type LayoutMode,
  LayoutModeProvider,
} from '../../../../contexts/LayoutModeContext'
import { WorklistPagination } from '../WorklistPagination'

const COMPACT: LayoutMode = {
  compactChrome: true,
  overlayPanels: true,
  coarsePointer: true,
}

describe('WorklistPagination', () => {
  it('enlarges page arrows under compact chrome', () => {
    render(
      <LayoutModeProvider value={COMPACT}>
        <WorklistPagination
          pagination={{ pageIndex: 0, pageSize: 20 }}
          totalCount={40}
          onPaginationChange={() => {}}
        />
      </LayoutModeProvider>,
    )

    expect(
      screen.getByRole('button', { name: 'Previous page' }).className,
    ).toContain('min-h-11')
    expect(
      screen.getByRole('button', { name: 'Next page' }).className,
    ).toContain('min-h-11')
  })
})
