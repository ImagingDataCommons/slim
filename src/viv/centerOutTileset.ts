/**
 * Deck.gl tile loading for Viv multiscale slides.
 *
 * - Sorts tile indices center-first (FIFO among equal scheduler priority).
 * - Before each update, aborts in-flight loads for tiles that will not be selected
 *   this frame (fixes pan / zoom-out starvation from visible fine-level placeholders).
 * Do not call reloadAll() on zoom — that evicts fine tiles deck.gl would show as
 * best-available placeholders while coarser tiles load.
 */
import type { Viewport } from '@deck.gl/core'
import { _Tileset2D as Tileset2D } from '@deck.gl/geo-layers'
import { Matrix4, type NumericArray } from '@math.gl/core'

type TileIndex = { x: number; y: number; z: number }

type ZRange = [number, number] | null

const DECK_REFERENCE_TILE_SIZE = 512

interface Tile2DHeaderRuntime {
  index: TileIndex
  isLoading: boolean
  abort: () => void
}

type Tileset2DInternals = {
  _cache: Map<string, Tile2DHeaderRuntime>
  _selectedTiles: Tile2DHeaderRuntime[] | null
  _maxZoom?: number
  _minZoom?: number
  _modelMatrix: Matrix4
  _modelMatrixInverse: Matrix4
  _zRange: ZRange | null
  _getTile: (index: TileIndex, create: true) => Tile2DHeaderRuntime
}

function viewportCenterInTileIndexSpace(
  viewport: Viewport,
  z: number,
  tileSize: number,
  modelMatrixInverse: Matrix4,
): { x: number; y: number } {
  const [worldX, worldY] = viewport.unproject([
    viewport.width / 2,
    viewport.height / 2,
  ])
  const scale = (2 ** z * DECK_REFERENCE_TILE_SIZE) / tileSize
  const mapped = modelMatrixInverse.transformAsPoint([worldX, worldY])
  return {
    x: (mapped[0] * scale) / DECK_REFERENCE_TILE_SIZE,
    y: (mapped[1] * scale) / DECK_REFERENCE_TILE_SIZE,
  }
}

function sortTileIndicesCenterOut(
  indices: TileIndex[],
  viewport: Viewport,
  tileSize: number,
  modelMatrixInverse: Matrix4,
): TileIndex[] {
  if (indices.length <= 1) {
    return indices
  }
  const center = viewportCenterInTileIndexSpace(
    viewport,
    indices[0].z,
    tileSize,
    modelMatrixInverse,
  )
  return [...indices].sort((a, b) => {
    const da = (a.x + 0.5 - center.x) ** 2 + (a.y + 0.5 - center.y) ** 2
    const db = (b.x + 0.5 - center.x) ** 2 + (b.y + 0.5 - center.y) ** 2
    return da - db
  })
}

function resolveModelMatrices(
  tileset: Tileset2DInternals,
  modelMatrix: NumericArray | null | undefined,
): { modelMatrix: Matrix4; modelMatrixInverse: Matrix4 } {
  const modelMatrixAsMatrix4 = modelMatrix
    ? new Matrix4(modelMatrix)
    : tileset._modelMatrix
  const modelMatrixInverse = modelMatrixAsMatrix4.clone().invert()
  return { modelMatrix: modelMatrixAsMatrix4, modelMatrixInverse }
}

/** Abort loads that will not belong to the incoming viewport tile set (free request slots). */
function abortLoadsNotInNextSelection(
  tileset: Tileset2D,
  cache: Map<string, Tile2DHeaderRuntime>,
  nextIds: Set<string>,
): void {
  for (const tile of cache.values()) {
    const id = tileset.getTileId(tile.index)
    if (!nextIds.has(id) && tile.isLoading) {
      tile.abort()
    }
  }
}

export class CenterOutTileset2D extends Tileset2D {
  override update(
    viewport: Viewport,
    opts?: Parameters<Tileset2D['update']>[1],
  ): number {
    const self = this as unknown as Tileset2DInternals
    const zRange = opts?.zRange ?? self._zRange
    const { modelMatrix, modelMatrixInverse } = resolveModelMatrices(
      self,
      opts?.modelMatrix,
    )

    const indices = this.getTileIndices({
      viewport,
      maxZoom: self._maxZoom,
      minZoom: self._minZoom,
      zRange,
      modelMatrix,
      modelMatrixInverse,
    })

    const nextIds = new Set(indices.map((i) => this.getTileId(i)))
    abortLoadsNotInNextSelection(this, self._cache, nextIds)

    return super.update(viewport, opts)
  }

  override getTileIndices(params: {
    viewport: Viewport
    maxZoom?: number
    minZoom?: number
    zRange: ZRange | null
    tileSize?: number
    modelMatrix?: Matrix4
    modelMatrixInverse?: Matrix4
    zoomOffset?: number
  }): TileIndex[] {
    const indices = super.getTileIndices(params)
    const tileSize =
      params.tileSize ?? this.opts.tileSize ?? DECK_REFERENCE_TILE_SIZE
    const modelMatrixInverse =
      params.modelMatrixInverse ??
      (params.modelMatrix
        ? new Matrix4(params.modelMatrix).invert()
        : (this as unknown as Tileset2DInternals)._modelMatrixInverse)
    return sortTileIndicesCenterOut(
      indices,
      params.viewport,
      tileSize,
      modelMatrixInverse,
    )
  }
}
