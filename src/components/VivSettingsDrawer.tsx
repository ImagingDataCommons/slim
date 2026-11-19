import type { MenuProps } from 'antd'
import { Drawer, InputNumber, Menu, Switch } from 'antd'
import type React from 'react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { SettingsRegistration } from '../contexts/SettingsContext'
import {
  getIccProfilesEnabled,
  setIccProfilesEnabled,
  subscribeIccProfilesEnabled,
} from '../preferences/iccProfilesPreference'
import {
  getVivBulkLodEnabled,
  getVivBulkLodLevelsFromFinest,
  setVivBulkLodEnabled,
  setVivBulkLodLevelsFromFinest,
  subscribeVivBulkLodPreference,
  VIV_BULK_LOD_DEFAULT_LEVELS_FROM_FINEST,
  VIV_BULK_LOD_MAX_LEVELS_FROM_FINEST,
} from '../preferences/vivBulkLodPreference'
import './SlideViewer/SettingsPanel.css'

/**
 * Non-interactive menu row for panel content. The `.slim-settings-content`
 * wrapper restores text contrast against antd v4's
 * `.ant-menu-item-disabled { color: ... !important }` rule.
 */
const drawerPanelItemStyle: React.CSSProperties = {
  height: 'auto',
  cursor: 'default',
  color: 'rgba(0, 0, 0, 0.85)',
}

export interface VivSettingsDrawerProps {
  /** When false, ICC toggle is disabled (no profiles on slide), matching SlideViewer. */
  iccProfilesAvailable: boolean
}

/**
 * Registers the header Settings button and provides a minimal drawer (Display → ICC,
 * Annotations → LOD) for `/viv/...` routes where {@link SlideViewer} is not mounted.
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
  const lodEnabled = useSyncExternalStore(
    subscribeVivBulkLodPreference,
    getVivBulkLodEnabled,
    getVivBulkLodEnabled,
  )
  const lodLevelsFromFinest = useSyncExternalStore(
    subscribeVivBulkLodPreference,
    getVivBulkLodLevelsFromFinest,
    getVivBulkLodLevelsFromFinest,
  )
  /** Local draft so typing doesn't thrash LOD rebuilds on every keystroke. */
  const [levelsDraft, setLevelsDraft] = useState<number | null>(
    lodLevelsFromFinest,
  )
  const levelsCommitTimer = useRef<number | null>(null)

  useEffect(() => {
    setLevelsDraft(lodLevelsFromFinest)
  }, [lodLevelsFromFinest])

  useEffect(() => {
    return () => {
      if (levelsCommitTimer.current != null) {
        window.clearTimeout(levelsCommitTimer.current)
      }
    }
  }, [])

  const commitLevels = (value: number | null): void => {
    if (levelsCommitTimer.current != null) {
      window.clearTimeout(levelsCommitTimer.current)
    }
    levelsCommitTimer.current = window.setTimeout(() => {
      levelsCommitTimer.current = null
      setVivBulkLodLevelsFromFinest(value)
    }, 350)
  }

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

  const lodContent = (
    <div className="slim-settings-content">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <span>LOD overview (centroids)</span>
        <Switch
          checked={lodEnabled}
          onChange={(checked) => {
            setVivBulkLodEnabled(checked)
          }}
        />
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          Show paths within N levels of finest
        </div>
        <InputNumber
          min={0}
          max={VIV_BULK_LOD_MAX_LEVELS_FROM_FINEST}
          step={1}
          precision={0}
          style={{ width: '100%' }}
          disabled={!lodEnabled}
          value={levelsDraft ?? undefined}
          onChange={(value) => {
            const next =
              typeof value === 'number' && Number.isFinite(value)
                ? Math.max(0, Math.floor(value))
                : null
            setLevelsDraft(next)
            commitLevels(next)
          }}
          onBlur={() => {
            if (levelsCommitTimer.current != null) {
              window.clearTimeout(levelsCommitTimer.current)
              levelsCommitTimer.current = null
            }
            setVivBulkLodLevelsFromFinest(levelsDraft)
          }}
          placeholder={`Auto (${VIV_BULK_LOD_DEFAULT_LEVELS_FROM_FINEST})`}
          addonAfter="levels"
        />
        <div
          style={{
            fontSize: '0.75rem',
            color: '#8c8c8c',
            marginTop: '0.5rem',
          }}
        >
          0 = finest tile only. Each +1 shows paths one zoom level earlier
          (centroids farther out). Leave empty for Auto (
          {VIV_BULK_LOD_DEFAULT_LEVELS_FROM_FINEST}).
        </div>
      </div>
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
          defaultOpenKeys={['display', 'annotations']}
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
                    style: drawerPanelItemStyle,
                  },
                ],
              },
              {
                key: 'annotations',
                label: 'Annotations',
                children: [
                  {
                    key: 'annotations-lod',
                    label: lodContent,
                    disabled: true,
                    style: drawerPanelItemStyle,
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
