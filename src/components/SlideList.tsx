import React from 'react'
import { Menu } from 'antd'
import * as dmv from 'dicom-microscopy-viewer'

import DicomWebManager from '../DicomWebManager'
import SlideItem from './SlideItem'

import {fromSeriesListToSlideList} from '../utils/fromSeriesListToSlideList'

interface SlideListProps {
  metadata: dmv.metadata.SeriesState[]
  client: DicomWebManager
  initiallySelectedSeriesInstanceUID: string
  onSeriesSelection: (
    { seriesInstanceUID }: { seriesInstanceUID: string }
  ) => void
}

interface SlideListState {
  selectedSeriesInstanceUID: string
  slideList: dmv.metadata.SlideState[]
}

/**
 * React component representing a list of DICOM Series Information Entities.
 */
class SlideList extends React.Component<SlideListProps, SlideListState> {
  state = {
    selectedSeriesInstanceUID: '',
    slideList: []
  }

  constructor (props: SlideListProps) {
    super(props)
  }

  componentDidMount (): void {
    const seriesList = this.props.metadata
    const slideList = fromSeriesListToSlideList(seriesList, this.props.initiallySelectedSeriesInstanceUID);
    this.setState(state => ({
      selectedSeriesInstanceUID: this.props.initiallySelectedSeriesInstanceUID,
      slideList: slideList
    }))
    this.props.onSeriesSelection({
      seriesInstanceUID: this.props.initiallySelectedSeriesInstanceUID
    })
  }

  componentDidUpdate (previousProps: SlideListProps): void {
    if (this.props.metadata !== previousProps.metadata) {
      const seriesList = this.props.metadata
      const slideList = fromSeriesListToSlideList(seriesList, this.props.initiallySelectedSeriesInstanceUID);
      this.setState(state => ({ slideList: slideList }))
    }
  }

  render (): React.ReactNode {
    const slideItemList = []
    for (let i = 0; i < this.state.slideList.length; ++i) {
      const slideState = this.state.slideList[i] as dmv.metadata.SlideState
      const slideItem = 
      <SlideItem
        key={slideState.Key}
        slidestate={slideState}
        client={this.props.client}
      />
  
      slideItemList.push(slideItem)  
    }

    if (slideItemList.length === 0) {
      const slideState: dmv.metadata.SlideState = {
        Key: '',
        VolumeMetadata: [],
        LabelMetadata: [],
        OverviewMetadata: [],
        IsMultiChannel: false,
        MultiChannelsSeriesUIDs: [],
        Description: ''
      };
      const slideItem = 
        <SlideItem
          key={slideState.Key}
          slidestate={slideState}
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
