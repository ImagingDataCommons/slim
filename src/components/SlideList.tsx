import React from 'react'
import { Menu } from 'antd'

import DicomWebManager from '../DicomWebManager'
import SlideItem from './SlideItem'
import { Slide } from '../data/slides'

interface SlideListProps {
  metadata: Slide[]
  client: DicomWebManager
  initiallySelectedSeriesInstanceUID: string
  onSeriesSelection: (
    { seriesInstanceUID }: { seriesInstanceUID: string }
  ) => void
}

interface SlideListState {
  selectedSeriesInstanceUID: string
}

/**
 * React component representing a list of DICOM Series Information Entities.
 */
class SlideList extends React.Component<SlideListProps, SlideListState> {
  state = {
    selectedSeriesInstanceUID: '',
  }

  componentDidMount (): void {
    this.setState(state => ({
      selectedSeriesInstanceUID: this.props.initiallySelectedSeriesInstanceUID,
    }))
    this.props.onSeriesSelection({
      seriesInstanceUID: this.props.initiallySelectedSeriesInstanceUID
    })
  }

  render (): React.ReactNode {
    const slideList = this.props.metadata
    const slideItemList = []
    for (let i = 0; i < slideList.length; ++i) {
      const slide = slideList[i] as Slide
      const slideItem = 
      <SlideItem
        key={slide.key}
        slide={slide}
        client={this.props.client}
      />
  
      slideItemList.push(slideItem)  
    }

    if (slideItemList.length === 0) {
      const slide: Slide = {
        key: '',
        frameofReferenceUID: '',
        containerIdentifier: '',
        volumeMetadata: [],
        labelMetadata: [],
        overviewMetadata: [],
        areImagesMonochrome: false,
        isMultiplexedSamples: false,
        seriesUIDs: [],
        opticalPathIdentifiersList: [],
        keyOpticalPathIdentifier: '',
        description: ''
      };
      const slideItem = 
        <SlideItem
          key={slide.key}
          slide={slide}
          client={this.props.client}
        />
    
      slideItemList.push(slideItem)  
    }

    const handleMenuItemSelection = ({ key, keyPath, domEvent, selectedKeys }: {
      key: React.ReactText
      keyPath: React.ReactText[]
      domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
      selectedKeys?: React.ReactText[]
    }): void => {
      console.info(`select slide "${key}"`)
      this.setState(state => ({
        selectedSeriesInstanceUID: key.toString()
      }))
      this.props.onSeriesSelection({ seriesInstanceUID: key.toString() })
    }

    return (
      <Menu
        style={{ width: '100%' }}
        selectedKeys={[this.state.selectedSeriesInstanceUID]}
        onSelect={handleMenuItemSelection}
        mode='inline'
        inlineIndent={0}
      >
        {slideItemList}
      </Menu>
    )
  }
}

export default SlideList
