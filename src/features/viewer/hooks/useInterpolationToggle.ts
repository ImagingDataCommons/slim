import { useRef, useState } from 'react'

/**
 * Interpolation on/off for SEG and parametric-map overlays. Keeps a ref in
 * sync so rapid Display-options flips do not double-toggle the viewer.
 */
export function useInterpolationToggle(
  toggle: () => void,
  initial = true,
): {
  isInterpolationEnabled: boolean
  resetInterpolation: () => void
  onInterpolationChange: (interpolationEnabled: boolean) => void
} {
  const [isInterpolationEnabled, setIsInterpolationEnabled] = useState(initial)
  const isInterpolationEnabledRef = useRef(initial)

  return {
    isInterpolationEnabled,
    resetInterpolation: () => {
      isInterpolationEnabledRef.current = initial
      setIsInterpolationEnabled(initial)
    },
    onInterpolationChange: (interpolationEnabled) => {
      if (interpolationEnabled === isInterpolationEnabledRef.current) return
      isInterpolationEnabledRef.current = interpolationEnabled
      setIsInterpolationEnabled(interpolationEnabled)
      toggle()
    },
  }
}
