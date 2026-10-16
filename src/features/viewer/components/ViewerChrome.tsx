import type { ComponentProps, JSX } from 'react'

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
  ...overlayProps
}: ViewerChromeOverlaysProps): JSX.Element {
  return (
    <>
      <ViewportOverlays key={viewerKey} {...overlayProps} />
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
