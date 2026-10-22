import { act, renderHook } from '@testing-library/react'
import type * as React from 'react'

import { LayoutModeProvider } from '../../../../contexts/LayoutModeContext'
import {
  useViewerPanelChrome,
  ViewerPanelChromeProvider,
} from '../ViewerPanelChromeContext'

function overlayWrapper({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <LayoutModeProvider
      value={{
        compactChrome: true,
        overlayPanels: true,
        coarsePointer: true,
      }}
    >
      <ViewerPanelChromeProvider>{children}</ViewerPanelChromeProvider>
    </LayoutModeProvider>
  )
}

describe('ViewerPanelChromeProvider', () => {
  it('defaults both panels closed on overlay and keeps them exclusive', () => {
    const { result } = renderHook(() => useViewerPanelChrome(), {
      wrapper: overlayWrapper,
    })
    expect(result.current.isLeftPanelOpen).toBe(false)
    expect(result.current.isRightPanelOpen).toBe(false)

    act(() => {
      result.current.toggleLeftPanel()
    })
    expect(result.current.isLeftPanelOpen).toBe(true)
    expect(result.current.isRightPanelOpen).toBe(false)

    act(() => {
      result.current.setRightPanelOpen(true)
    })
    expect(result.current.isLeftPanelOpen).toBe(false)
    expect(result.current.isRightPanelOpen).toBe(true)
  })

  it('closes the study panel independently', () => {
    const { result } = renderHook(() => useViewerPanelChrome(), {
      wrapper: overlayWrapper,
    })
    act(() => {
      result.current.setLeftPanelOpen(true)
    })
    act(() => {
      result.current.closeLeftPanel()
    })
    expect(result.current.isLeftPanelOpen).toBe(false)
  })

  it('reopens both rails when the layout returns to desktop', () => {
    let overlayPanels = true
    const wrapper = ({
      children,
    }: {
      children: React.ReactNode
    }): React.ReactElement => (
      <LayoutModeProvider
        value={{
          compactChrome: overlayPanels,
          overlayPanels,
          coarsePointer: false,
        }}
      >
        <ViewerPanelChromeProvider>{children}</ViewerPanelChromeProvider>
      </LayoutModeProvider>
    )
    const { result, rerender } = renderHook(() => useViewerPanelChrome(), {
      wrapper,
    })
    expect(result.current.isLeftPanelOpen).toBe(false)

    overlayPanels = false
    rerender()

    expect(result.current.overlayPanels).toBe(false)
    expect(result.current.isLeftPanelOpen).toBe(true)
    expect(result.current.isRightPanelOpen).toBe(true)
  })
})
