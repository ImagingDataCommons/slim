import React from 'react'
import { Menu } from 'antd'

import DicomWebManager from '../DicomWebManager'
import AcquisitionItem from './AcquisitionItem'
import { Acquisition } from '../utils/types'

interface AcquisitionListProps {
  metadata: Acquisition[]
  client: DicomWebManager
  initiallySelectedSeriesInstanceUID: string
  onSeriesSelection: (
    { seriesInstanceUID }: { seriesInstanceUID: string }
  ) => void
}

interface AcquisitionListState {
  selectedSeriesInstanceUID: string
}

/**
 * React component representing a list of DICOM Series Information Entities.
 */
class AcquisitionList extends React.Component<AcquisitionListProps, AcquisitionListState> {
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
    const acquisitionList = this.props.metadata
    const acquisitionItemList = []
    for (let i = 0; i < acquisitionList.length; ++i) {
      const acquisition = acquisitionList[i] as Acquisition
      const acquisitionItem = 
      <AcquisitionItem
        key={acquisition.key}
        acquisition={acquisition}
        client={this.props.client}
      />
  
      acquisitionItemList.push(acquisitionItem)  
    }

    if (acquisitionItemList.length === 0) {
      const acquisition: Acquisition = {
        key: '',
        volumeMetadata: [],
        labelMetadata: [],
        overviewMetadata: [],
        isMultiSample: false,
        multiSamplesSeriesUIDs: [],
        description: ''
      };
      const acquisitionItem = 
        <AcquisitionItem
          key={acquisition.key}
          acquisition={acquisition}
          client={this.props.client}
        />
    
      acquisitionItemList.push(acquisitionItem)  
    }

    const handleMenuItemSelection = ({ key, keyPath, domEvent, selectedKeys }: {
      key: React.ReactText
      keyPath: React.ReactText[]
      domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
      selectedKeys?: React.ReactText[]
    }): void => {
      console.info(`select acquisition "${key}"`)
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
        {acquisitionItemList}
      </Menu>
    )
  }
}

export default AcquisitionList
