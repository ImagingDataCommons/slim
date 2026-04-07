import type { Layer } from '@deck.gl/core'
import { OrthographicView } from '@deck.gl/core'
import DeckGL from '@deck.gl/react'
import { MultiscaleImageLayer } from '@hms-dbmi/viv'
import { message, Spin } from 'antd'
import type React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { VivSettings } from '../AppConfig'
import type DicomWebManager from '../DicomWebManager'
import { DicomLoader } from './dicomLoader'
import {
  buildVivDisplayOptions,
  computeOrthographicFitViewState,
} from './vivDisplayDefaults'

export interface VivSlideViewportProps {
  client: DicomWebManager
  studyInstanceUID: string
  seriesInstanceUID: string
  vivSettings?: VivSettings
}

const orthographicView = new OrthographicView()

type ViewState = { target: [number, number, number]; zoom: number }

/**
 * Viv + Deck.gl viewport for DICOM SM (proof-of-concept).
 * See src/viv/README.md for limitations.
 */
const VivSlideViewport: React.FC<VivSlideViewportProps> = ({
  client,
  studyInstanceUID,
  seriesInstanceUID,
  vivSettings,
}) => {
  const vivRef = useRef(vivSettings)
  vivRef.current = vivSettings

  const slotRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<(() => void) | null>(null)
  const slideRef = useRef<{ w: number; h: number } | null>(null)
  const fitDoneRef = useRef(false)

  const [size, setSize] = useState({ width: 100, height: 100 })
  const [layers, setLayers] = useState<Layer[]>([])
  const [loading, setLoading] = useState(true)
  const [viewState, setViewState] = useState<ViewState>({
    target: [0, 0, 0],
    zoom: -6,
  })

  useLayoutEffect(() => {
    const el = slotRef.current
    if (!el) {
      return
    }
    const tick = (): void => {
      const w = Math.max(1, el.clientWidth)
      const h = Math.max(1, el.clientHeight)
      setSize({ width: w, height: h })
      const v = vivRef.current
      const sp = slideRef.current
      if (v?.initialViewState?.zoom != null || !sp || fitDoneRef.current) {
        return
      }
      const fit = computeOrthographicFitViewState(
        w,
        h,
        sp.w,
        sp.h,
        v?.initialViewState?.target,
      )
      if (fit) {
        setViewState(fit)
        fitDoneRef.current = true
      }
    }
    measureRef.current = tick
    const ro = new ResizeObserver(tick)
    ro.observe(el)
    tick()
    return () => {
      ro.disconnect()
      measureRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fitDoneRef.current = false
    slideRef.current = null
    setLoading(true)
    setLayers([])

    const run = async (): Promise<void> => {
      try {
        const dicomLoader = new DicomLoader(client, {
          studyInstanceUID,
          seriesInstanceUID,
        })
        const sources = await dicomLoader.getSources()
        if (cancelled) {
          return
        }
        if (sources.length === 0) {
          throw new Error('No pyramid levels returned for this series.')
        }
        const [, sh, sw] = sources[0].shape
        const bitsAllocated = dicomLoader.bitsAllocated ?? 16
        const d = buildVivDisplayOptions(
          sh,
          sw,
          sources[0].shape[0],
          vivSettings,
          bitsAllocated,
        )
        const layer = new MultiscaleImageLayer({
          id: 'slim-viv-multiscale',
          loader: sources as never,
          selections: d.selections,
          channelsVisible: d.channelsVisible,
          contrastLimits: d.contrastLimits,
          dtype: sources[0].dtype,
          // Lowest pyramid level is often wider/taller than one tile; ImageLayer would call getRaster and fail.
          excludeBackground: true,
        })
        setLayers([layer as unknown as Layer])
        slideRef.current = { w: sw, h: sh }
        setViewState(d.initialViewState)
        requestAnimationFrame(() => {
          if (!cancelled) {
            measureRef.current?.()
          }
        })
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          void message.error(
            err instanceof Error
              ? err.message
              : 'Failed to open slide in Viv viewer.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [client, studyInstanceUID, seriesInstanceUID, vivSettings])

  return (
    <div
      style={{
        flex: '1 1 0%',
        alignSelf: 'stretch',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {loading ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            zIndex: 2,
            background: 'rgba(255,255,255,0.6)',
          }}
        >
          <Spin size="large" tip="Loading viv..." />
        </div>
      ) : null}
      <div ref={slotRef} style={{ position: 'absolute', inset: 0 }}>
        <DeckGL
          views={orthographicView}
          viewState={viewState}
          onViewStateChange={({ viewState: vs }) => {
            if (
              vs &&
              typeof vs === 'object' &&
              'zoom' in vs &&
              'target' in vs
            ) {
              setViewState(vs as ViewState)
            }
          }}
          controller
          layers={layers}
          width={size.width}
          height={size.height}
        />
      </div>
    </div>
  )
}

export default VivSlideViewport
