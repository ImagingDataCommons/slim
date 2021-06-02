import React from 'react'
import { Button, Popover, Slider, Space, Switch } from 'antd'
import { SettingOutlined } from '@ant-design/icons';
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import Description from './Description'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'

interface SampleItemProps {
  opticalPathSequence: dmv.metadata.OpticalPathDescription,
  specimenDescriptionSequence: dmv.metadata.SpecimenDescription,
  viewer: dmv.viewer.VolumeImageViewer
}

interface SampleItemState {
  visible: boolean
}

/**
 * React component representing a DICOM Optical Path for multichannel acquistions and
 * give controls on visualization parameters
 */
class SampleItem extends React.Component<SampleItemProps, SampleItemState> {
  state = {
    visible: false
  }

  constructor (props: SampleItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    const identifier = this.props.opticalPathSequence.OpticalPathIdentifier
    if (checked) {
      // To Do: remove this if and allocate only the active one
      // then add widgets to add/remove channel
      if (this.props.viewer.isOpticalPathActive(identifier) === false) {
        this.props.viewer.activateOpticalPath(identifier)
      }

      this.props.viewer.showOpticalPath(identifier)
      this.setState(state => ({ visible: true }))
    } else {
      this.props.viewer.hideOpticalPath(identifier)
      this.setState(state => ({ visible: false }))
    }
  }

  componentDidMount (): void {
    const identifier = this.props.opticalPathSequence.OpticalPathIdentifier
    const blendInfo = this.props.viewer.getBlendingInformation
      (identifier) as dmv.viewer.BlendingInformation
    this.setState(state => ({ visible: blendInfo.visible }))
  }

  render (): React.ReactNode {
    const identifier = this.props.opticalPathSequence.OpticalPathIdentifier
    const attributes: Array<{ name: string, value: string }> = []

    const specimenDescription = this.props.specimenDescriptionSequence
    if ('SpecimenShortDescription' in specimenDescription) {
      const description = specimenDescription.SpecimenShortDescription
      if (description) {
        attributes.push({
          name: 'Description',
          value: description
        })
      }
    }
    if ('PrimaryAnatomicStructureSequence' in specimenDescription) {
      const structures = specimenDescription.PrimaryAnatomicStructureSequence
      attributes.push({
        name: 'Anatomic Structure',
        value: structures[0].CodeMeaning
      })
    }

    function doesCodeMatch (
      code: dcmjs.sr.coding.CodedConcept,
      scheme: string,
      value: string
    ): boolean {
      if (code.CodingSchemeDesignator === scheme && code.CodeValue === value) {
        return true
      }
      return false
    }

    // TID 8001 "Specimen Preparation"
    this.props.specimenDescriptionSequence.SpecimenPreparationSequence.forEach(
      (step: dmv.metadata.SpecimenPreparation, index: number): void => {
        step.SpecimenPreparationStepContentItemSequence.forEach((
          item: (
            dcmjs.sr.valueTypes.CodeContentItem |
            dcmjs.sr.valueTypes.TextContentItem |
            dcmjs.sr.valueTypes.UIDRefContentItem |
            dcmjs.sr.valueTypes.PNameContentItem |
            dcmjs.sr.valueTypes.DateTimeContentItem
          ),
          index: number
        ) => {
          const name = item.ConceptNameCodeSequence[0]
          if (item.ValueType === 'CODE') {
            item = item as dcmjs.sr.valueTypes.CodeContentItem
            const value = item.ConceptCodeSequence[0]
            if (doesCodeMatch(name, 'DCM', '111701')) {
              // Processing Type
              const processingType = value.CodeMeaning
              console.debug(
                `parse specimen preparation step "${processingType}"`
              )
            } else {
              if (doesCodeMatch(name, 'SCT', '17636008')) {
                attributes.push({
                  name: 'Surgical collection',
                  value: value.CodeMeaning
                })
              } else if (doesCodeMatch(name, 'SCT', '430864009')) {
                attributes.push({
                  name: 'Fixative',
                  value: value.CodeMeaning
                })
              } else if (doesCodeMatch(name, 'SCT', '430863003')) {
                attributes.push({
                  name: 'Embedding medium',
                  value: value.CodeMeaning
                })
              } else if (doesCodeMatch(name, 'SCT', '424361007')) {
                attributes.push({
                  name: 'Stain',
                  value: value.CodeMeaning
                })
              }
            }
          } else if (item.ValueType === 'TEXT') {
            item = item as dcmjs.sr.valueTypes.TextContentItem
            if (doesCodeMatch(name, 'SCT', '424361007')) {
              attributes.push({
                name: 'Stain',
                value: item.TextValue
              })
            }
          } else {
            console.debug(`specimen preparation step #${index} not rendered`)
          }
        })
      }
    )

    const content = (
      // To Do: implement opacity input, color picker, clipping double slider
      // To Do: implement min/max color function double sliders 
      // (we need to update the viewer API and the offscreen render as well for this)
      <div style={{ width: "100%", height: "100%" }}>
        <Slider />
      </div>
    );

    return (
      <Space align='start'>
        <div style={{ paddingLeft: '14px', paddingTop: '10px' }}>
          <Space direction="vertical">
            <Switch
              size='small'
              checked={this.state.visible}
              onChange={this.handleVisibilityChange}
              checkedChildren={<FaEye />}
              unCheckedChildren={<FaEyeSlash />}
            />
            
            <Popover placement="left" content={content} title={"Blending"}>
              <Button type="primary" shape="circle" icon={<SettingOutlined />}>
              </Button>
            </Popover>
          </Space>
        </div>
        <Description
          header={'ID: ' + identifier}
          attributes={attributes}
          selectable
          hasLongValues
        />
      </Space>
    )
  }
}

export default SampleItem
