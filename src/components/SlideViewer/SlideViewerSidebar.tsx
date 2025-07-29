import React from 'react'
import { Layout, Menu } from 'antd'
import * as dmv from 'dicom-microscopy-viewer'
import AnnotationCategoryList from '../AnnotationCategoryList'
import { AnnotationCategoryAndType } from '../../types/annotations'
import { StyleOptions } from './types'

interface SlideViewerSidebarProps {
  labelViewportRef: React.RefObject<HTMLDivElement>
  labelViewer?: dmv.viewer.LabelImageViewer
  openSubMenuItems: string[]
  specimenMenu: React.ReactNode
  iccProfilesMenu: React.ReactNode
  equipmentMenu: React.ReactNode
  opticalPathMenu: React.ReactNode
  presentationStateMenu: React.ReactNode
  annotationMenuItems: React.ReactNode
  annotationGroupMenu: React.ReactNode
  segmentationMenu: React.ReactNode
  parametricMapMenu: React.ReactNode
  annotations: AnnotationCategoryAndType[]
  visibleRoiUIDs: Set<string>
  onAnnotationVisibilityChange: ({ roiUID, isVisible }: { roiUID: string, isVisible: boolean }) => void
  onRoiStyleChange: ({ uid, styleOptions }: { uid: string, styleOptions: StyleOptions }) => void
  defaultAnnotationStyles: { [annotationUID: string]: StyleOptions }
}

/**
 * Sidebar component for the SlideViewer containing all menu items
 */
const SlideViewerSidebar: React.FC<SlideViewerSidebarProps> = ({
  labelViewportRef,
  labelViewer,
  openSubMenuItems,
  specimenMenu,
  iccProfilesMenu,
  equipmentMenu,
  opticalPathMenu,
  presentationStateMenu,
  annotationMenuItems,
  annotationGroupMenu,
  segmentationMenu,
  parametricMapMenu,
  annotations,
  visibleRoiUIDs,
  onAnnotationVisibilityChange,
  onRoiStyleChange,
  defaultAnnotationStyles
}) => {
  const handleMenuOpenChange = (): void => {
    // Give menu item time to render before updating viewer size
    setTimeout(() => {
      if (labelViewer !== null && labelViewer !== undefined) {
        labelViewer.resize()
      }
    }, 100)
  }

  return (
    <Layout.Sider
      width={300}
      reverseArrow
      style={{
        borderLeft: 'solid',
        borderLeftWidth: 0.25,
        overflow: 'hidden',
        background: 'none'
      }}
    >
      <Menu
        mode='inline'
        defaultOpenKeys={openSubMenuItems}
        style={{ height: '100%' }}
        inlineIndent={14}
        forceSubMenuRender
        onOpenChange={handleMenuOpenChange}
      >
        {labelViewportRef.current != null && (
          <Menu.SubMenu key='label' title='Slide label'>
            <Menu.Item style={{ height: '100%' }} key='image'>
              <div
                style={{ height: '220px' }}
                ref={labelViewportRef}
              />
            </Menu.Item>
          </Menu.SubMenu>
        )}
        {specimenMenu}
        {iccProfilesMenu}
        {equipmentMenu}
        {opticalPathMenu}
        {presentationStateMenu}
        <Menu.SubMenu key='annotations' title='Annotations'>
          {annotationMenuItems}
        </Menu.SubMenu>
        {annotationGroupMenu}
        {annotations.length === 0
          ? null
          : (
            <Menu.SubMenu
              key='annotation-categories'
              title='Annotation Categories'
            >
              <AnnotationCategoryList
                annotations={annotations}
                onChange={onAnnotationVisibilityChange}
                checkedAnnotationUids={visibleRoiUIDs}
                onStyleChange={onRoiStyleChange}
                defaultAnnotationStyles={defaultAnnotationStyles}
              />
            </Menu.SubMenu>
            )}
        {segmentationMenu}
        {parametricMapMenu}
      </Menu>
    </Layout.Sider>
  )
}

export default SlideViewerSidebar
