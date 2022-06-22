import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Button as Btn, Menu, Select, Space, Tooltip } from 'antd'
import { AppstoreAddOutlined } from '@ant-design/icons'

import OpticalPathItem from './OpticalPathItem'

const { Option } = Select

interface OpticalPathListProps {
  opticalPaths: dmv.opticalPath.OpticalPath[]
  metadata: {
    [opticalPathIdentifier: string]: dmv.metadata.VLWholeSlideMicroscopyImage[]
  }
  visibleOpticalPathIdentifiers: Set<string>
  activeOpticalPathIdentifiers: Set<string>
  defaultOpticalPathStyles: {
    [opticalPathIdentifier: string]: {
      opacity: number
      color?: number[]
      limitValues?: number[]
      paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
    }
  }
  onOpticalPathVisibilityChange: ({ opticalPathIdentifier, isVisible }: {
    opticalPathIdentifier: string
    isVisible: boolean
  }) => void
  onOpticalPathStyleChange: ({ opticalPathIdentifier, styleOptions }: {
    opticalPathIdentifier: string
    styleOptions: {
      opacity?: number
      color?: number[]
      limitValues?: number[]
    }
  }) => void
  onOpticalPathActivityChange: ({ opticalPathIdentifier, isActive }: {
    opticalPathIdentifier: string
    isActive: boolean
  }) => void
  selectedPresentationStateUID?: string
}

interface OpticalPathListState {
  selectedOpticalPathIdentifier?: string
}

/**
 * React component representing a list of optical paths.
 */
class OpticalPathList extends React.Component<OpticalPathListProps, OpticalPathListState> {
  state = {
    selectedOpticalPathIdentifier: undefined
  }

  constructor (props: OpticalPathListProps) {
    super(props)
    this.handleItemAddition = this.handleItemAddition.bind(this)
    this.handleItemRemoval = this.handleItemRemoval.bind(this)
    this.handleItemSelectionChange = this.handleItemSelectionChange.bind(this)
  }

  /**
   * Handler that gets called when an optical path should be removed.
   */
  handleItemRemoval (opticalPathIdentifier: string): void {
    this.props.onOpticalPathActivityChange({
      opticalPathIdentifier,
      isActive: false
    })
  }

  /**
   * Handler that gets called when the selection of an optical path should change.
   */
  handleItemSelectionChange (
    value: string
  ): void {
    this.setState({ selectedOpticalPathIdentifier: value })
  }

  /**
   * Handler that gets called when an optical path should be added.
   */
  handleItemAddition (): void {
    const identifier = this.state.selectedOpticalPathIdentifier
    if (identifier !== undefined) {
      this.props.onOpticalPathActivityChange({
        opticalPathIdentifier: identifier,
        isActive: true
      })
      this.setState({ selectedOpticalPathIdentifier: undefined })
    }
  }

  render (): React.ReactNode {
    if (this.props.metadata === undefined) {
      return null
    }

    const isSelectable = this.props.opticalPaths.length > 1
    const opticalPathItems: React.ReactNode[] = []
    const optionItems: React.ReactNode[] = []
    this.props.opticalPaths.forEach(opticalPath => {
      const opticalPathIdentifier = opticalPath.identifier
      const images = this.props.metadata[opticalPathIdentifier]
      const seriesInstanceUID = images[0].SeriesInstanceUID
      images[0].OpticalPathSequence.forEach(opticalPathItem => {
        const id = opticalPathItem.OpticalPathIdentifier
        const description = opticalPathItem.OpticalPathDescription
        if (opticalPath.identifier === id) {
          if (this.props.activeOpticalPathIdentifiers.has(id)) {
            opticalPathItems.push(
              <OpticalPathItem
                key={`${seriesInstanceUID}-${id}`}
                opticalPath={opticalPath}
                metadata={images}
                isVisible={this.props.visibleOpticalPathIdentifiers.has(id)}
                defaultStyle={this.props.defaultOpticalPathStyles[id]}
                onVisibilityChange={this.props.onOpticalPathVisibilityChange}
                onStyleChange={this.props.onOpticalPathStyleChange}
                onRemoval={this.handleItemRemoval}
                isRemovable={isSelectable}
              />
            )
          } else {
            let title
            if (description !== '') {
              title = `${id} - ${description}`
            } else {
              title = `${id}`
            }
            optionItems.push(
              <Option key={id} value={id}>{title}</Option>
            )
          }
        }
      })
    })

    let opticalPathSelector
    if (isSelectable) {
      opticalPathSelector = (
        <Space align='center' size={20} style={{ padding: '14px' }}>
          <Select
            defaultValue=''
            style={{ width: 200 }}
            onChange={this.handleItemSelectionChange}
            value={this.state.selectedOpticalPathIdentifier}
            allowClear
          >
            {optionItems}
          </Select>
          <Tooltip title='Add'>
            <Btn
              icon={<AppstoreAddOutlined />}
              type='primary'
              onClick={this.handleItemAddition}
            />
          </Tooltip>
        </Space>
      )
    }

    return (
      <Menu selectable={false}>
        {opticalPathItems}
        {opticalPathSelector}
      </Menu>
    )
  }
}

export default OpticalPathList
