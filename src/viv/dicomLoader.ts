// Ported from https://github.com/jmuhlich/viv-dicomweb-test (dicomweb.js).
// Adapts dicom-microscopy-viewer tile loaders to Viv PixelSource.

// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import type DicomWebManager from '../DicomWebManager'

export interface DicomRetrieveOptions {
  studyInstanceUID: string
  seriesInstanceUID: string
}

type OpticalPathEntry = {
  pyramid: {
    metadata: Array<{
      TotalPixelMatrixRows: number
      TotalPixelMatrixColumns: number
      Columns: number
      Rows: number
    }>
    /** Per pyramid level: [Columns, Rows] for that resolution. */
    tileSizes: Array<[number, number]>
  }
  layer: {
    getSource: () => {
      loader_: (level: number, x: number, y: number) => Promise<ArrayBuffer>
    }
  }
}

/** OpenLayers DataTileSource sets this asynchronously inside VolumeImageViewer.render(). */
function getDataTileLoader(
  source: { loader_?: unknown } | null,
): ((z: number, y: number, x: number) => Promise<ArrayBuffer>) | undefined {
  const fn = source?.loader_
  return typeof fn === 'function'
    ? (fn as (z: number, y: number, x: number) => Promise<ArrayBuffer>)
    : undefined
}

/**
 * `render()` triggers `forEach(async …)` ICC fetches and only then `setLoader`.
 * A single rAF returns before loaders exist; wait until every optical path source is ready.
 */
async function waitForOpenLayersTileLoaders(
  opticalPaths: { [key: string]: OpticalPathEntry },
  timeoutMs: number,
): Promise<void> {
  const paths = Object.values(opticalPaths)
  if (paths.length === 0) {
    return
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ready = paths.every((p) => {
      const loader = getDataTileLoader(
        p.layer.getSource() as { loader_?: unknown } | null,
      )
      return loader !== undefined
    })
    if (ready) {
      return
    }
    await new Promise<void>((r) => {
      setTimeout(r, 50)
    })
  }
  const missing = Object.entries(opticalPaths)
    .filter(([, p]) => {
      return (
        getDataTileLoader(
          p.layer.getSource() as { loader_?: unknown } | null,
        ) === undefined
      )
    })
    .map(([id]) => id)
  throw new Error(
    `Timed out waiting for OpenLayers tile loaders (still missing: ${missing.join(', ') || 'unknown'}).`,
  )
}

function getOpticalPathsMap(viewer: dmv.viewer.VolumeImageViewer): {
  [key: string]: OpticalPathEntry
} {
  const sym = Object.getOwnPropertySymbols(viewer).find(
    (s) => s.description === 'opticalPaths',
  )
  if (sym === undefined) {
    throw new Error(
      'dicom-microscopy-viewer VolumeImageViewer: opticalPaths symbol not found',
    )
  }
  const raw = viewer[sym as unknown as keyof dmv.viewer.VolumeImageViewer]
  return raw as unknown as { [key: string]: OpticalPathEntry }
}

export class DicomLoader {
  private readonly _client: DicomWebManager

  private readonly _retrieveOptions: DicomRetrieveOptions

  private _viewer?: dmv.viewer.VolumeImageViewer

  private _opticalPaths?: { [key: string]: OpticalPathEntry }

  private _tileSize?: number

  private _loaders?: {
    [channel: string]: (
      level: number,
      x: number,
      y: number,
    ) => Promise<ArrayBuffer>
  }

  private _shapes?: Array<
    [number, number, number] | [number, number, number, number]
  >

  /**
   * Optical path ids from dicom-microscopy-viewer (DICOM OpticalPathIdentifier),
   * sorted for stable Viv channel index { c: 0 .. n-1 }.
   */
  private _orderedPathKeys?: string[]

  /** Set when the viewer is first built; 8- or 16-bit SM tiles both load as float then convert to Uint16 in getTile. */
  bitsAllocated?: 8 | 16

  /** Samples per pixel for SM instances (1 = monochrome paths, 3 = RGB color slide). */
  samplesPerPixel?: number

  constructor(client: DicomWebManager, retrieveOptions: DicomRetrieveOptions) {
    this._client = client
    this._retrieveOptions = retrieveOptions
  }

