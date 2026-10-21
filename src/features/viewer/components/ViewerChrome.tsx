import { type ComponentProps, type JSX, useState } from 'react'

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
  isWaitingForFirstImage: boolean
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

/** Viewport overlays and first-tile loading indicator. */
export function ViewerChromeOverlays({
  viewerKey,
  isWaitingForFirstImage,
  derivedLegend,
  ...overlayProps
}: ViewerChromeOverlaysProps): JSX.Element {
  /**
   * The legend appears once an overlay it lists is shown, then stays for
   * this viewer while rows exist, so its eye toggles can turn hidden
   * overlays back on. Slides whose overlays were never shown get no legend.
   */
  const [legendShownFor, setLegendShownFor] = useState<string | undefined>()
  const hasVisibleRow = derivedLegend.rows.some((row) => row.isVisible)
  if (hasVisibleRow && legendShownFor !== viewerKey) {
    setLegendShownFor(viewerKey)
  }
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
            />
          ) : undefined
        }
      />
      <ViewportLoadingIndicator
        isVisible={isWaitingForFirstImage}
        label="Loading slide"
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
