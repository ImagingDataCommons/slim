import React from 'react'
import { FaSpinner } from 'react-icons/fa'

import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import DicomWebManager from '../DicomWebManager'
import Description from './Description'
import { Slide } from '../data/slides'

interface SlideItemProps {
  client: DicomWebManager
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
  state = {
    isLoading: false
  }

  private readonly overviewViewport = React.createRef<HTMLDivElement>()

  private overviewViewer?: dmv.viewer.OverviewImageViewer

  constructor (props: SlideItemProps) {
    super(props)
    this.overviewViewer = undefined
  }

  componentDidMount (): void {
    this.setState({ isLoading: true })
    if (this.props.slide.overviewMetadata.length > 0) {
      const metadata = this.props.slide.overviewMetadata[0]

      // Instantiate the viewer and inject it into the viewport
      if (this.props.slide.selectedSeriesUID !== undefined) {
        console.info(
          'instantiate viewer for OVERVIEW image of ' +
          this.props.slide.selectedSeriesUID +
          '...'
        )
      }
      if (this.overviewViewport.current !== null) {
        this.overviewViewport.current.innerHTML = ''
        this.overviewViewer = new dmv.viewer.OverviewImageViewer({
          client: this.props.client,
          metadata: metadata,
          resizeFactor: 1
        })
        this.overviewViewer.render({
          container: this.overviewViewport.current
        })
      }
    }

    this.setState({ isLoading: false })
  }

  render (): React.ReactNode {
    if (this.overviewViewer !== undefined) {
      this.overviewViewer.render({
        container: this.overviewViewport.current
      })
      this.overviewViewer.resize()
    }
    const attributes = []
    if (this.props.slide.description !== null && this.props.slide.description !== undefined) {
      attributes.push({
        name: 'Description',
        value: this.props.slide.description
      })
    }
    if (this.state.isLoading) {
      return (<FaSpinner />)
    }

    const title = this.props.slide.containerIdentifier
    /* Properties need to be propagated down to Menu.Item:
     * https://github.com/react-component/menu/issues/142
     */
    return (
      <Menu.Item
        style={{ height: '100%' }}
        key={this.props.slide.selectedSeriesUID}
        {...this.props}
      >
        <Description
          header={title}
          attributes={attributes}
          selectable
        >
          <div style={{ height: '100px' }} ref={this.overviewViewport} />
        </Description>
      </Menu.Item>
    )
  }
}

export default SlideItem