  private async _getViewer(): Promise<dmv.viewer.VolumeImageViewer> {
    if (this._viewer === undefined) {
      const metadata = await this._client.retrieveSeriesMetadata(
        this._retrieveOptions,
      )
      const candidates: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
      metadata.forEach((m) => {
        const image = new dmv.metadata.VLWholeSlideMicroscopyImage({
          metadata: m as unknown as object,
        })
        const b = image.BitsAllocated
        if (b !== 8 && b !== 16) {
          throw new Error(
            `Viv path: ${b}-bit pixel data is not supported (only 8 and 16).`,
          )
        }
        const imageFlavor = image.ImageType[2]
        if (imageFlavor === 'VOLUME' || imageFlavor === 'THUMBNAIL') {
          candidates.push(image)
        }
      })
      /*
       * THUMBNAIL instances often use a different frame size than VOLUME pyramid
       * tiles, so pyramid.tileSizes differ across levels. Viv/deck MultiscaleImageLayer
       * expects one tile grid; mixing THUMBNAIL + VOLUME triggers
       * "Inconsistent or non-square tile sizes". Prefer VOLUME only when present.
       */
      const hasVolume = candidates.some((img) => img.ImageType[2] === 'VOLUME')
      const volumeImages = candidates.filter((img) =>
        hasVolume
          ? img.ImageType[2] === 'VOLUME'
          : img.ImageType[2] === 'THUMBNAIL',
      )
      let bitsAllocated: 8 | 16 | undefined
      for (const image of volumeImages) {
        const b = image.BitsAllocated as 8 | 16
        if (bitsAllocated === undefined) {
          bitsAllocated = b
        } else if (bitsAllocated !== b) {
          throw new Error(
            'Viv path: mixed 8- and 16-bit instances in one series are not supported.',
          )
        }
      }
      if (volumeImages.length === 0) {
        throw new Error(
          'Viv path: no VOLUME or THUMBNAIL SM instances found for this series.',
        )
      }
      let spp: number | undefined
      for (const image of volumeImages) {
        const s = image.SamplesPerPixel
        if (spp === undefined) {
          spp = s
        } else if (spp !== s) {
          throw new Error(
            'Viv path: mixed SamplesPerPixel values in one series are not supported.',
          )
        }
      }
      if (spp !== 1 && spp !== 3) {
        throw new Error(
          `Viv path: SamplesPerPixel=${String(spp)} is not supported (only 1 and 3).`,
        )
      }
      this.bitsAllocated = bitsAllocated
      this.samplesPerPixel = spp
      this._viewer = new dmv.viewer.VolumeImageViewer({
        client: this._client,
        metadata: volumeImages,
        controls: [],
      })
    }
    return this._viewer
  }

  private async _getOpticalPaths(): Promise<{
    [key: string]: OpticalPathEntry
  }> {
    if (this._opticalPaths === undefined) {
      const viewer = await this._getViewer()
      this._opticalPaths = getOpticalPathsMap(viewer)
    }
    return this._opticalPaths
  }

  private async _getTileSize(): Promise<number> {
    if (this._tileSize === undefined) {
      const opticalPaths = await this._getOpticalPaths()
      const pathList = Object.values(opticalPaths)
      if (pathList.length === 0) {
        throw new Error('No tile sizes found in optical paths')
      }
      const ref = pathList[0].pyramid.tileSizes
      if (ref.length === 0) {
        throw new Error('No tile sizes found in optical paths')
      }
      for (let p = 1; p < pathList.length; p++) {
        const ts = pathList[p].pyramid.tileSizes
        if (ts.length !== ref.length) {
          throw new Error(
            'Viv path: optical paths have different pyramid level counts.',
          )
        }
        for (let L = 0; L < ref.length; L++) {
          if (ts[L][0] !== ref[L][0] || ts[L][1] !== ref[L][1]) {
            throw new Error(
              'Viv path: optical paths disagree on tile size at pyramid level ' +
                `${L} ([${ref[L]}] vs [${ts[L]}]).`,
            )
          }
        }
      }
      const perLevel = ref.map(([cols, rows]) => {
        if (cols !== rows) {
          throw new Error(
            'Viv path: non-square tiles (Columns !== Rows) are not supported.',
          )
        }
        return cols
      })
      if (perLevel.some((s) => s !== perLevel[0])) {
        throw new Error(
          'Viv path: tile size varies by pyramid level; only a uniform tile ' +
            'grid is supported.',
        )
      }
      this._tileSize = perLevel[0]
    }
    return this._tileSize
  }

