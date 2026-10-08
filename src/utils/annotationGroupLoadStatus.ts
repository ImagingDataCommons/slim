/** Step of a bulk annotation group's hydrate lifecycle. */
export type AnnotationGroupLoadPhase =
  | 'index'
  | 'data'
  | 'decoding'
  | 'done'
  | 'error'

export interface AnnotationGroupLoadState {
  uid: string
  label: string
  phase: AnnotationGroupLoadPhase
  startedAtMs: number
  finishedAtMs?: number
  loadedBytes?: number
  totalBytes?: number | null
}

/** Formats an elapsed duration for display, e.g. "420 ms" or "1.3 s". */
export function formatElapsedMs(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`
  }
  return `${(ms / 1000).toFixed(1)} s`
}

/** Insert or update a group's load state by uid, preserving `startedAtMs`. */
export function upsertAnnotationGroupLoadState(
  states: AnnotationGroupLoadState[],
  uid: string,
  patch: Partial<AnnotationGroupLoadState> & {
    phase: AnnotationGroupLoadPhase
  },
): AnnotationGroupLoadState[] {
  const index = states.findIndex((state) => state.uid === uid)
  const existing = index >= 0 ? states[index] : undefined
  const next: AnnotationGroupLoadState = {
    uid,
    label: uid,
    ...existing,
    ...patch,
    startedAtMs: existing?.startedAtMs ?? patch.startedAtMs ?? Date.now(),
  }
  if (index >= 0) {
    const copy = states.slice()
    copy[index] = next
    return copy
  }
  return [...states, next]
}

export function removeAnnotationGroupLoadState(
  states: AnnotationGroupLoadState[],
  uid: string,
): AnnotationGroupLoadState[] {
  return states.filter((state) => state.uid !== uid)
}
