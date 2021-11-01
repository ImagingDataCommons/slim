import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Button, Menu, Select, Space } from 'antd'
import { AppstoreAddOutlined } from '@ant-design/icons'

import OpticalPathItem from './OpticalPathItem'

const { Option } = Select

interface OpticalPathsListProps {
  metadata?: dmv.metadata.VLWholeSlideMicroscopyImage[]
  viewer: dmv.viewer.VolumeImageViewer
}

interface OpticalPathListState {
  rerender: boolean
  selectedOpticalPathIdentifier?: string
}

/**
 * React component representing a list of optical paths (i.e., channels).
 */
class OpticalPathsList extends React.Component<OpticalPathsListProps, OpticalPathListState> {
  state = {
    rerender: false,
    selectedOpticalPathIdentifier: undefined
  }

  constructor (props: OpticalPathsListProps) {
    super(props)
    this.handleAddition = this.handleAddition.bind(this)
    this.handleRemoval = this.handleRemoval.bind(this)
    this.handleSelectionChange = this.handleSelectionChange.bind(this)
  }

  /**
   * Handler that gets called when an optical path should be removed.
   */
  handleRemoval (opticalPathIdentifier: string): void {
    this.props.viewer.deactivateOpticalPath(opticalPathIdentifier)
    this.setState({ rerender: true })
  }

  /**
   * Handler that gets called when the selection of an optical path should change.
   */
  handleSelectionChange (
    value: string
  ): void {
    this.setState({ selectedOpticalPathIdentifier: value })
  }

  /**
   * Handler that gets called when an optical path should be added.
   */
  handleAddition (): void {
    const identifier = this.state.selectedOpticalPathIdentifier
    if (identifier !== undefined) {
      this.props.viewer.activateOpticalPath(identifier)
      this.props.viewer.showOpticalPath(identifier)
      this.setState({ selectedOpticalPathIdentifier: undefined })
    }
  }

  render (): React.ReactNode {
    const opticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
    if (this.props.metadata === undefined) {
      return null
    }
    this.props.metadata.forEach(
      (item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
        if (item.OpticalPathSequence.length > 0) {
          const index = opticalPaths.findIndex(
            (property: dmv.metadata.VLWholeSlideMicroscopyImage) => {
              return (
                property.OpticalPathSequence[0].OpticalPathIdentifier ===
                item.OpticalPathSequence[0].OpticalPathIdentifier
              )
            }
          )

          if (index === -1) {
            opticalPaths.push(item)
          }
        }
      }
    )

    // filter the list for only the active samples
    const filteredOpticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] =
      opticalPaths.filter((item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
        return this.props.viewer.isOpticalPathActive(
          item.OpticalPathSequence[0].OpticalPathIdentifier
        )
      })

    // order items with the Optical Path ID
    const sortedOpticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] =
      filteredOpticalPaths.sort((n1: dmv.metadata.VLWholeSlideMicroscopyImage,
        n2: dmv.metadata.VLWholeSlideMicroscopyImage
      ) => {
        const id1 = parseInt(n1.OpticalPathSequence[0].OpticalPathIdentifier)
        const id2 = parseInt(n2.OpticalPathSequence[0].OpticalPathIdentifier)
        if (id1 > id2) {
          return 1
        }

        if (id1 < id2) {
          return -1
        }

        return 0
      })

    const sampleItems = sortedOpticalPaths.map(
      (item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
        return (
          <OpticalPathItem
            key={item.OpticalPathSequence[0].OpticalPathIdentifier}
            viewer={this.props.viewer}
            opticalPathDescription={item.OpticalPathSequence[0]}
            specimenDescription={item.SpecimenDescriptionSequence[0]}
            onRemoval={this.handleRemoval}
          />
        )
      }
    )

    // get currently deactivated paths
    const deactivatedOpticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] =
    opticalPaths.filter((item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
      return !this.props.viewer.isOpticalPathActive(
        item.OpticalPathSequence[0].OpticalPathIdentifier
      )
    })

    // order items with the Optical Path ID
    const sortedDeactivatedOpticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] =
      deactivatedOpticalPaths.sort((
        n1: dmv.metadata.VLWholeSlideMicroscopyImage,
        n2: dmv.metadata.VLWholeSlideMicroscopyImage
      ) => {
        const id1 = parseInt(n1.OpticalPathSequence[0].OpticalPathIdentifier)
        const id2 = parseInt(n2.OpticalPathSequence[0].OpticalPathIdentifier)
        if (id1 > id2) {
          return 1
        }
        if (id1 < id2) {
          return -1
        }
        return 0
      })

    const deactivatedOptionItems = sortedDeactivatedOpticalPaths.map(
      (item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
        const id = item.OpticalPathSequence[0].OpticalPathIdentifier
        const description = item.OpticalPathSequence[0].OpticalPathDescription
        return (
          <Option key={id} value={id}> ID: {id}, {description} </Option>
        )
      }
    )

    return (
      <Space align='center' direction='vertical' size={20}>
        <Menu selectable={false}>
          {sampleItems}
        </Menu>
        <Space align='center' size={20}>
          <Select
            defaultValue=''
            style={{ width: 200 }}
            onChange={this.handleSelectionChange}
            value={this.state.selectedOpticalPathIdentifier}
            allowClear
          >
            {deactivatedOptionItems}
          </Select>
          <Button type='primary' icon={<AppstoreAddOutlined />} onClick={this.handleAddition} />
        </Space>
      </Space>
    )
  }
}

export default OpticalPathsList
