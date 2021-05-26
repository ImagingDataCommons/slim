import React from 'react'
import { Menu } from 'antd'
import * as dmv from 'dicom-microscopy-viewer'

import DicomWebManager from '../DicomWebManager'
import SlideItem from './SlideItem'

interface SlideListProps {
  metadata: dmv.metadata.Series[]
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
  constructor (props: SlideListProps) {
    super(props)
    this.state = {
      selectedSeriesInstanceUID: this.props.initiallySelectedSeriesInstanceUID
    }
  }

  componentDidMount (): void {
    this.props.onSeriesSelection({
      seriesInstanceUID: this.state.selectedSeriesInstanceUID
    })
  }

  render (): React.ReactNode {
    const items = this.props.metadata.map((series, index: number) => {
      return (
        <SlideItem
          key={series.SeriesInstanceUID}
          metadata={series}
          client={this.props.client}
        />
      )
    })

    const handleMenuItemSelection = ({ key, keyPath, domEvent, selectedKeys }: {
      key: React.ReactText
      keyPath: React.ReactText[]
      domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
      selectedKeys?: React.ReactText[]
    }): void => {
      console.info(`select series "${key}"`)
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
        {items}
      </Menu>
    )
  }
}

export default SlideList
