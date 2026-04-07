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
    }>
    tileSizes: number[]
  }
  layer: {
    getSource: () => {
      loader_: (level: number, x: number, y: number) => Promise<ArrayBuffer>
    }
  }
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

  private _shapes?: Array<[number, number, number]>

  constructor(client: DicomWebManager, retrieveOptions: DicomRetrieveOptions) {
    this._client = client
    this._retrieveOptions = retrieveOptions
  }

  private async _getViewer(): Promise<dmv.viewer.VolumeImageViewer> {
    if (this._viewer === undefined) {
      const metadata = await this._client.retrieveSeriesMetadata(
        this._retrieveOptions,
      )
      const volumeImages: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
      metadata.forEach((m) => {
        const image = new dmv.metadata.VLWholeSlideMicroscopyImage({
          metadata: m as unknown as object,
        })
        if (image.BitsAllocated !== 16) {
          throw new Error('Viv example path: only 16-bit images are supported')
        }
        const imageFlavor = image.ImageType[2]
        if (imageFlavor === 'VOLUME' || imageFlavor === 'THUMBNAIL') {
          volumeImages.push(image)
        }
      })
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
      const tileSizes = Object.entries(opticalPaths)
        .map(([, p]) => p.pyramid.tileSizes)
        .flat(2)
      if (tileSizes.length === 0) {
        throw new Error('No tile sizes found in optical paths')
      }
      if (tileSizes.some((s) => s !== tileSizes[0])) {
        throw new Error(
          'Inconsistent or non-square tile sizes are not supported',
        )
      }
      this._tileSize = tileSizes[0]
    }
    return this._tileSize
  }

  private async _getLoader(
    channel: string,
  ): Promise<(level: number, x: number, y: number) => Promise<ArrayBuffer>> {
    if (this._loaders === undefined) {
      const viewer = await this._getViewer()
      viewer.render({ container: document.createElement('div') })
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
      const opticalPaths = await this._getOpticalPaths()
      this._loaders = Object.fromEntries(
        Object.entries(opticalPaths).map(([c, p]) => {
          const src = p.layer.getSource() as {
            loader_: (
              level: number,
              x: number,
              y: number,
            ) => Promise<ArrayBuffer>
          }
          return [c, src.loader_]
        }),
      )
    }
    const loader = this._loaders[channel]
    if (loader === undefined) {
      throw new Error(`No tile loader for channel "${channel}"`)
    }
    return loader
  }

  private async _getShapes(): Promise<Array<[number, number, number]>> {
    if (this._shapes === undefined) {
      const opticalPaths = await this._getOpticalPaths()
      const first =
        opticalPaths[0] ?? opticalPaths['0'] ?? Object.values(opticalPaths)[0]
      if (first === undefined) {
        throw new Error('No optical paths available for pyramid shapes')
      }
      const sizeC = Object.keys(opticalPaths).length
      this._shapes = first.pyramid.metadata.map((m) => {
        const sizeY = m.TotalPixelMatrixRows
        const sizeX = m.TotalPixelMatrixColumns
        return [sizeC, sizeY, sizeX]
      })
    }
    return this._shapes
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
  }): Promise<{ data: Uint16Array; width: number; height: number }> {
    const loader = await this._getLoader(channel)
    const floatTile = await loader(level, x, y)
    const data = new Uint16Array(floatTile)
    const shape = (await this._getShapes())[level]
    const ts = await this._getTileSize()
    const cropX = Math.min(shape[2] - x * ts, ts)
    const cropY = shape[1] - y * ts
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
    const sources = levelShapes.map(
      (shape, i) => new DicomPixelSource(this, i, shape, 'Uint16', tileSize),
    )
    sources.reverse()
    return sources
  }
}

export class DicomPixelSource {
  private readonly _loader: DicomLoader

  private readonly _level: number

  labels = ['c', 'y', 'x']

  shape: [number, number, number]

  dtype: 'Uint16'

  tileSize: number

  meta: null = null

  constructor(
    loader: DicomLoader,
    level: number,
    shape: [number, number, number],
    dtype: 'Uint16',
    tileSize: number,
  ) {
    this._loader = loader
    this._level = level
    this.shape = shape
    this.dtype = dtype
    this.tileSize = tileSize
  }

  async getRaster({
    selection,
  }: {
    selection: { c: number; t: number; z: number }
    signal?: AbortSignal
  }): Promise<{ data: Uint16Array; width: number; height: number }> {
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
  }): Promise<{ data: Uint16Array; width: number; height: number }> {
    const channel = String(selection.c)
    return await this._loader.getTile({
      level: this._level,
      channel,
      x,
      y,
    })
  }

  onTileError(err: Error): void {
    console.error(err)
  }
}
