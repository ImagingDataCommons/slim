import { render, screen } from '@testing-library/react'

import {
  Dialog,
  DialogContent,
  SlimDialogHeader,
  type SlimDialogHeaderProps,
} from '../dialog'

function renderHeader(props: Partial<SlimDialogHeaderProps> = {}): void {
  render(
    <Dialog open>
      <DialogContent>
        <SlimDialogHeader icon="dns" title="Server" {...props} />
      </DialogContent>
    </Dialog>,
  )
}

describe('SlimDialogHeader', () => {
  it('names and describes the dialog', () => {
    renderHeader({ subtitle: 'Choose a server' })
    const dialog = screen.getByRole('dialog', { name: 'Server' })
    expect(dialog).toHaveAccessibleDescription('Choose a server')
  })

  it('renders a single description', () => {
    renderHeader({ subtitle: 'Choose a server' })
    expect(screen.getAllByText('Choose a server')).toHaveLength(1)
  })

  it('uses the primary tile by default and the destructive tone on request', () => {
    const { unmount } = render(
      <Dialog open>
        <DialogContent>
          <SlimDialogHeader icon="dns" title="A" subtitle="a" />
        </DialogContent>
      </Dialog>,
    )
    expect(document.querySelector('.bg-primary-soft')).not.toBeNull()
    unmount()
    render(
      <Dialog open>
        <DialogContent>
          <SlimDialogHeader
            icon="bug_report"
            title="B"
            subtitle="b"
            tone="destructive"
          />
        </DialogContent>
      </Dialog>,
    )
    expect(document.querySelector('.bg-destructive-soft')).not.toBeNull()
    expect(document.querySelector('.bg-primary-soft')).toBeNull()
  })

  it('has a labelled close button', () => {
    renderHeader({ subtitle: 'x' })
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
