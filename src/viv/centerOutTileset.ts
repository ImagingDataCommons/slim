/**
 * Deck.gl Tileset2D loads visible tiles with equal priority, so requests run in
 * traversal order (roughly left-to-right). This tileset prioritizes tiles by
 * distance from the viewport center (in tile index space) so the image fills in
 * from the middle outward.
 */
import type { Viewport } from '@deck.gl/core'
import {
  _Tile2DHeader as Tile2DHeader,
  _Tileset2D as Tileset2D,
} from '@deck.gl/geo-layers'

type TileIndex = { x: number; y: number; z: number }

type TileLoadDataOptions = {
  getData: (props: {
    index: TileIndex
    id: string
    bbox: unknown
    userData: unknown
    zoom: number
    signal: AbortSignal
  }) => Promise<unknown>
  requestScheduler: {
    scheduleRequest: (
      handle: unknown,
      getPriority: (handle: CenterOutTile2DHeader) => number,
    ) => Promise<{ done: () => void } | null>
  }
  onLoad: (tile: unknown) => void
  onError: (error: unknown, tile: unknown) => void
}

/** Runtime shape of deck.gl Tile2DHeader (private fields accessed via patch). */
interface CenterOutTile2DHeader {
  tileset?: CenterOutTileset2D
  index: TileIndex
  id: string
  bbox: unknown
  userData: unknown
  zoom: number
  content: unknown
  isSelected: boolean
  needsReload: boolean
  _loaderId: number
  _abortController: AbortController | null
  _loader: Promise<void> | undefined
  _isLoaded: boolean
  _isCancelled: boolean
  loadData: (opts: TileLoadDataOptions) => Promise<void>
}

type Tileset2DInternals = {
  _cache: Map<string, CenterOutTile2DHeader>
  _dirty: boolean
  _selectedTiles: CenterOutTile2DHeader[] | null
  _requestScheduler: TileLoadDataOptions['requestScheduler']
  opts: {
    getTileData: TileLoadDataOptions['getData']
    onTileError: TileLoadDataOptions['onError']
  }
  onTileLoad: TileLoadDataOptions['onLoad']
}

const baseLoadData = (
  Tile2DHeader.prototype as unknown as {
    _loadData: (opts: TileLoadDataOptions) => Promise<void>
  }
)._loadData

async function centerOutLoadData(
  this: CenterOutTile2DHeader,
  opts: TileLoadDataOptions,
): Promise<void> {
  const tileset = this.tileset
  if (tileset == null) {
    return baseLoadData.call(this, opts)
  }

  const { index, id, bbox, userData, zoom } = this
  const loaderId = this._loaderId
  this._abortController = new AbortController()
  const { signal } = this._abortController

  const requestToken = await opts.requestScheduler.scheduleRequest(
    this,
    (tile) => tileset.getTileLoadPriority(tile),
  )

  if (!requestToken) {
    this._isCancelled = true
    return
  }
  if (this._isCancelled) {
    requestToken.done()
    return
  }

  let tileData: unknown = null
  let error: unknown
  try {
    tileData = await opts.getData({ index, id, bbox, userData, zoom, signal })
  } catch (err) {
    error = err ?? true
  } finally {
    requestToken.done()
  }

  if (loaderId !== this._loaderId) {
    return
  }

  this._loader = undefined
  this.content = tileData
  if (this._isCancelled && !tileData) {
    this._isLoaded = false
    return
  }
  this._isLoaded = true
  this._isCancelled = false
  if (error) {
    opts.onError(error, this)
  } else {
    opts.onLoad(this)
  }
}

function updateCenterTileIndex(
  tileset: CenterOutTileset2D,
  selected: CenterOutTile2DHeader[] | null,
): void {
  if (selected == null || selected.length === 0) {
    return
  }
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const t of selected) {
    minX = Math.min(minX, t.index.x)
    maxX = Math.max(maxX, t.index.x)
    minY = Math.min(minY, t.index.y)
    maxY = Math.max(maxY, t.index.y)
  }
  tileset._centerTileX = (minX + maxX) / 2
  tileset._centerTileY = (minY + maxY) / 2
}

export class CenterOutTileset2D extends Tileset2D {
  /** Center of the current viewport in tile index space (updated each frame). */
  _centerTileX = 0
  _centerTileY = 0

  override update(
    viewport: Viewport,
    opts?: Parameters<Tileset2D['update']>[1],
  ): number {
    const frame = super.update(viewport, opts)
    const self = this as unknown as Tileset2DInternals
    updateCenterTileIndex(this, self._selectedTiles)
    return frame
  }

  getTileLoadPriority(tile: CenterOutTile2DHeader): number {
    if (!tile.isSelected) {
      return -1
    }
    const dx = tile.index.x - this._centerTileX
    const dy = tile.index.y - this._centerTileY
    // Lower value = scheduled sooner. Prefer finer z at equal index distance.
    return dx * dx + dy * dy - tile.index.z
  }
}

/** Set tileset ref before loadData — base _getTile calls loadData before returning. */
function centerOutGetTile(
  this: CenterOutTileset2D,
  index: TileIndex,
  create?: boolean,
): CenterOutTile2DHeader | undefined {
  const self = this as unknown as Tileset2DInternals
  const id = this.getTileId(index)
  let tile = self._cache.get(id)
  let needsReload = false

  if (!tile && create) {
    tile = new Tile2DHeader(index) as unknown as CenterOutTile2DHeader
    tile.tileset = this
    Object.assign(tile, this.getTileMetadata(tile.index))
    Object.assign(tile, { id, zoom: this.getTileZoom(tile.index) })
    needsReload = true
    self._cache.set(id, tile)
    self._dirty = true
  } else if (tile?.needsReload) {
    needsReload = true
  }

  if (tile != null) {
    tile.tileset = this
    if (needsReload) {
      void tile.loadData({
        getData: self.opts.getTileData,
        requestScheduler: self._requestScheduler,
        onLoad: self.onTileLoad,
        onError: self.opts.onTileError,
      })
    }
  }
  return tile
}

let centerOutTilesetPrototypePatched = false

if (!centerOutTilesetPrototypePatched) {
  ;(
    Tile2DHeader.prototype as unknown as { _loadData: typeof centerOutLoadData }
  )._loadData = centerOutLoadData
  ;(
    CenterOutTileset2D.prototype as unknown as {
      _getTile: typeof centerOutGetTile
    }
  )._getTile = centerOutGetTile
  centerOutTilesetPrototypePatched = true
}
