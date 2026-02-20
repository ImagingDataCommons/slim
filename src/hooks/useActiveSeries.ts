import { useEffect, useState } from 'react'

import { ActiveSeriesService } from '../services/ActiveSeriesService'

/**
 * Subscribe to active series (image + visible derived data) for the DICOM Tag Browser.
 * Returns the set of SeriesInstanceUIDs that are currently active in the viewport.
 */
export function useActiveSeries(): Set<string> {
  const [activeSeriesUIDs, setActiveSeriesUIDs] = useState<Set<string>>(() =>
    ActiveSeriesService.getActiveSeriesUIDs(),
  )

  useEffect(() => {
    const unsubscribe = ActiveSeriesService.subscribe(() => {
      setActiveSeriesUIDs(ActiveSeriesService.getActiveSeriesUIDs())
    })
    return unsubscribe
  }, [])

  return activeSeriesUIDs
}
