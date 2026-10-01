/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { memo, useEffect, useRef } from 'react'

import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import { StorageClasses } from '../data/uids'
import { cn } from '../lib/utils'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import type { CustomError } from '../utils/CustomError'
import { computeOverviewPreviewResizeFactor } from '../utils/computeOverviewPreviewResizeFactor'
import {
  getIlluminationType,
  getMagnification,
  getSlideDisplayId,
  getSlideStainInfo,
} from '../utils/slideDisplay'
import ValidationWarning from './ValidationWarning'

export interface SlideItemProps {
  clients: { [key: string]: DicomWebManager }
  slide: Slide
  isSelected?: boolean
  onSelect: ({ seriesInstanceUID }: { seriesInstanceUID: string }) => void
}

/**
 * Renders a DMV overview of `metadata` into the returned ref once the
 * container has a size. The thumbnail lives in a panel that may be
 * `display: none` at mount, so mounting waits for the ResizeObserver.
 */
function useOverviewViewer(
  client: DicomWebManager | undefined,
  metadata: dmv.metadata.VLWholeSlideMicroscopyImage | undefined,
): React.RefObject<HTMLSpanElement> {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container === null || metadata === undefined || client === undefined) {
      return
    }

    let viewer: dmv.viewer.OverviewImageViewer | undefined
    let resizeFrame: number | undefined

    const mount = (): void => {
      container.innerHTML = ''
      viewer = new dmv.viewer.OverviewImageViewer({
        client,
        disableInteractions: true,
        metadata,
        resizeFactor: computeOverviewPreviewResizeFactor(
          metadata,
          container.clientWidth,
          container.clientHeight,
        ),
        errorInterceptor: (error: CustomError) => {
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.DMV,
            error,
          )
        },
      })
      viewer.render({ container })
      resizeFrame = requestAnimationFrame(() => viewer?.resize())
    }

    const observer = new ResizeObserver(() => {
      if (viewer !== undefined) {
        viewer.resize()
      } else if (container.clientWidth > 0 && container.clientHeight > 0) {
        mount()
      }
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
      viewer?.cleanup()
    }
  }, [client, metadata])

  return containerRef
}

/** Slide card with an overview thumbnail, stain and acquisition details. */
function SlideItem({
  clients,
  slide,
  isSelected = false,
  onSelect,
}: SlideItemProps): React.ReactElement {
  const previewImages =
    slide.overviewImages.length > 0
      ? slide.overviewImages
      : slide.thumbnailImages
  const thumbnailRef = useOverviewViewer(
    clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE],
    previewImages[0],
  )
  const stainInfo = getSlideStainInfo(slide)
  const illuminationType = getIlluminationType(slide)
  const magnification = getMagnification(slide)
  const slideId = getSlideDisplayId(slide)
  const hasPreview = previewImages.length > 0

  return (
    <button
      type="button"
      onClick={() =>
        onSelect({ seriesInstanceUID: slide.seriesInstanceUIDs[0] })
      }
      aria-pressed={isSelected}
      className={cn(
        'flex w-full items-stretch gap-3 rounded-[10px] border p-2 text-left transition-colors hover:border-line-hover',
        isSelected
          ? 'border-primary bg-selected shadow-selected-ring'
          : 'border-line bg-panel',
      )}
    >
      <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-md border border-line bg-viewport">
        {hasPreview ? (
          <span
            ref={thumbnailRef}
            className="pointer-events-none block h-full w-full"
          />
        ) : (
          <span className="font-mono text-[10.5px] font-medium text-ink-faint">
            SM
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-[3px] pt-0.5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <span className="truncate" title={slideId}>
            {slideId}
          </span>
          <ValidationWarning slide={slide} size={15} interactive={false} />
        </span>
        {stainInfo !== '' && (
          <span className="truncate text-[12px] text-ink-secondary">
            {stainInfo}
          </span>
        )}
        <span className="mt-auto flex gap-1.5">
          <span className="rounded bg-app px-[5px] py-0.5 font-mono text-[10.5px] font-medium text-ink-secondary">
            {illuminationType}
          </span>
          {magnification !== '' && (
            <span className="rounded bg-app px-[5px] py-0.5 font-mono text-[10.5px] font-medium text-ink-secondary">
              {magnification}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

export default memo(SlideItem)
