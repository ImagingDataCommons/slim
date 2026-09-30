// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import React from 'react'

import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import { StorageClasses } from '../data/uids'
import { cn } from '../lib/utils'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import type { CustomError } from '../utils/CustomError'
import { computeOverviewPreviewResizeFactor } from '../utils/computeOverviewPreviewResizeFactor'
import ValidationWarning from './ValidationWarning'

interface SlideItemProps {
  clients: { [key: string]: DicomWebManager }
  slide: Slide
  isSelected?: boolean
  onClick?: () => void
}

interface SlideItemState {
  isLoading: boolean
}

/**
 * Extract stain/description info from slide metadata.
 */
export function getSlideStainInfo(slide: Slide): string {
  const desc = slide.description
  if (desc && desc.trim() !== '') {
    return desc
  }
  if (slide.seriesDescription && slide.seriesDescription.trim() !== '') {
    return slide.seriesDescription
  }
  return ''
}

/**
 * Get illumination type (Brightfield or Fluorescence).
 */
function getIlluminationType(slide: Slide): string {
  const isMonochrome = slide.areVolumeImagesMonochrome
  if (isMonochrome) {
    return 'Fluorescence'
  }
  return 'Brightfield'
}

/**
 * Get max magnification from slide.
 */
function getMagnification(slide: Slide): string {
  if (slide.volumeImages.length > 0) {
    const image = slide.volumeImages[0] as unknown as Record<string, unknown>
    const sharedFunctionalGroupsSequence =
      image.SharedFunctionalGroupsSequence as
        | Array<Record<string, unknown>>
        | undefined
    if (
      sharedFunctionalGroupsSequence &&
      sharedFunctionalGroupsSequence.length > 0
    ) {
      const pixelMeasuresSequence = sharedFunctionalGroupsSequence[0]
        .PixelMeasuresSequence as Array<Record<string, unknown>> | undefined
      if (pixelMeasuresSequence && pixelMeasuresSequence.length > 0) {
        const pixelSpacing = pixelMeasuresSequence[0].PixelSpacing as
          | number[]
          | undefined
        if (pixelSpacing && pixelSpacing.length >= 1) {
          /** Approximate magnification from pixel spacing (mm to microns) */
          const micronsPerPixel = pixelSpacing[0] * 1000
          if (micronsPerPixel <= 0.125) return '80×'
          if (micronsPerPixel <= 0.25) return '40×'
          if (micronsPerPixel <= 0.5) return '20×'
          if (micronsPerPixel <= 1.0) return '10×'
          return '5×'
        }
      }
    }
  }
  return ''
}

/**
 * Get a short slide identifier (e.g., "A1", "A2").
 */
export function getSlideShortId(slide: Slide, index?: number): string {
  const containerId = slide.containerIdentifier
  if (containerId) {
    /** If it looks like a short ID already, use it */
    if (/^[A-Z]\d+$/i.test(containerId)) {
      return containerId.toUpperCase()
    }
    /** Otherwise use first part or generate from index */
    const parts = containerId.split(/[-_]/)
    if (parts.length > 0 && parts[0].length <= 4) {
      return parts[0].toUpperCase()
    }
  }
  /** Fallback to index-based ID */
  if (index !== undefined) {
    return `A${index + 1}`
  }
  return containerId?.slice(0, 15) || 'Slide'
}

/**
 * React component representing a slide card in the redesigned layout.
 */
class SlideItem extends React.Component<SlideItemProps, SlideItemState> {
  state = { isLoading: false }

  private readonly thumbnailRef = React.createRef<HTMLSpanElement>()

  private overviewViewer?: dmv.viewer.OverviewImageViewer

  private overviewResizeObserver?: ResizeObserver

  private mountFrameId: number | undefined

  private isMountAborted = false

  constructor(props: SlideItemProps) {
    super(props)
    this.overviewViewer = undefined
  }

  componentDidMount(): void {
    this.isMountAborted = false
    this.scheduleOverviewViewerMount()
  }

  componentWillUnmount(): void {
    this.isMountAborted = true
    if (this.mountFrameId !== undefined) {
      cancelAnimationFrame(this.mountFrameId)
      this.mountFrameId = undefined
    }
    this.overviewResizeObserver?.disconnect()
    this.overviewResizeObserver = undefined
    this.overviewViewer?.cleanup()
    this.overviewViewer = undefined
  }

  private scheduleOverviewViewerMount(): void {
    const tryMount = (): void => {
      this.mountFrameId = undefined
      if (this.isMountAborted) {
        return
      }
      const container = this.thumbnailRef.current
      if (container == null) {
        return
      }
      const { clientWidth, clientHeight } = container
      if (clientWidth <= 0 || clientHeight <= 0) {
        this.mountFrameId = requestAnimationFrame(tryMount)
        return
      }
      this.mountOverviewViewer(container)
    }
    this.mountFrameId = requestAnimationFrame(tryMount)
  }

  private mountOverviewViewer(container: HTMLElement): void {
    if (this.isMountAborted) {
      return
    }
    const previewImages =
      this.props.slide.overviewImages.length > 0
        ? this.props.slide.overviewImages
        : this.props.slide.thumbnailImages

    if (previewImages.length === 0) {
      return
    }

    const metadata = previewImages[0]
    container.innerHTML = ''

    const resizeFactor = computeOverviewPreviewResizeFactor(
      metadata,
      container.clientWidth,
      container.clientHeight,
    )

    this.overviewViewer?.cleanup()
    this.overviewViewer = new dmv.viewer.OverviewImageViewer({
      client:
        this.props.clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE],
      disableInteractions: true,
      metadata,
      resizeFactor,
      errorInterceptor: (error: CustomError) => {
        NotificationMiddleware.onError(NotificationMiddlewareContext.DMV, error)
      },
    })
    this.overviewViewer.render({ container })

    requestAnimationFrame(() => {
      this.overviewViewer?.resize()
    })

    this.overviewResizeObserver?.disconnect()
    this.overviewResizeObserver = new ResizeObserver(() => {
      this.overviewViewer?.resize()
    })
    this.overviewResizeObserver.observe(container)
  }

  render(): React.ReactNode {
    const { slide, isSelected, onClick } = this.props
    const stainInfo = getSlideStainInfo(slide)
    const illuminationType = getIlluminationType(slide)
    const magnification = getMagnification(slide)
    const shortId = getSlideShortId(slide)
    const hasPreview =
      slide.overviewImages.length > 0 || slide.thumbnailImages.length > 0

    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isSelected === true}
        className={cn(
          'flex w-full items-stretch gap-3 rounded-[10px] border p-2 text-left transition-colors hover:border-line-hover',
          isSelected === true
            ? 'border-primary bg-selected shadow-selected-ring'
            : 'border-line bg-panel',
        )}
      >
        <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-md border border-line bg-viewport">
          {hasPreview ? (
            <span
              ref={this.thumbnailRef}
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
            <span className="truncate">{shortId}</span>
            <ValidationWarning slide={slide} size={15} />
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
}

export default SlideItem
