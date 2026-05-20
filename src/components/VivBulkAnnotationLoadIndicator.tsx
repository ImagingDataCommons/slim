import { LoadingOutlined } from '@ant-design/icons'
import { Spin } from 'antd'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { useEffect, useState } from 'react'

import {
  formatVivBulkElapsedMs,
  type VivBulkAnnotationLoadStatus,
  type VivBulkGroupLoadState,
  vivBulkLoadStatusIsActive,
} from '../viv/vivBulkLoadStatus'

export interface VivBulkAnnotationLoadIndicatorProps {
  status: VivBulkAnnotationLoadStatus
  metadataByGroupUID?: Record<
    string,
    dmv.metadata.MicroscopyBulkSimpleAnnotations
  >
  /** `panel` = right rail; `overlay` = floating banner on the slide viewport. */
  variant?: 'panel' | 'overlay'
}

function groupLabel(
  uid: string,
  metadataByGroupUID?: Record<
    string,
    dmv.metadata.MicroscopyBulkSimpleAnnotations
  >,
): string {
  const meta = metadataByGroupUID?.[uid] as
    | { AnnotationGroupLabel?: string }
    | undefined
  const label =
    meta?.AnnotationGroupLabel != null &&
    String(meta.AnnotationGroupLabel).length > 0
      ? String(meta.AnnotationGroupLabel)
      : undefined
  if (label != null) {
    return label
  }
  return `Group …${uid.slice(-8)}`
}

function phaseLabel(group: VivBulkGroupLoadState): string {
  if (group.detail != null && group.detail.length > 0) {
    return group.detail
  }
  if (group.phase === 'fetching') {
    return 'Retrieving bulk annotation data…'
  }
  if (group.phase === 'processing') {
    if (
      group.chunkIndex != null &&
      group.estimatedChunks != null &&
      group.estimatedChunks > 1
    ) {
      return `Processing & rendering (part ${group.chunkIndex + 1} of ${group.estimatedChunks})…`
    }
    return 'Processing annotations…'
  }
  if (group.phase === 'done') {
    return 'Loaded'
  }
  return 'Failed'
}

function elapsedForGroup(group: VivBulkGroupLoadState, nowMs: number): number {
  const end = group.finishedAtMs ?? nowMs
  return Math.max(0, end - group.startedAtMs)
}

const VivBulkAnnotationLoadIndicator: React.FC<
  VivBulkAnnotationLoadIndicatorProps
> = ({ status, metadataByGroupUID, variant = 'panel' }) => {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const active = vivBulkLoadStatusIsActive(status)

  useEffect(() => {
    if (!active) {
      return
    }
    const id = window.setInterval(() => {
      setNowMs(Date.now())
    }, 200)
    return () => {
      window.clearInterval(id)
    }
  }, [active])

  const metadataLoading = status.metadataPhase === 'loading'
  const inFlightGroups = status.activeGroups.filter(
    (g) => g.phase === 'fetching' || g.phase === 'processing',
  )
  const recentlyDone = status.activeGroups.filter((g) => g.phase === 'done')

  if (
    !metadataLoading &&
    inFlightGroups.length === 0 &&
    recentlyDone.length === 0 &&
    status.metadataPhase !== 'done'
  ) {
    return null
  }

  const isOverlay = variant === 'overlay'
  const wrapStyle: React.CSSProperties = isOverlay
    ? {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 3,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }

  const cardStyle: React.CSSProperties = isOverlay
    ? {
        padding: '10px 14px',
        borderRadius: 10,
        background: 'rgba(255, 255, 255, 0.94)',
        border: '1px solid rgba(109, 40, 217, 0.22)',
        boxShadow: '0 8px 24px rgba(67, 56, 202, 0.12)',
        fontSize: 12,
        lineHeight: 1.45,
        color: 'rgba(0, 0, 0, 0.82)',
      }
    : {
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(109, 40, 217, 0.06)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        fontSize: 11,
        lineHeight: 1.45,
        color: 'rgba(0, 0, 0, 0.78)',
      }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  }

  const lines: React.ReactNode[] = []

  if (metadataLoading) {
    const elapsed =
      status.metadataStartedAtMs != null
        ? nowMs - status.metadataStartedAtMs
        : 0
    lines.push(
      <div key="metadata-loading" style={rowStyle}>
        <Spin indicator={<LoadingOutlined spin />} size="small" />
        <div>
          <div style={{ fontWeight: 600 }}>Loading annotation catalog</div>
          <div style={{ opacity: 0.85 }}>
            Querying series metadata… {formatVivBulkElapsedMs(elapsed)}
          </div>
        </div>
      </div>,
    )
  } else if (
    status.metadataPhase === 'done' &&
    status.metadataFinishedAtMs != null &&
    status.metadataStartedAtMs != null &&
    inFlightGroups.length === 0 &&
    recentlyDone.length === 0 &&
    variant === 'panel'
  ) {
    lines.push(
      <div key="metadata-done" style={{ opacity: 0.85 }}>
        Catalog ready ({status.metadataGroupCount ?? 0} group
        {(status.metadataGroupCount ?? 0) === 1 ? '' : 's'}) in{' '}
        {formatVivBulkElapsedMs(
          status.metadataFinishedAtMs - status.metadataStartedAtMs,
        )}
      </div>,
    )
  }

  for (const group of inFlightGroups) {
    const elapsed = elapsedForGroup(group, nowMs)
    lines.push(
      <div key={`active-${group.groupUID}`} style={rowStyle}>
        <Spin indicator={<LoadingOutlined spin />} size="small" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>
            {groupLabel(group.groupUID, metadataByGroupUID)}
          </div>
          <div style={{ opacity: 0.85 }}>{phaseLabel(group)}</div>
          <div style={{ opacity: 0.75, fontSize: isOverlay ? 11 : 10 }}>
            {formatVivBulkElapsedMs(elapsed)}
            {group.annotationCount != null
              ? ` · ${group.annotationCount.toLocaleString()} annotations`
              : ''}
          </div>
        </div>
      </div>,
    )
  }

  for (const group of recentlyDone) {
    if (group.finishedAtMs == null) {
      continue
    }
    const elapsed = group.finishedAtMs - group.startedAtMs
    lines.push(
      <div key={`done-${group.groupUID}`} style={{ opacity: 0.88 }}>
        {groupLabel(group.groupUID, metadataByGroupUID)} loaded in{' '}
        {formatVivBulkElapsedMs(elapsed)}
      </div>,
    )
  }

  if (lines.length === 0) {
    return null
  }

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>{lines}</div>
    </div>
  )
}

export default VivBulkAnnotationLoadIndicator
