export type VivBulkMetadataLoadPhase = 'idle' | 'loading' | 'done' | 'error'

export type VivBulkGroupLoadPhase = 'fetching' | 'processing' | 'done' | 'error'

export type VivBulkGroupLoadState = {
  groupUID: string
  phase: VivBulkGroupLoadPhase
  startedAtMs: number
  finishedAtMs?: number
  chunkIndex?: number
  estimatedChunks?: number
  annotationCount?: number
  graphicType?: string
  detail?: string
}

export type VivBulkAnnotationLoadStatus = {
  metadataPhase: VivBulkMetadataLoadPhase
  metadataStartedAtMs?: number
  metadataFinishedAtMs?: number
  metadataGroupCount?: number
  activeGroups: VivBulkGroupLoadState[]
}

export const EMPTY_VIV_BULK_LOAD_STATUS: VivBulkAnnotationLoadStatus = {
  metadataPhase: 'idle',
  activeGroups: [],
}

export function formatVivBulkElapsedMs(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`
  }
  return `${(ms / 1000).toFixed(1)} s`
}

export function vivBulkLoadStatusIsActive(
  status: VivBulkAnnotationLoadStatus,
): boolean {
  if (status.metadataPhase === 'loading') {
    return true
  }
  return status.activeGroups.some(
    (g) => g.phase === 'fetching' || g.phase === 'processing',
  )
}

export function upsertVivBulkGroupLoadState(
  status: VivBulkAnnotationLoadStatus,
  groupUID: string,
  patch: Partial<VivBulkGroupLoadState> & {
    phase: VivBulkGroupLoadPhase
    startedAtMs: number
  },
): VivBulkAnnotationLoadStatus {
  const idx = status.activeGroups.findIndex((g) => g.groupUID === groupUID)
  const existing = idx >= 0 ? status.activeGroups[idx] : undefined
  const { startedAtMs: patchStartedAtMs, ...restPatch } = patch
  const base: VivBulkGroupLoadState = {
    ...existing,
    groupUID,
    ...restPatch,
    startedAtMs: patchStartedAtMs ?? existing?.startedAtMs ?? Date.now(),
  }
  const activeGroups =
    idx >= 0
      ? status.activeGroups.map((g, i) => (i === idx ? base : g))
      : [...status.activeGroups, base]
  return { ...status, activeGroups }
}

export function removeVivBulkGroupLoadState(
  status: VivBulkAnnotationLoadStatus,
  groupUID: string,
): VivBulkAnnotationLoadStatus {
  return {
    ...status,
    activeGroups: status.activeGroups.filter((g) => g.groupUID !== groupUID),
  }
}
