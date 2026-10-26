import { useMemo } from 'react'

import { getCurrentRuntimeInfo, type RuntimeInfo } from '../utils/runtimeInfo'

/** Runtime info read once per mount; `override` replaces it (tests, stories). */
export function useRuntimeInfo(override?: RuntimeInfo): RuntimeInfo {
  const current = useMemo(() => override ?? getCurrentRuntimeInfo(), [override])
  return current
}
