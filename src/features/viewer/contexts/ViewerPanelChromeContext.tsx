import type * as React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useLayoutMode } from '../../../contexts/LayoutModeContext'

export interface ViewerPanelChrome {
  overlayPanels: boolean
  isLeftPanelOpen: boolean
  isRightPanelOpen: boolean
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  closeLeftPanel: () => void
  closeRightPanel: () => void
  setLeftPanelOpen: (open: boolean) => void
  setRightPanelOpen: (open: boolean) => void
}

const ViewerPanelChromeContext = createContext<ViewerPanelChrome | null>(null)

function useExclusivePanelState(): ViewerPanelChrome {
  const { overlayPanels } = useLayoutMode()
  const [isLeftPanelOpen, setLeftPanelOpen] = useState(() => !overlayPanels)
  const [isRightPanelOpen, setRightPanelOpen] = useState(() => !overlayPanels)

  /**
   * Overlay sheets start closed so they do not cover the canvas; desktop rails
   * start open. Switching layout (rotation, resize) resets to that default.
   */
  useEffect(() => {
    setLeftPanelOpen(!overlayPanels)
    setRightPanelOpen(!overlayPanels)
  }, [overlayPanels])

  const toggleLeftPanel = useCallback((): void => {
    setLeftPanelOpen((isOpen) => {
      const next = !isOpen
      if (overlayPanels && next) setRightPanelOpen(false)
      return next
    })
  }, [overlayPanels])

  const toggleRightPanel = useCallback((): void => {
    setRightPanelOpen((isOpen) => {
      const next = !isOpen
      if (overlayPanels && next) setLeftPanelOpen(false)
      return next
    })
  }, [overlayPanels])

  const closeLeftPanel = useCallback((): void => {
    setLeftPanelOpen(false)
  }, [])

  const closeRightPanel = useCallback((): void => {
    setRightPanelOpen(false)
  }, [])

  const openLeftExclusively = useCallback(
    (open: boolean): void => {
      setLeftPanelOpen(open)
      if (overlayPanels && open) setRightPanelOpen(false)
    },
    [overlayPanels],
  )

  const openRightExclusively = useCallback(
    (open: boolean): void => {
      setRightPanelOpen(open)
      if (overlayPanels && open) setLeftPanelOpen(false)
    },
    [overlayPanels],
  )

  return useMemo(
    () => ({
      overlayPanels,
      isLeftPanelOpen,
      isRightPanelOpen,
      toggleLeftPanel,
      toggleRightPanel,
      closeLeftPanel,
      closeRightPanel,
      setLeftPanelOpen: openLeftExclusively,
      setRightPanelOpen: openRightExclusively,
    }),
    [
      overlayPanels,
      isLeftPanelOpen,
      isRightPanelOpen,
      toggleLeftPanel,
      toggleRightPanel,
      closeLeftPanel,
      closeRightPanel,
      openLeftExclusively,
      openRightExclusively,
    ],
  )
}

export function ViewerPanelChromeProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const value = useExclusivePanelState()
  return (
    <ViewerPanelChromeContext.Provider value={value}>
      {children}
    </ViewerPanelChromeContext.Provider>
  )
}

const noop = (): void => {}

/** Desktop rails, both open, for viewers rendered outside CaseViewer */
const STATIC_PANEL_CHROME: ViewerPanelChrome = {
  overlayPanels: false,
  isLeftPanelOpen: true,
  isRightPanelOpen: true,
  toggleLeftPanel: noop,
  toggleRightPanel: noop,
  closeLeftPanel: noop,
  closeRightPanel: noop,
  setLeftPanelOpen: noop,
  setRightPanelOpen: noop,
}

/**
 * Shared study/slide panel open state. Outside CaseViewer (unit tests) it
 * returns static desktop chrome instead of allocating unused state.
 */
export function useViewerPanelChrome(): ViewerPanelChrome {
  return useContext(ViewerPanelChromeContext) ?? STATIC_PANEL_CHROME
}
