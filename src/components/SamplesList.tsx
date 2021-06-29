import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Button, Menu, Select, Space } from 'antd'
import { AppstoreAddOutlined } from '@ant-design/icons'

import SampleItem from './SampleItem'

const { Option } = Select

interface SamplesListProps {
  metadata: dmv.metadata.VLWholeSlideMicroscopyImage[]
  viewer: dmv.viewer.VolumeImageViewer
}

interface SampleListState {
  rerender: boolean
  selectedOpticalPathIdentifier: string | undefined
}

/**
 * React component representing a list of DICOM Samples Information Entities.
 */
class SamplesList extends React.Component<SamplesListProps, SampleListState> {
  state = {
    rerender: false,
    selectedOpticalPathIdentifier: undefined
  }

  constructor (props: SamplesListProps) {
    super(props)
    this.handleAddSample = this.handleAddSample.bind(this)
    this.onItemRemoveSample = this.onItemRemoveSample.bind(this)
    this.handleSelectChange = this.handleSelectChange.bind(this)
  }

  onItemRemoveSample (opticalPathIdentifier: string): void {
    this.props.viewer.deactivateOpticalPath(opticalPathIdentifier)

    this.setState({
      rerender: true
    })
  }

  handleSelectChange (
    value: string
  ): void {
    this.setState({
      selectedOpticalPathIdentifier: value
    })
  }

  handleAddSample (): void {
    const identifier = this.state.selectedOpticalPathIdentifier
    this.props.viewer.activateOpticalPath(identifier)
    this.props.viewer.showOpticalPath(identifier)
    this.setState({
      selectedOpticalPathIdentifier: undefined
    })
  }

  render (): React.ReactNode {
    const opticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
    this.props.metadata.forEach(
      (item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
        if (item.OpticalPathSequence.length > 0) {
          const index = opticalPaths.findIndex(
            (property: dmv.metadata.VLWholeSlideMicroscopyImage) => {
              return property.OpticalPathSequence[0].OpticalPathIdentifier ===
                      item.OpticalPathSequence[0].OpticalPathIdentifier
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
        return this.props.viewer.isOpticalPathActive(item.OpticalPathSequence[0].OpticalPathIdentifier)
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
          <SampleItem
            key={item.OpticalPathSequence[0].OpticalPathIdentifier}
            viewer={this.props.viewer}
            opticalPathDescription={item.OpticalPathSequence[0]}
            specimenDescription={item.SpecimenDescriptionSequence[0]}
            itemRemoveHandler={this.onItemRemoveSample}
          />
        )
      }
    )

    // get currently deactivated paths
    const deactivatedOpticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] =
    opticalPaths.filter((item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
      return !this.props.viewer.isOpticalPathActive(item.OpticalPathSequence[0].OpticalPathIdentifier)
    })

    // order items with the Optical Path ID
    const sortedDeactivatedOpticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] =
      deactivatedOpticalPaths.sort((n1: dmv.metadata.VLWholeSlideMicroscopyImage,
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
            onChange={this.handleSelectChange}
            value={this.state.selectedOpticalPathIdentifier}
            allowClear
          >
            {deactivatedOptionItems}
          </Select>
          <Button type='primary' icon={<AppstoreAddOutlined />} onClick={this.handleAddSample} />
        </Space>
        <h4 />
      </Space>
    )
  }
}

export default SamplesList
