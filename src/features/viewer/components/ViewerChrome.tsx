import { type ComponentProps, type JSX, useState } from 'react'

import type { OverlayStatus } from '../utils/overlayLoading'
import { DerivedLegend, type DerivedLegendProps } from './DerivedLegend'
import { ViewerFooter } from './ViewerFooter'
import { ViewerToolbar } from './ViewerToolbar'
import { ViewportLoadingIndicator } from './ViewportLoadingIndicator'
import { ViewportOverlays } from './ViewportOverlays'

export type ViewerChromeToolbarProps = ComponentProps<typeof ViewerToolbar>

export type ViewerChromeOverlaysProps = ComponentProps<
  typeof ViewportOverlays
> & {
  viewerKey: string
  /** Viewport status pill text; hidden when undefined */
  statusLabel: string | undefined
  /** Bottom pill while overlays load; hidden when undefined */
  overlayStatus: OverlayStatus | undefined
  derivedLegend: DerivedLegendProps
}

export type ViewerChromeFooterProps = Omit<
  ComponentProps<typeof ViewerFooter>,
  'resetKey'
> & {
  viewerKey: string
}

/** Toolbar slot for the slide viewer chrome. */
export function ViewerChromeToolbar(
  props: ViewerChromeToolbarProps,
): JSX.Element {
  return <ViewerToolbar {...props} />
}

/** Viewport overlays and the slide's loading status. */
export function ViewerChromeOverlays({
  viewerKey,
  statusLabel,
  overlayStatus,
  derivedLegend,
  ...overlayProps
}: ViewerChromeOverlaysProps): JSX.Element {
  /**
   * The legend appears once an overlay it lists is shown, then stays for
   * this viewer while rows exist, so its eye toggles can turn hidden
   * overlays back on. Slides whose overlays were never shown get no legend.
   */
  /** The pill fades out with the text it last showed */
  const [lastStatusLabel, setLastStatusLabel] = useState('Loading slide')
  if (statusLabel !== undefined && statusLabel !== lastStatusLabel) {
    setLastStatusLabel(statusLabel)
  }
  const [lastOverlayStatus, setLastOverlayStatus] = useState<OverlayStatus>({
    label: 'Loading overlays',
    progress: undefined,
  })
  if (
    overlayStatus !== undefined &&
    (overlayStatus.label !== lastOverlayStatus.label ||
      overlayStatus.progress !== lastOverlayStatus.progress)
  ) {
    setLastOverlayStatus(overlayStatus)
  }
  /** One pill at a time: the slide's own status comes first */
  const showsOverlayStatus =
    overlayStatus !== undefined && statusLabel === undefined
  const [legendShownFor, setLegendShownFor] = useState<string | undefined>()
  const hasVisibleRow = derivedLegend.rows.some((row) => row.isVisible)
  if (hasVisibleRow && legendShownFor !== viewerKey) {
    setLegendShownFor(viewerKey)
  }
  /** Collapsed for the slide it was collapsed on, as in the classic viewer */
  const [legendCollapsedFor, setLegendCollapsedFor] = useState<
    string | undefined
  >()
  const legendVisible =
    derivedLegend.rows.length > 0 &&
    (hasVisibleRow || legendShownFor === viewerKey)
  return (
    <>
      <ViewportOverlays
        key={viewerKey}
        {...overlayProps}
        topLeftAccessory={
          legendVisible ? (
            <DerivedLegend
              rows={derivedLegend.rows}
              onVisibilityChange={derivedLegend.onVisibilityChange}
              collapsed={legendCollapsedFor === viewerKey}
              onCollapsedChange={(collapsed) =>
                setLegendCollapsedFor(collapsed ? viewerKey : undefined)
              }
            />
          ) : undefined
        }
      />
      <ViewportLoadingIndicator
        isVisible={statusLabel !== undefined}
        label={statusLabel ?? lastStatusLabel}
      />
      <ViewportLoadingIndicator
        placement="bottom"
        isVisible={showsOverlayStatus}
        label={(overlayStatus ?? lastOverlayStatus).label}
        detail={(overlayStatus ?? lastOverlayStatus).progress}
      />
    </>
  )
}

/** Status footer with tile progress and memory use. */
export function ViewerChromeFooter({
  viewerKey,
  ...footerProps
}: ViewerChromeFooterProps): JSX.Element {
  return <ViewerFooter resetKey={viewerKey} {...footerProps} />
}
