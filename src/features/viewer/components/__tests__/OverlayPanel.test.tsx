import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import { OverlayPanel } from '../OverlayPanel'

let mounts = 0

function Counter(): React.ReactElement {
  const [count, setCount] = useState(() => {
    mounts += 1
    return 0
  })
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      Count {count}
    </button>
  )
}

function Harness({ open }: { open: boolean }): React.ReactElement {
  return (
    <OverlayPanel open={open} onOpenChange={vi.fn()} side="left" title="Study">
      <Counter />
    </OverlayPanel>
  )
}

describe('OverlayPanel', () => {
  beforeEach(() => {
    mounts = 0
  })

  it('keeps its children mounted while the sheet is closed', () => {
    const { rerender } = render(<Harness open />)
    fireEvent.click(screen.getByRole('button', { name: 'Count 0' }))
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument()

    rerender(<Harness open={false} />)
    expect(screen.queryByRole('button', { name: /Count/ })).toBeNull()

    rerender(<Harness open />)
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument()
    expect(mounts).toBe(1)
  })

  it('mounts its children only once the sheet first opens', () => {
    const { rerender } = render(<Harness open={false} />)
    expect(mounts).toBe(0)

    rerender(<Harness open />)
    expect(screen.getByRole('button', { name: 'Count 0' })).toBeInTheDocument()
    expect(mounts).toBe(1)
  })
})
