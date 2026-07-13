import type { MenuProps } from 'antd'
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
    const items: MenuProps['items'] = this.props.metadata.map((slide) => {
      const key = slide.seriesInstanceUIDs[0]
      return {
        key,
        style: { height: '100%' },
        label: <SlideItem slide={slide} clients={this.props.clients} />,
      }
    })

    const handleMenuItemSelection: MenuProps['onSelect'] = ({ key }) => {
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
        items={items}
      />
    )
  }
}

export default SlideList