  private async _ensureOrderedPathKeys(): Promise<string[]> {
    if (this._orderedPathKeys === undefined) {
      const opticalPaths = await this._getOpticalPaths()
      const keys = Object.keys(opticalPaths).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      )
      if (keys.length === 0) {
        throw new Error('No optical paths in VolumeImageViewer')
      }
      this._orderedPathKeys = keys
    }
    return this._orderedPathKeys
  }

  /** Map Viv / @vivjs 0-based channel index to dicom-microscopy-viewer optical path id. */
  async resolveOpticalPathId(vivChannelIndex: number): Promise<string> {
    const keys = await this._ensureOrderedPathKeys()
    const id = keys[vivChannelIndex]
    if (id === undefined) {
      throw new Error(
        `Viv channel index ${vivChannelIndex} is out of range (${keys.length} optical paths: ${keys.join(', ')})`,
      )
    }
    return id
  }

  private async _getLoader(
    channel: string,
  ): Promise<(level: number, x: number, y: number) => Promise<ArrayBuffer>> {
    if (this._loaders === undefined) {
      const viewer = await this._getViewer()
      viewer.render({ container: document.createElement('div') })
      const opticalPaths = await this._getOpticalPaths()
      await waitForOpenLayersTileLoaders(opticalPaths, 120_000)
      this._loaders = Object.fromEntries(
        Object.entries(opticalPaths).map(([c, p]) => {
          const loader = getDataTileLoader(
            p.layer.getSource() as { loader_?: unknown } | null,
          )
          if (loader === undefined) {
            throw new Error(
              `OpenLayers tile loader missing for optical path "${c}" after render().`,
            )
          }
          return [c, loader]
        }),
      )
    }
    const loader = this._loaders[channel]
    if (loader === undefined) {
      throw new Error(`No tile loader for channel "${channel}"`)
    }
    return loader
  }

  private async _getShapes(): Promise<
    Array<[number, number, number] | [number, number, number, number]>
  > {
    if (this._shapes === undefined) {
      const opticalPaths = await this._getOpticalPaths()
      const orderedKeys = await this._ensureOrderedPathKeys()
      const first = opticalPaths[orderedKeys[0] ?? '']
      if (first === undefined) {
        throw new Error('No optical paths available for pyramid shapes')
      }
      const spp = this.samplesPerPixel ?? 1
      const sizeC = spp === 3 ? 1 : orderedKeys.length
      this._shapes = first.pyramid.metadata.map((m) => {
        const sizeY = m.TotalPixelMatrixRows
        const sizeX = m.TotalPixelMatrixColumns
        if (spp === 3) {
          return [1, sizeY, sizeX, 3] as [number, number, number, number]
        }
        return [sizeC, sizeY, sizeX] as [number, number, number]
      })
    }
    return this._shapes
  }

  private async _frameLayout(level: number): Promise<{ columns: number }> {
    const opticalPaths = await this._getOpticalPaths()
    const orderedKeys = await this._ensureOrderedPathKeys()
    const meta = opticalPaths[orderedKeys[0] ?? '']?.pyramid.metadata[level]
    if (meta === undefined) {
      throw new Error(`Viv path: missing pyramid metadata for level ${level}`)
    }
    return { columns: meta.Columns }
  }

  async getTile({
    level,
    channel,
    x,
    y,
  }: {
    level: number
    channel: string
    x: number
    y: number
  }): Promise<{
    data: Uint8Array | Uint16Array
    width: number
    height: number
  }> {
    const loader = await this._getLoader(channel)
    const raw = await loader(level, x, y)
    const shape = (await this._getShapes())[level]
    const ts = await this._getTileSize()
    const { columns } = await this._frameLayout(level)
    const validW = Math.min(ts, shape[2] - x * ts)
    const validH = Math.min(ts, shape[1] - y * ts)
    const spp = this.samplesPerPixel ?? 1
    const bits = this.bitsAllocated ?? 16

    if (spp === 3 && bits === 8) {
      const buf = new Uint8Array(ts * ts * 3)
      buf.fill(255)
      if (!(raw instanceof Uint8Array)) {
        throw new Error(
          'Viv path: expected Uint8Array RGB tile from decoder (check SamplesPerPixel / BitsAllocated).',
        )
      }
      for (let row = 0; row < validH; row++) {
        buf.set(
          raw.subarray(row * columns * 3, row * columns * 3 + validW * 3),
          row * ts * 3,
        )
      }
      return { data: buf, width: ts, height: ts }
    }

    if (spp === 3 && bits === 16) {
      const buf = new Uint16Array(ts * ts * 3)
      buf.fill(65535)
      const src =
        raw instanceof Float32Array ? raw : new Float32Array(raw as ArrayBuffer)
      for (let row = 0; row < validH; row++) {
        for (let col = 0; col < validW; col++) {
          const si = (row * columns + col) * 3
          const di = (row * ts + col) * 3
          buf[di] = clampU16(src[si])
          buf[di + 1] = clampU16(src[si + 1])
          buf[di + 2] = clampU16(src[si + 2])
        }
      }
      return { data: buf, width: ts, height: ts }
    }

    const data = monoTileToUint16(
      raw instanceof ArrayBuffer ? raw : (raw as ArrayBufferView),
    )
    const cropX = validW
    const cropY = validH
    let yy = 0
    for (; yy < ts; yy++) {
      for (let xx = cropX; xx < ts; xx++) {
        data[yy * ts + xx] = 0
      }
    }
    for (yy = cropY; yy < ts; yy++) {
      for (let xx = 0; xx < cropX; xx++) {
        data[yy * ts + xx] = 0
      }
    }
    return { data, width: ts, height: ts }
  }

  async getSources(): Promise<DicomPixelSource[]> {
    const levelShapes = await this._getShapes()
    const tileSize = await this._getTileSize()
    const spp = this.samplesPerPixel ?? 1
    const bits = this.bitsAllocated ?? 16
    const dtype: 'Uint8' | 'Uint16' =
      spp === 3 && bits === 8 ? 'Uint8' : 'Uint16'
    const sources = levelShapes.map(
      (shape, i) => new DicomPixelSource(this, i, shape, dtype, tileSize),
    )
    sources.reverse()
    return sources
  }
}

