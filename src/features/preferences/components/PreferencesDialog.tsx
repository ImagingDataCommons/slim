import type * as React from 'react'
import { useId, useRef } from 'react'

import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../../../components/ui/dialog'
import {
  type PreferencesTab,
  usePreferencesDraft,
} from '../hooks/usePreferencesDraft'
import { useRuntimeInfo } from '../hooks/useRuntimeInfo'
import {
  ALL_TABS,
  APP_TABS,
  getTabDefinition,
  getTabForKey,
  type PreferencesTabDefinition,
  USER_TABS,
} from '../utils/preferencesTabs'
import type { RuntimeInfo } from '../utils/runtimeInfo'
import { NavButton } from './NavButton'
import { type AboutAppInfo, AboutTab } from './tabs/AboutTab'
import { AnnotationsTab } from './tabs/AnnotationsTab'
import { ConfigurationTab } from './tabs/ConfigurationTab'
import { GeneralTab } from './tabs/GeneralTab'
import { KeysTab } from './tabs/KeysTab'

export type { PreferencesTab }

export interface PreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  app: AboutAppInfo
  initialTab?: PreferencesTab
  /** Replaces the build/browser info read from the environment */
  runtimeInfo?: RuntimeInfo
}

export function PreferencesDialog({
  open,
  onOpenChange,
  app,
  initialTab = 'general',
  runtimeInfo,
}: PreferencesDialogProps): React.ReactElement {
  const {
    activeTab,
    setActiveTab,
    draftTheme,
    setDraftTheme,
    draft,
    update,
    save,
  } = usePreferencesDraft(open, initialTab)
  const runtime = useRuntimeInfo(runtimeInfo)
  const baseId = useId()
  const tabRefs = useRef(new Map<PreferencesTab, HTMLButtonElement>())

  const activeDefinition = getTabDefinition(activeTab)
  const tabId = (tab: PreferencesTab): string => `${baseId}-tab-${tab}`
  const panelId = `${baseId}-panel`

  const handleSave = (): void => {
    save()
    onOpenChange(false)
  }

  const handleTabKeyDown = (event: React.KeyboardEvent): void => {
    const next = getTabForKey(ALL_TABS, activeTab, event.key)
    if (next === undefined) return
    event.preventDefault()
    setActiveTab(next)
    tabRefs.current.get(next)?.focus()
  }

  const renderNavButton = (tab: PreferencesTabDefinition): React.ReactNode => (
    <NavButton
      key={tab.id}
      ref={(node) => {
        if (node === null) tabRefs.current.delete(tab.id)
        else tabRefs.current.set(tab.id, node)
      }}
      tab={tab}
      id={tabId(tab.id)}
      panelId={panelId}
      isActive={activeTab === tab.id}
      onSelect={() => setActiveTab(tab.id)}
    />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[78vh] max-h-[88vh] w-[94vw] max-w-[1000px]">
        <SlimDialogHeader
          icon="manage_accounts"
          title="Preferences"
          subtitle={activeDefinition.subtitle}
        />

        <div className="flex min-h-0 flex-1">
          <div
            role="tablist"
            aria-label="Preferences sections"
            aria-orientation="vertical"
            onKeyDown={handleTabKeyDown}
            className="flex w-[200px] flex-none flex-col gap-0.5 border-r border-line-soft bg-subtle p-3"
          >
            {USER_TABS.map(renderNavButton)}
            <div
              aria-hidden="true"
              className="mx-2.5 mb-1.5 mt-3.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-muted"
            >
              Application
            </div>
            {APP_TABS.map(renderNavButton)}
          </div>

          <div
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId(activeTab)}
            className="flex min-h-0 min-w-0 flex-1"
          >
            {activeDefinition.isEditable && (
              <div className="min-w-0 flex-1 overflow-auto px-6 pb-5 pt-1">
                {activeTab === 'general' && (
                  <GeneralTab
                    theme={draftTheme}
                    onThemeChange={setDraftTheme}
                    draft={draft}
                    onChange={update}
                  />
                )}
                {activeTab === 'annotations' && (
                  <AnnotationsTab draft={draft} onChange={update} />
                )}
                {activeTab === 'keys' && <KeysTab />}
              </div>
            )}
            {activeTab === 'config' && (
              <ConfigurationTab
                config={runtime.config}
                configName={runtime.configName}
              />
            )}
            {activeTab === 'about' && <AboutTab app={app} runtime={runtime} />}
          </div>
        </div>

        {activeDefinition.isEditable && (
          <SlimDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="font-semibold">
              Save preferences
            </Button>
          </SlimDialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
