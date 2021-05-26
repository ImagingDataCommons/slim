import React from 'react'
import { FaSpinner } from 'react-icons/fa'

import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import DicomWebManager from '../DicomWebManager'
import Description from './Description'

interface SlideItemProps {
  client: DicomWebManager
  metadata: dmv.metadata.Series
}

interface SlideItemState {
  instances: dmv.metadata.Instance[]
  containerIdentifier: string
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
    instances: [],
    containerIdentifier: '',
    isLoading: false
  }

  private readonly overviewViewport = React.createRef<HTMLDivElement>()

  private overviewViewer?: dmv.viewer.OverviewImageViewer

  constructor (props: SlideItemProps) {
    super(props)
    this.overviewViewer = undefined
  }

  componentDidMount (): void {
    console.info(
      'search for instances in series ' +
      `"${this.props.metadata.SeriesInstanceUID}"...`
    )
    this.setState({ isLoading: true })
    const searchOptions = {
      studyInstanceUID: this.props.metadata.StudyInstanceUID,
      seriesInstanceUID: this.props.metadata.SeriesInstanceUID
    }
    this.props.client.searchForInstances(searchOptions).then((matchedInstances) => {
      matchedInstances.forEach(matchedItem => {
        const instance = dmv.metadata.formatMetadata(matchedItem) as dmv.metadata.Instance
        if (instance.SOPClassUID === '1.2.840.10008.5.1.4.1.1.77.1.6') {
          this.setState(state => ({
            instances: [
              ...state.instances,
              instance
            ]
          }))
          /** At this point, we only need the metadata for OVERVIEW images.
           * Unfortunately, the ImageType attribute may not be included in
           * instance search results and we need to retrieve the metadata
           * of images. To limit network communication and parsing overhead
           * (the metadata can be quite large for VOLUME images with many
           * frames), we only retrieve metadata of those images containing
           * a limited number of frames.
           */
          var isOverviewImage = false
          if (instance.ImageType !== undefined) {
            isOverviewImage = instance.ImageType[2] === 'OVERVIEW'
          }
          if (isOverviewImage || instance.NumberOfFrames === 1) {
            console.debug(
              'retrieve metadata for instance ' +
              `"${instance.SOPInstanceUID}"`
            )
            const retrieveOptions = {
              studyInstanceUID: this.props.metadata.StudyInstanceUID,
              seriesInstanceUID: this.props.metadata.SeriesInstanceUID,
              sopInstanceUID: instance.SOPInstanceUID
            }
            this.props.client.retrieveInstanceMetadata(retrieveOptions).then(
              retrievedMetadata => {
                const metadata = dmv.metadata.formatMetadata(retrievedMetadata[0])
                const dataset = metadata as dmv.metadata.VLWholeSlideMicroscopyImage
                this.setState({
                  containerIdentifier: dataset.ContainerIdentifier
                })
                if (dataset.ImageType[2] === 'OVERVIEW') {
                  // Instantiate the viewer and inject it into the viewport
                  console.info(
                    'instantiate viewer for OVERVIEW image of series ' +
                    this.props.metadata.SeriesInstanceUID +
                    '...'
                  )
                  if (this.overviewViewport.current !== null) {
                    this.overviewViewport.current.innerHTML = ''
                    this.overviewViewer = new dmv.viewer.OverviewImageViewer({
                      client: this.props.client,
                      metadata: retrievedMetadata[0],
                      resizeFactor: 1
                    })
                    this.overviewViewer.render({
                      container: this.overviewViewport.current
                    })
                  }
                }
              }
            ).catch(
              () => console.error('retrieval of image instance metadata failed')
            )
          }
        }
      })
      this.setState({ isLoading: false })
    }).catch(
      () => console.error('search for image instances failed')
    )
  }

  render (): React.ReactNode {
    if (this.overviewViewer !== undefined) {
      this.overviewViewer.render({
        container: this.overviewViewport.current
      })
      this.overviewViewer.resize()
    }
    const attributes = []
    if (this.props.metadata.SeriesDescription !== undefined) {
      attributes.push({
        name: 'Description',
        value: this.props.metadata.SeriesDescription
      })
    }
    if (this.state.isLoading) {
      return (<FaSpinner />)
    }
    const title = this.state.containerIdentifier
    /* Properties need to be propagated down to Menu.Item:
     * https://github.com/react-component/menu/issues/142
     */
    return (
      <Menu.Item
        style={{ height: '100%' }}
        key={this.props.metadata.SeriesInstanceUID}
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
