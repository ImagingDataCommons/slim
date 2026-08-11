import type { MenuProps } from 'antd'
import { Menu, Switch } from 'antd'
// skipcq: JS-C1003
import type * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import AnnotationGroupItem from './AnnotationGroupItem'

interface AnnotationGroupListProps {
  annotationGroups: dmv.annotation.AnnotationGroup[]
  visibleAnnotationGroupUIDs: Set<string>
  metadata: {
    [annotationGroupUID: string]: dmv.metadata.MicroscopyBulkSimpleAnnotations
  }
  defaultAnnotationGroupStyles: {
    [annotationGroupUID: string]: {
      opacity: number
      color: number[]
      filled?: boolean
      fillOpacity?: number
    }
  }
  onAnnotationGroupClick: (annotationGroupUID: string) => void
  onAnnotationGroupVisibilityChange: ({
    annotationGroupUID,
    isVisible,
  }: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onAnnotationGroupStyleChange: ({
    uid,
    styleOptions,
  }: {
    uid: string
    styleOptions: {
      opacity?: number
      color?: number[]
      filled?: boolean
      fillOpacity?: number
      measurement?: dcmjs.sr.coding.CodedConcept
      limitValues?: number[]
    }
  }) => void
  getMeasurementRange?: (
    annotationGroupUID: string,
    measurement: dcmjs.sr.coding.CodedConcept,
  ) => { min: number; max: number } | null
  loadStatus?: {
    [annotationGroupUID: string]: {
      loadedBytes: number
      totalBytes: number | null
    }
  }
}

/**
 * React component representing a list of Annotation Groups.
 */
class AnnotationGroupList extends React.Component<
  AnnotationGroupListProps,
  unknown
> {
  handleVisibilityChange = (checked: boolean): void => {
    if (checked) {
      this.props.annotationGroups.forEach((annotationGroup) => {
        this.props.onAnnotationGroupVisibilityChange({
          annotationGroupUID: annotationGroup.uid,
          isVisible: checked,
        })
      })
      return
    }

    this.props.visibleAnnotationGroupUIDs.forEach((annotationGroupUID) => {
      this.props.onAnnotationGroupVisibilityChange({
        annotationGroupUID,
        isVisible: checked,
      })
    })
  }

  render(): React.ReactNode {
    const items: MenuProps['items'] = this.props.annotationGroups.map(
      (annotationGroup) => {
        const uid = annotationGroup.uid
        return {
          key: uid,
          style: { height: '100%', paddingLeft: '3px' },
          label: (
            <AnnotationGroupItem
              annotationGroup={annotationGroup}
              onAnnotationGroupClick={this.props.onAnnotationGroupClick}
              metadata={this.props.metadata[uid]}
              isVisible={this.props.visibleAnnotationGroupUIDs.has(uid)}
              defaultStyle={this.props.defaultAnnotationGroupStyles[uid]}
              onVisibilityChange={this.props.onAnnotationGroupVisibilityChange}
              onStyleChange={this.props.onAnnotationGroupStyleChange}
              getMeasurementRange={this.props.getMeasurementRange}
              loadStatus={this.props.loadStatus?.[uid]}
            />
          ),
        }
      },
    )

    return (
      <>
        <div
          style={{
            paddingLeft: '14px',
            paddingTop: '7px',
            paddingBottom: '7px',
          }}
        >
          <Switch
            size="small"
            onChange={this.handleVisibilityChange}
            checked={this.props.visibleAnnotationGroupUIDs.size > 0}
            checkedChildren={<FaEye />}
            unCheckedChildren={<FaEyeSlash />}
          />
        </div>
        <Menu selectable={false} items={items} />
      </>
    )
  }
}

export default AnnotationGroupList
