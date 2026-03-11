/**
 * Centralized service for tracking which series are currently "active" in the
 * viewport - i.e., the active image and any visible derived data (annotations,
 * segmentations, parametric maps, etc.). Used by the DICOM Tag Browser to show
 * an eye icon next to active series.
 */

export interface ActiveSeriesState {
  /** The primary image series displayed in the viewport (from URL) */
  activeImageSeriesUID: string
  /** Derived series with visible overlays (annotations, segmentations, etc.) */
  activeDerivedSeriesUIDs: Set<string>
}

type Listener = (state: ActiveSeriesState) => void

class ActiveSeriesServiceImpl {
  private activeImageSeriesUID = ''
  private activeDerivedSeriesUIDs = new Set<string>()
  private listeners: Listener[] = []

  /** Get all series UIDs that are currently active (image + derived) */
  getActiveSeriesUIDs(): Set<string> {
    const result = new Set(this.activeDerivedSeriesUIDs)
    if (this.activeImageSeriesUID) {
      result.add(this.activeImageSeriesUID)
    }
    return result
  }

  /** Get the current state */
  getState(): ActiveSeriesState {
    return {
      activeImageSeriesUID: this.activeImageSeriesUID,
      activeDerivedSeriesUIDs: new Set(this.activeDerivedSeriesUIDs),
    }
  }

  /** Check if a series is active (image or has visible derived data) */
  isSeriesActive(seriesInstanceUID: string): boolean {
    return (
      seriesInstanceUID === this.activeImageSeriesUID ||
      this.activeDerivedSeriesUIDs.has(seriesInstanceUID)
    )
  }

  /** Update the active series state. Called by SlideViewer and route-aware components. */
  setActiveSeries(
    activeImageSeriesUID: string,
    activeDerivedSeriesUIDs: Iterable<string>,
  ): void {
    const derivedSet = new Set(activeDerivedSeriesUIDs)
    const imageChanged = this.activeImageSeriesUID !== activeImageSeriesUID
    const derivedChanged =
      derivedSet.size !== this.activeDerivedSeriesUIDs.size ||
      [...derivedSet].some((uid) => !this.activeDerivedSeriesUIDs.has(uid))

    if (!imageChanged && !derivedChanged) {
      return
    }

    this.activeImageSeriesUID = activeImageSeriesUID
    this.activeDerivedSeriesUIDs = derivedSet
    this._notify()
  }

  /** Clear all active series (e.g. when navigating away from the viewer). */
  clear(): void {
    this.activeImageSeriesUID = ''
    this.activeDerivedSeriesUIDs = new Set()
    this._notify()
  }

  /** Subscribe to active series changes. Returns unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private _notify(): void {
    const state = this.getState()
    this.listeners.forEach((listener) => {
      try {
        listener(state)
      } catch (err) {
        console.error('[ActiveSeriesService] Listener error:', err)
      }
    })
  }
}

export const ActiveSeriesService = new ActiveSeriesServiceImpl()
