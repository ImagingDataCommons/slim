import { Menu } from 'antd'
import React from 'react'

import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import SlideItem from './SlideItem'

interface SlideListProps {
  metadata: Slide[]
  clients: { [key: string]: DicomWebManager }
  selectedSeriesInstanceUID: string
  onSeriesSelection: ({
    seriesInstanceUID,
  }: {
    seriesInstanceUID: string
  }) => void
}

interface SlideListState {
  selectedSeriesInstanceUID: string
}

/**
 * React component representing a list of DICOM Series Information Entities.
 */
class SlideList extends React.Component<SlideListProps, SlideListState> {
  state = {
    selectedSeriesInstanceUID: this.props.selectedSeriesInstanceUID,
  }

  componentDidMount(): void {
    this.props.onSeriesSelection({
      seriesInstanceUID: this.state.selectedSeriesInstanceUID,
    })
  }

  render(): React.ReactNode {
    const slideList = this.props.metadata
    const slideItemList = []
    for (let i = 0; i < slideList.length; ++i) {
      const slide = slideList[i]
      const slideItem = (
        <SlideItem
          key={slide.seriesInstanceUIDs[0]}
          slide={slide}
          clients={this.props.clients}
        />
      )

      slideItemList.push(slideItem)
    }

    const handleMenuItemSelection = ({
      key,
      keyPath: _keyPath,
      domEvent: _domEvent,
      selectedKeys: _selectedKeys,
    }: {
      key: React.ReactText
      keyPath: React.ReactText[]
      domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
      selectedKeys?: React.ReactText[]
    }): void => {
      console.info(`select slide "${key}"`)
      this.setState({ selectedSeriesInstanceUID: key.toString() })
      this.props.onSeriesSelection({ seriesInstanceUID: key.toString() })
    }

    let selectedKeys: string[] = []
    if (
      this.state.selectedSeriesInstanceUID !== null &&
      this.state.selectedSeriesInstanceUID !== undefined
    ) {
      selectedKeys = [this.state.selectedSeriesInstanceUID]
    }

    return (
      <Menu
        style={{ width: '100%' }}
        selectedKeys={selectedKeys}
        onSelect={handleMenuItemSelection}
        mode="inline"
        inlineIndent={0}
      >
        {slideItemList}
      </Menu>
    )
  }
}

export default SlideList
