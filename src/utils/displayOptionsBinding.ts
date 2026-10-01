import type { DisplayOptionDescriptor } from './displayOptions'

export interface DisplayOption<Id extends string = string>
  extends DisplayOptionDescriptor<Id> {
  onChange: (enabled: boolean) => void
}

/** Keys of `S` holding a boolean flag */
export type BooleanSettingKey<S> = {
  [K in keyof S]-?: S[K] extends boolean | undefined ? K : never
}[keyof S]

/**
 * Attaches toggle handlers to option descriptors. Toggling an option calls
 * `onChange` with a copy of `settings` where the mapped flag is replaced;
 * options without a mapping are rendered but ignore toggles.
 */
export function bindDisplayOptions<S extends object, Id extends string>(
  descriptors: Array<DisplayOptionDescriptor<Id>>,
  settings: S,
  settingKeys: Partial<Record<Id, BooleanSettingKey<S>>>,
  onChange: (settings: S) => void,
): Array<DisplayOption<Id>> {
  return descriptors.map((descriptor) => ({
    ...descriptor,
    onChange: (enabled: boolean): void => {
      const key = settingKeys[descriptor.id]
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
