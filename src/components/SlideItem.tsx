import { Typography } from 'antd'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import { FaSpinner } from 'react-icons/fa'

import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import { StorageClasses } from '../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import type { CustomError } from '../utils/CustomError'
import {
  computeOverviewPreviewResizeFactor,
  SLIDE_PREVIEW_HEIGHT_PX,
} from '../utils/computeOverviewPreviewResizeFactor'
import Description from './Description'
import ValidationWarning from './ValidationWarning'

interface SlideItemProps {
  clients: { [key: string]: DicomWebManager }
  slide: Slide
  /** When true, parent is a native button — omit hoverable Card styling. */
  disableCardHover?: boolean
}

interface SlideItemState {
  isLoading: boolean
}

/**
 * React component representing a DICOM Series Information Entity that displays
 * common series-level attributes of contained DICOM Slide Microscopy images
 * as well as the OVERVIEW image (if available).
 * When selected a Slide Viewer instance is created for the display of the
 * contained images.
 */
class SlideItem extends React.Component<SlideItemProps, SlideItemState> {
  state = { isLoading: false }

  private readonly overviewViewportRef = React.createRef<HTMLDivElement>()

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
    this.setState({ isLoading: true })
    this.scheduleOverviewViewerMount()
    this.setState({ isLoading: false })
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

  /**
   * Wait until the preview tile has non-zero layout, then mount the overview
   * viewer with a resize factor that matches container pixels to matrix extent.
   */
  private scheduleOverviewViewerMount(): void {
    const tryMount = (): void => {
      this.mountFrameId = undefined
      if (this.isMountAborted) {
        return
      }
      const container = this.overviewViewportRef.current
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

  private mountOverviewViewer(container: HTMLDivElement): void {
    if (this.isMountAborted) {
      return
    }
    /** Use OVERVIEW if available, otherwise fall back to THUMBNAIL */
    const previewImages =
      this.props.slide.overviewImages.length > 0
        ? this.props.slide.overviewImages
        : this.props.slide.thumbnailImages

    if (previewImages.length === 0) {
      return
    }

    const metadata = previewImages[0]
    container.innerHTML = ''
    const imageType =
      this.props.slide.overviewImages.length > 0 ? 'OVERVIEW' : 'THUMBNAIL'
    console.info(
      `instantiate viewer for ${imageType} image of slide ` +
        `"${metadata.ContainerIdentifier}"`,
    )

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
    if (this.overviewViewer !== undefined) {
      this.overviewViewer.resize()
    }

    const attributes = []
    const description = this.props.slide.description
    attributes.push({
      name: 'Description',
      value:
        description !== null && description !== undefined && description !== ''
          ? description
          : '\u2014',
    })

    if (this.state.isLoading) {
      return <FaSpinner />
    }

    return (
      <Description
        header={this.props.slide.containerIdentifier}
        attributes={attributes}
        selectable={this.props.disableCardHover !== true}
      >
        <div style={{ position: 'relative', height: SLIDE_PREVIEW_HEIGHT_PX }}>
          {this.props.slide.overviewImages.length > 0 ||
          this.props.slide.thumbnailImages.length > 0 ? (
            <div ref={this.overviewViewportRef} style={{ height: '100%' }} />
          ) : (
            <div
              style={{
                height: '100%',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 300,
                color: '#8F9BA8',
                letterSpacing: '0.1em',
              }}
            >
              SM
            </div>
          )}
          <ValidationWarning slide={this.props.slide} />
        </div>
        {this.props.slide.seriesDescription !== undefined &&
        this.props.slide.seriesDescription !== null &&
        this.props.slide.seriesDescription !== '' ? (
          <Typography.Text
            type="secondary"
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: '0.75rem',
              lineHeight: 1.2,
            }}
          >
            {this.props.slide.seriesDescription}
          </Typography.Text>
        ) : null}
      </Description>
    )
  }
}

export default SlideItem
