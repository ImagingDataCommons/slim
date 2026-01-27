import { SettingOutlined } from '@ant-design/icons'
import { Button, Checkbox, Menu, Popover, Space, Tooltip } from 'antd'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import type { Category, Type } from './AnnotationCategoryList'
import ColorSettingsMenu from './ColorSettingsMenu'
import type { StyleOptions } from './SlideViewer/types'

const AnnotationCategoryItem = ({
  category,
  onChange,
  checkedAnnotationUids,
  onStyleChange,
  defaultAnnotationStyles,
  ...props
}: {
  category: Category
  onChange: (arg: { roiUID: string; isVisible: boolean }) => void
  onStyleChange: (arg: { uid: string; styleOptions: StyleOptions }) => void
  defaultAnnotationStyles: {
    [annotationUID: string]: {
      opacity: number
      color: number[]
      contourOnly: boolean
    }
  }
  checkedAnnotationUids: Set<string>
}): JSX.Element => {
  const { types } = category

  const onCheckCategoryChange = (e: CheckboxChangeEvent): void => {
    const isVisible = e.target.checked
    types.forEach((type: Type) => {
      handleChangeCheckedType({ type, isVisible })
    })
  }

  const checkAll = types.every((type: Type) =>
    type.uids.every((uid: string) => checkedAnnotationUids.has(uid)),
  )
  const indeterminate =
    !checkAll &&
    types.some((type: Type) =>
      type.uids.some((uid: string) => checkedAnnotationUids.has(uid)),
    )

  const handleChangeCheckedType = ({
    type,
    isVisible,
  }: {
    type: Type
    isVisible: boolean
  }): void => {
    type.uids.forEach((uid: string) => {
      onChange({ roiUID: uid, isVisible })
    })
  }

  return (
    <Menu.Item style={{ height: '100%', paddingLeft: '3px' }} {...props}>
      <Space align="start">
        <div style={{ paddingLeft: '14px', color: 'black' }}>
          <Space direction="vertical" align="end">
            <Checkbox
              indeterminate={indeterminate}
              checked={checkAll}
              onChange={onCheckCategoryChange}
            >
              <Tooltip
                title={`${category.CodeValue}:${category.CodingSchemeDesignator}`}
                mouseEnterDelay={1}
              >
                {category.CodeMeaning}
              </Tooltip>
              <Popover
                placement="topLeft"
                overlayStyle={{ width: '350px' }}
                title="Display Settings"
                content={() => (
                  <ColorSettingsMenu
                    annotationGroupsUIDs={types.reduce(
                      (acc: string[], type) => {
                        acc.push(...type.uids)
                        return acc
                      },
                      [] as string[],
                    )}
                    onStyleChange={onStyleChange}
                    defaultStyle={defaultAnnotationStyles[types[0].uids[0]]}
                  />
                )}
              >
                <Button
                  type="primary"
                  shape="circle"
                  style={{ marginLeft: '10px' }}
                  icon={<SettingOutlined />}
                />
              </Popover>
            </Checkbox>
          </Space>
          {types.map((type: Type) => {
            const { CodeMeaning, CodingSchemeDesignator, CodeValue, uids } =
              type
            const shortenedCodeMeaning = CodeMeaning.slice(0, 22)
            const displayCodeMeaning =
              shortenedCodeMeaning === CodeMeaning
                ? CodeMeaning
                : `${shortenedCodeMeaning}...`
            const isChecked = uids.every((uid: string) =>
              checkedAnnotationUids.has(uid),
            )
            const indeterminateType =
              !isChecked &&
              uids.some((uid: string) => checkedAnnotationUids.has(uid))
            return (
              <div
                key={`${type.CodingSchemeDesignator}:${type.CodeMeaning}`}
                style={{
                  paddingLeft: '25px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'row',
                }}
              >
                <Checkbox
                  indeterminate={indeterminateType}
                  checked={isChecked}
                  onChange={(e: CheckboxChangeEvent) =>
                    handleChangeCheckedType({
                      type,
                      isVisible: e.target.checked,
                    })
                  }
                />
                <div style={{ paddingLeft: '5px' }}>
                  <Tooltip
                    title={`${CodeValue}:${CodingSchemeDesignator}`}
                    mouseEnterDelay={1}
                  >
                    {displayCodeMeaning}
                  </Tooltip>
                  <Popover
                    placement="topLeft"
                    overlayStyle={{ width: '350px' }}
                    title="Display Settings"
                    content={() => (
                      <ColorSettingsMenu
                        annotationGroupsUIDs={type.uids}
                        onStyleChange={onStyleChange}
                        defaultStyle={defaultAnnotationStyles[type.uids[0]]}
                      />
                    )}
                  >
                    <Button
                      type="primary"
                      shape="circle"
                      style={{ marginLeft: '10px' }}
                      icon={<SettingOutlined />}
                    />
                  </Popover>
                </div>
              </div>
            )
          })}
        </div>
      </Space>
    </Menu.Item>
  )
}

export default AnnotationCategoryItem
