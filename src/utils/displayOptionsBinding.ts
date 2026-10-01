import type { DisplayOptionDescriptor } from './displayOptions'

const DISPLAY_OPTION_IDS = [
  'icc',
  'gamma',
  'interpolation',
  'clustering',
] as const

export type DisplayOptionId = (typeof DISPLAY_OPTION_IDS)[number]

export interface DisplayOption extends DisplayOptionDescriptor {
  onChange: (enabled: boolean) => void
}

/** Keys of `S` holding a boolean flag */
export type BooleanSettingKey<S> = {
  [K in keyof S]-?: S[K] extends boolean | undefined ? K : never
}[keyof S]

/** Which boolean setting each display option id toggles */
export type DisplayOptionSettingKeys<S> = Partial<
  Record<DisplayOptionId, BooleanSettingKey<S>>
>

export function isDisplayOptionId(id: string): id is DisplayOptionId {
  return (DISPLAY_OPTION_IDS as readonly string[]).includes(id)
}

/**
 * Attaches toggle handlers to option descriptors. Toggling an option calls
 * `onChange` with a copy of `settings` where the mapped flag is replaced;
 * options without a mapping are rendered but ignore toggles.
 */
export function bindDisplayOptions<S extends object>(
  descriptors: DisplayOptionDescriptor[],
  settings: S,
  settingKeys: DisplayOptionSettingKeys<S>,
  onChange: (settings: S) => void,
): DisplayOption[] {
  return descriptors.map((descriptor) => ({
    ...descriptor,
    onChange: (enabled: boolean): void => {
      const key = isDisplayOptionId(descriptor.id)
        ? settingKeys[descriptor.id]
        : undefined
      if (key === undefined) return
      onChange({ ...settings, [key]: enabled })
    },
  }))
}

/** Summary shown in the collapsed header, e.g. "ICC on · Gamma off". */
export function summarizeDisplayOptions(
  options: DisplayOptionDescriptor[],
): string {
  return options
    .map((option) => {
      const label = option.shortLabel ?? option.label
      if (option.disabled === true) return `${label} n/a`
      return `${label} ${option.enabled ? 'on' : 'off'}`
    })
    .join(' · ')
}
