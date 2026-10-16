import { render, screen } from '@testing-library/react'

import { ViewerToolbar } from '../ViewerToolbar'

function renderToolbar(): void {
  render(
    <ViewerToolbar
      isLeftPanelOpen
      onToggleLeftPanel={vi.fn()}
      isRightPanelOpen
      onToggleRightPanel={vi.fn()}
      enableAnnotationTools
      activeTool="draw"
      areRoisHidden={false}
      onDraw={vi.fn()}
      onModify={vi.fn()}
      onTranslate={vi.fn()}
      onRemove={vi.fn()}
      onToggleRoiVisibility={vi.fn()}
      onSave={vi.fn()}
      onGoTo={vi.fn()}
    />,
  )
}

describe('ViewerToolbar', () => {
  it('shows the keyboard shortcut of each tool in its tooltip', () => {
    renderToolbar()
    const tooltips = {
      Draw: 'Draw ROI [Alt+D]',
      Modify: 'Modify ROIs [Alt+M]',
      Translate: 'Translate ROIs [Alt+T]',
      Remove: 'Remove selected ROI [Alt+R]',
      Hide: 'Show / hide ROIs [Alt+V]',
      Save: 'Save ROIs [Alt+S]',
      'Go to': 'Go to position [Alt+G]',
    }
    for (const [label, tooltip] of Object.entries(tooltips)) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute(
        'title',
        tooltip,
      )
    }
  })

  it('marks the active tool as pressed', () => {
    renderToolbar()
    expect(screen.getByRole('button', { name: 'Draw' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Modify' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
