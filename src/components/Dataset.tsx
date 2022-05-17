import React from 'react'
import { Tree, TreeDataNode } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import * as dmv from 'dicom-microscopy-viewer'

interface DatasetProps {
  instance: dmv.metadata.SOPClass
}

/**
 * React component representing a DICOM Data Set.
 */
class Dataset extends React.Component<DatasetProps, {}> {
  constructor (props: DatasetProps) {
    super(props)
  }

  render (): React.ReactNode {
    const data: Array<TreeDataNode> = []
    return (
      <Tree
        showLine
        switcherIcon={<DownOutlined />}
        draggable={false}
        treeData={data}
      >
      </Tree>
    )
  }
}
