import type React from 'react'
import { useSyncExternalStore } from 'react'

import HoveredRoiTooltip from '../../../components/HoveredRoiTooltip'
import type { ExternalStore } from '../services/externalStore'
import type { HoveredRoi } from '../utils/hoveredRois'

export interface HoveredRoiTooltipState {
  isVisible: boolean
  x: number
  y: number
  rois: HoveredRoi[]
}

export const HIDDEN_HOVERED_ROI_TOOLTIP: HoveredRoiTooltipState = {
  isVisible: false,
  x: 0,
  y: 0,
  rois: [],
}

export interface HoveredRoiTooltipLayerProps {
  store: ExternalStore<HoveredRoiTooltipState>
}

/** Renders the hover tooltip from its own store so pointer moves stay local. */
export function HoveredRoiTooltipLayer({
  store,
}: HoveredRoiTooltipLayerProps): React.ReactElement | null {
  const { isVisible, x, y, rois } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  )
  if (!isVisible || rois.length === 0) return null
  return <HoveredRoiTooltip xPosition={x} yPosition={y} rois={rois} />
}
