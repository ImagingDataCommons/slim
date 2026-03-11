import { SettingOutlined } from '@ant-design/icons'
import React, { useCallback, useRef, useState } from 'react'

import Button from '../components/Button'

export interface SettingsContextValue {
  openSettings: () => void
  registerSettingsOpener: (opener: (() => void) | null) => void
  showSettingsButton: boolean
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null)

export const useSettings = (): SettingsContextValue | null =>
  React.useContext(SettingsContext)

interface SettingsProviderProps {
  children: React.ReactNode
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}) => {
  const openerRef = useRef<(() => void) | null>(null)
  const [showSettingsButton, setShowSettingsButton] = useState(false)

  const openSettings = useCallback((): void => {
    openerRef.current?.()
  }, [])

  const registerSettingsOpener = useCallback(
    (opener: (() => void) | null): void => {
      openerRef.current = opener
      setShowSettingsButton(opener !== null)
    },
    [],
  )

  const value: SettingsContextValue = {
    openSettings,
    registerSettingsOpener,
    showSettingsButton,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export const SettingsButton: React.FC = () => {
  const settings = useSettings()
  if (settings === null || !settings.showSettingsButton) {
    return null
  }
  return (
    <Button
      icon={SettingOutlined}
      tooltip="Settings"
      onClick={settings.openSettings}
    />
  )
}

interface SettingsRegistrationProps {
  onOpenSettings: () => void
}

/**
 * Registers the settings opener with context when mounted, unregisters when unmounted.
 * Use this inside SlideViewer to connect its settings drawer to the Header's settings button.
 */
export const SettingsRegistration: React.FC<SettingsRegistrationProps> = ({
  onOpenSettings,
}) => {
  const settings = useSettings()
  const onOpenSettingsRef = React.useRef(onOpenSettings)
  onOpenSettingsRef.current = onOpenSettings

  React.useEffect(() => {
    if (settings !== null) {
      const opener = (): void => {
        onOpenSettingsRef.current()
      }
      settings.registerSettingsOpener(opener)
      return () => {
        settings.registerSettingsOpener(null)
      }
    }
    return undefined
  }, [settings])

  return null
}
