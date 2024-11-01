import React from 'react'
import { FaSpinner } from 'react-icons/fa'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import DicomWebManager from '../DicomWebManager'
import Description from './Description'
import { Slide } from '../data/slides'
import { StorageClasses } from '../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from '../services/NotificationMiddleware'
import { CustomError } from '../utils/CustomError'

interface SlideItemProps {
  clients: { [key: string]: DicomWebManager }
  slide: Slide
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

  constructor (props: SlideItemProps) {
    super(props)
    this.overviewViewer = undefined
  }

  componentDidMount (): void {
    this.setState({ isLoading: true })
    if (this.props.slide.overviewImages.length > 0) {
      const metadata = this.props.slide.overviewImages[0]
      if (this.overviewViewportRef.current !== null) {
        this.overviewViewportRef.current.innerHTML = ''
        console.info(
          'instantiate viewer for OVERVIEW image of slide ' +
          `"${metadata.ContainerIdentifier}"`
        )
        this.overviewViewer = new dmv.viewer.OverviewImageViewer({
          client: this.props.clients[
            StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE
          ],
          metadata: metadata,
          resizeFactor: 1,
          errorInterceptor: (error: CustomError) => {
            NotificationMiddleware.onError(
              NotificationMiddlewareContext.DMV,
              error
            )
          }
        })
        this.overviewViewer.render({
          container: this.overviewViewportRef.current
        })
      }
    }

    this.setState({ isLoading: false })
  }

  render (): React.ReactNode {
    if (this.overviewViewer !== undefined) {
      this.overviewViewer.resize()
    }
    const attributes = []
    const description = this.props.slide.description
    if (description != null && description !== '') {
      attributes.push({
        name: 'Description',
        value: description
      })
    }
    if (this.state.isLoading) {
      return (<FaSpinner />)
    }

    /* Properties need to be propagated down to Menu.Item:
     * https://github.com/react-component/menu/issues/142
     */
    return (
      <Menu.Item
        style={{ height: '100%' }}
        key={this.props.slide.seriesInstanceUIDs[0]}
        {...this.props}
      >
        <Description
          header={this.props.slide.containerIdentifier}
          attributes={attributes}
          selectable
        >
          {(this.overviewViewportRef.current != null) && <div style={{ height: '100px' }} ref={this.overviewViewportRef} />}
        </Description>
      </Menu.Item>
    )
  }
}

export default SlideItem
