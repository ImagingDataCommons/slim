export interface DisplayOptionDescriptor<Id extends string = string> {
  id: Id
  label: string
  /** Short label used in the collapsed summary, e.g. "ICC" or "Interp." */
  shortLabel?: string
  description: string
  enabled: boolean
  disabled?: boolean
  /** Disabled only until a change in progress settles, not unavailable */
  busy?: boolean
}

export interface DisplayInputDescriptor {
  label: string
  description: string
  placeholder: string
  unit: string
  inputValue: string
}

export function buildOpticalPathDisplayOptions(settings: {
  iccProfileEnabled: boolean
  gammaEnabled: boolean
  hasIccProfiles?: boolean
  /** The image is being drawn again after an ICC toggle */
  isUpdatingColors?: boolean
  /** Something shown is colored through a palette (SEG, map, channel) */
  usesPalette?: boolean
}): Array<DisplayOptionDescriptor<'icc' | 'gamma'>> {
  const hasNoIccProfiles = settings.hasIccProfiles === false
  const isUpdatingColors = settings.isUpdatingColors === true
  const hasNoPalette = settings.usesPalette === false
  return [
    {
      id: 'icc',
      label: 'ICC profiles',
      shortLabel: 'ICC',
      description: hasNoIccProfiles
        ? 'This slide has no ICC profiles.'
        : isUpdatingColors
          ? 'Updating colors in the viewport…'
          : 'Apply the embedded color profile for accurate stain color.',
      enabled: settings.iccProfileEnabled,
      disabled: hasNoIccProfiles || isUpdatingColors,
      busy: !hasNoIccProfiles && isUpdatingColors,
    },
    {
      id: 'gamma',
      label: 'Gamma correction',
      shortLabel: 'Gamma',
      description: hasNoPalette
        ? 'Affects segmentations, parametric maps and palette-colored channels; none is shown.'
        : 'Correct palette display for monitor gamma.',
      enabled: settings.gammaEnabled,
      /** Turning it on has no visible effect, but it can always be turned off */
      disabled: hasNoPalette && !settings.gammaEnabled,
    },
  ]
}

export function buildSegmentDisplayOptions(settings: {
  interpolationEnabled: boolean
}): Array<DisplayOptionDescriptor<'interpolation'>> {
  return [
    {
      id: 'interpolation',
      label: 'Segment interpolation',
      shortLabel: 'Interp.',
      description: 'Smooth segment edges when zoomed in.',
      enabled: settings.interpolationEnabled,
    },
  ]
}

export function buildMappingDisplayOptions(settings: {
  interpolationEnabled: boolean
}): Array<DisplayOptionDescriptor<'interpolation'>> {
  return [
    {
      id: 'interpolation',
      label: 'Interpolation',
      shortLabel: 'Interp.',
      description: 'Smooth values between pixels.',
      enabled: settings.interpolationEnabled,
    },
  ]
}

export function buildAnnotationGroupDisplayOptions(settings: {
  clusteringEnabled: boolean
}): Array<DisplayOptionDescriptor<'clustering'>> {
  return [
    {
      id: 'clustering',
      label: 'Clustering',
      description: 'Group dense annotations at low zoom.',
      enabled: settings.clusteringEnabled,
    },
  ]
}

export function buildClusteringThresholdInput(
  inputValue: string,
): DisplayInputDescriptor {
  return {
    label: 'Clustering pixel size threshold',
    description:
      'At or below this pixel size, clustering turns off. Leave empty for zoom-based detection.',
    placeholder: 'Auto (zoom-based)',
    unit: 'mm',
    inputValue,
  }
}