function clampU16(v: number): number {
  if (!Number.isFinite(v)) {
    return 0
  }
  return Math.max(0, Math.min(65535, Math.round(v)))
}

/** Same semantics as previous `new Uint16Array(floatTile)` for decoded mono tiles. */
function monoTileToUint16(raw: ArrayBuffer | ArrayBufferView): Uint16Array {
  if (raw instanceof ArrayBuffer) {
    return new Uint16Array(new Float32Array(raw))
  }
  if (
    raw instanceof Float32Array ||
    raw instanceof Uint16Array ||
    raw instanceof Uint8Array
  ) {
    return new Uint16Array(raw)
  }
  const f32 = new Float32Array(
    raw.buffer,
    raw.byteOffset,
    raw.byteLength / Float32Array.BYTES_PER_ELEMENT,
  )
  return new Uint16Array(f32)
}

export class DicomPixelSource {
  private readonly _loader: DicomLoader

  private readonly _level: number

  labels = ['c', 'y', 'x']

  shape: [number, number, number] | [number, number, number, number]

  dtype: 'Uint8' | 'Uint16'

  tileSize: number

  /**
   * Interleaved RGB tiles use BitmapLayer, which reads `photometricInterpretation` from `meta`.
   * @vivjs defaults to 2 when unset on ImageLayer; MultiscaleImageLayer still destructures `meta` and requires a non-null object.
   */
  meta: { photometricInterpretation: number } | null

  constructor(
    loader: DicomLoader,
    level: number,
    shape: [number, number, number] | [number, number, number, number],
    dtype: 'Uint8' | 'Uint16',
    tileSize: number,
  ) {
    this._loader = loader
    this._level = level
    this.shape = shape
    this.dtype = dtype
    this.tileSize = tileSize
    this.meta = shape.length === 4 ? { photometricInterpretation: 2 } : null
  }

  async getRaster({
    selection,
  }: {
    selection: { c: number; t: number; z: number }
    signal?: AbortSignal
  }): Promise<{
    data: Uint8Array | Uint16Array
    width: number
    height: number
  }> {
    if (this.shape.length === 4) {
      throw new Error('getRaster not supported for interleaved RGB slides')
    }
    if (this.shape[1] > this.tileSize || this.shape[2] > this.tileSize) {
      throw new Error('getRaster not supported for multi-tile pyramid levels')
    }
    return await this.getTile({ x: 0, y: 0, selection })
  }

  async getTile({
    x,
    y,
    selection,
  }: {
    x: number
    y: number
    selection: { c: number; t: number; z: number }
    signal?: AbortSignal
  }): Promise<{
    data: Uint8Array | Uint16Array
    width: number
    height: number
  }> {
    const pathId = await this._loader.resolveOpticalPathId(selection.c)
    return await this._loader.getTile({
      level: this._level,
      channel: pathId,
      x,
      y,
    })
  }

  onTileError(err: Error): void {
    console.error(err)
  }
}
