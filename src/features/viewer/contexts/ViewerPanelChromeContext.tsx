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

  useEffect(() => {
    if (!overlayPanels) return
    setLeftPanelOpen(false)
    setRightPanelOpen(false)
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

/**
 * Shared study/slide panel open state. Falls back to a local exclusive pair
 * when rendered outside CaseViewer (unit tests).
 */
export function useViewerPanelChrome(): ViewerPanelChrome {
  const context = useContext(ViewerPanelChromeContext)
  const fallback = useExclusivePanelState()
  return context ?? fallback
}
