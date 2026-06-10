import type { MenuProps } from 'antd'
import { Drawer, Menu, Switch } from 'antd'
import type React from 'react'
import { useState, useSyncExternalStore } from 'react'

import { SettingsRegistration } from '../contexts/SettingsContext'
import {
  getIccProfilesEnabled,
  setIccProfilesEnabled,
  subscribeIccProfilesEnabled,
} from '../preferences/iccProfilesPreference'
import './SlideViewer/SettingsPanel.css'

export interface VivSettingsDrawerProps {
  /** When false, ICC toggle is disabled (no profiles on slide), matching SlideViewer. */
  iccProfilesAvailable: boolean
}

/**
 * Registers the header Settings button and provides a minimal drawer (Display → ICC)
 * for `/viv/...` routes where {@link SlideViewer} is not mounted.
 */
const VivSettingsDrawer: React.FC<VivSettingsDrawerProps> = ({
  iccProfilesAvailable,
}) => {
  const [open, setOpen] = useState(false)
  const iccEnabled = useSyncExternalStore(
    subscribeIccProfilesEnabled,
    getIccProfilesEnabled,
    getIccProfilesEnabled,
  )

  const iccRow = (
    <div
      className={iccProfilesAvailable ? undefined : 'slim-settings-disabled'}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span>ICC Profiles</span>
      <Switch
        checked={iccEnabled}
        disabled={!iccProfilesAvailable}
        onChange={(checked) => {
          setIccProfilesEnabled(checked)
        }}
      />
    </div>
  )

  return (
    <>
      <SettingsRegistration onOpenSettings={() => setOpen(true)} />
      <Drawer
        title="Settings"
        placement="right"
        onClose={() => setOpen(false)}
        open={open}
        width={320}
        className="slim-settings-drawer"
        bodyStyle={{ padding: 0, minHeight: '100%', overflow: 'auto' }}
      >
        <Menu
          mode="inline"
          className="slim-settings-menu"
          defaultOpenKeys={['display']}
          style={{ border: 'none', width: '100%' }}
          inlineIndent={14}
          selectable={false}
          items={
            [
              {
                key: 'display',
                label: 'Display',
                children: [
                  {
                    key: 'display-content',
                    label: (
                      <div className="slim-settings-content">{iccRow}</div>
                    ),
                    disabled: true,
                    style: { height: 'auto', cursor: 'default' },
                  },
                ],
              },
            ] satisfies MenuProps['items']
          }
        />
      </Drawer>
    </>
  )
}

export default VivSettingsDrawer
