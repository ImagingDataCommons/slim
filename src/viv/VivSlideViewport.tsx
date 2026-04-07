import type { Layer } from '@deck.gl/core'
import { OrthographicView } from '@deck.gl/core'
import DeckGL from '@deck.gl/react'
import { MultiscaleImageLayer } from '@hms-dbmi/viv'
import { message, Spin } from 'antd'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'

import type { VivSettings } from '../AppConfig'
import type DicomWebManager from '../DicomWebManager'
import { DicomLoader } from './dicomLoader'
import { buildVivDisplayOptions } from './vivDisplayDefaults'

export interface VivSlideViewportProps {
  client: DicomWebManager
  studyInstanceUID: string
  seriesInstanceUID: string
  vivSettings?: VivSettings
}

const orthographicView = new OrthographicView()

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
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 100, height: 100 })
  const [layers, setLayers] = useState<Layer[]>([])
  const [loading, setLoading] = useState(true)
  const [viewState, setViewState] = useState<{
    target: [number, number, number]
    zoom: number
  }>({
    target: [0, 0, 0],
    zoom: -6,
  })

  useEffect(() => {
    const el = containerRef.current
    if (el === null) {
      return
    }
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => {
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
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
        const [, height, width] = sources[0].shape
        const channelCount = sources[0].shape[0]
        const display = buildVivDisplayOptions(
          height,
          width,
          channelCount,
          vivSettings,
        )
        // Viv 0.19 MultiscaleImageLayer uses contrast/visibility only; channel
        // colors come from defaults. `vivSettings.colors` is reserved for future use.
        const layer = new MultiscaleImageLayer({
          id: 'slim-viv-multiscale',
          loader: sources as never,
          selections: display.selections,
          channelsVisible: display.channelsVisible,
          contrastLimits: display.contrastLimits,
          dtype: 'Uint16',
        })
        setLayers([layer as unknown as Layer])
        setViewState({
          target: display.initialViewState.target,
          zoom: display.initialViewState.zoom,
        })
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          const text =
            err instanceof Error
              ? err.message
              : 'Failed to open slide in Viv viewer.'
          void message.error(text)
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
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            background: 'rgba(255,255,255,0.6)',
          }}
        >
          <Spin size="large" tip="Loading Viv…" />
        </div>
      )}
      <DeckGL
        views={orthographicView}
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => {
          if (
            vs !== undefined &&
            typeof vs === 'object' &&
            'target' in vs &&
            'zoom' in vs
          ) {
            setViewState(
              vs as { target: [number, number, number]; zoom: number },
            )
          }
        }}
        controller={true}
        layers={layers}
        width={size.width}
        height={size.height}
      />
    </div>
  )
}

export default VivSlideViewport
