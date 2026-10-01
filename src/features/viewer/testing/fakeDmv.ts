import type { Mock } from 'vitest'

/**
 * In-memory stand-in for the dicom-microscopy-viewer module, for tests that
 * mount the slide viewer. Only the members the viewer touches are modelled.
 */

type StyleOptions = Record<string, unknown>

interface OpticalPathStyle {
  opacity: number
  color?: number[]
  limitValues?: number[]
}

export interface FakeOpticalPath {
  identifier: string
  isMonochromatic: boolean
  seriesInstanceUID: string
  paletteColorLookupTableUID?: string
}

export class FakePoint {
  readonly graphicType = 'POINT'
  readonly graphicData: number[]
  readonly frameOfReferenceUID: string

  constructor({
    coordinates,
    frameOfReferenceUID,
  }: {
    coordinates: number[]
    frameOfReferenceUID: string
  }) {
    this.graphicData = coordinates
    this.frameOfReferenceUID = frameOfReferenceUID
  }
}

let roiCount = 0

export class FakeRoi {
  readonly uid: string
  readonly scoord3d: FakePoint
  readonly evaluations: unknown[] = []
  readonly measurements: unknown[] = []

  constructor({ scoord3d, uid }: { scoord3d: FakePoint; uid?: string }) {
    roiCount += 1
    this.uid = uid ?? `roi-${roiCount}`
    this.scoord3d = scoord3d
  }

  addEvaluation(item: unknown): void {
    this.evaluations.push(item)
  }
}

interface LayerStyle {
  opacity: number
  [key: string]: unknown
}

interface FakeLayer {
  uid: string
  seriesInstanceUID: string
}

export interface FakeAnnotationGroup extends FakeLayer {
  referencedSeriesInstanceUID: string
}

export interface FakeSegment extends FakeLayer {
  number: number
  isAbsent?: boolean
  isBackground?: boolean
}

export interface FakeSegmentationMetadata {
  SeriesInstanceUID: string
  SegmentationType?: string
  SegmentSequence?: Array<{
    SegmentNumber: number
    RecommendedDisplayCIELabValue?: number[]
  }>
}

export type FakeMapping = FakeLayer

/** Overlays of one kind: items, their metadata, styles and visibility */
export class FakeLayers<T extends FakeLayer, M> {
  private readonly items: T[] = []
  private readonly metadataByUid = new Map<string, M[]>()
  private readonly styles = new Map<string, LayerStyle>()
  readonly visible = new Set<string>()

  add(item: T, metadata: M[] = []): void {
    this.items.push(item)
    this.metadataByUid.set(item.uid, metadata)
  }

  all(): T[] {
    return [...this.items]
  }

  metadata(uid: string): M[] {
    return this.metadataByUid.get(uid) ?? []
  }

  style(uid: string): LayerStyle {
    return this.styles.get(uid) ?? { opacity: 1 }
  }

  setStyle(uid: string, style: Partial<LayerStyle>): void {
    this.styles.set(uid, { ...this.style(uid), ...style })
  }

  show(uid: string): void {
    this.visible.add(uid)
  }

  hide(uid: string): void {
    this.visible.delete(uid)
  }
}

function createFakeMap(): {
  getView: () => unknown
  getViewport: () => HTMLElement
  on: Mock
  un: Mock
} {
  const viewport = document.createElement('div')
  const view = {
    getResolution: () => 0.001,
    getCenter: () => [0, 0],
    getProjection: () => ({
      getMetersPerUnit: () => 1,
      getPointResolutionFunc: () => undefined,
    }),
    animate: vi.fn(),
    getZoom: () => 1,
    fit: vi.fn(),
  }
  return {
    getView: () => view,
    getViewport: () => viewport,
    on: vi.fn(),
    un: vi.fn(),
  }
}

export class FakeVolumeImageViewer {
  readonly options: Record<string, unknown>
  readonly opticalPaths: FakeOpticalPath[]
  readonly opticalPathStyles = new Map<string, OpticalPathStyle>()
  readonly visibleOpticalPaths = new Set<string>()
  readonly activeOpticalPaths = new Set<string>()
  readonly rois: FakeRoi[] = []
  readonly roiStyles = new Map<string, StyleOptions>()
  readonly map = createFakeMap()
  readonly frameOfReferenceUID: string
  readonly boundingBox: number[][] = [
    [0, 0],
    [25, 50],
  ]
  readonly numLevels = 2
  isModifyInteractionActive = false
  isTranslateInteractionActive = false
  private gamma = true

  readonly render = vi.fn()
  readonly cleanup = vi.fn()
  readonly resize = vi.fn()
  readonly navigate = vi.fn()
  readonly activateSelectInteraction = vi.fn()
  readonly deactivateSelectInteraction = vi.fn()
  readonly activateDrawInteraction = vi.fn()
  readonly deactivateDrawInteraction = vi.fn()
  readonly activateSnapInteraction = vi.fn()
  readonly deactivateSnapInteraction = vi.fn()
  readonly activateModifyInteraction = vi.fn(() => {
    this.isModifyInteractionActive = true
  })
  readonly deactivateModifyInteraction = vi.fn(() => {
    this.isModifyInteractionActive = false
  })
  readonly activateTranslateInteraction = vi.fn(() => {
    this.isTranslateInteractionActive = true
  })
  readonly deactivateTranslateInteraction = vi.fn(() => {
    this.isTranslateInteractionActive = false
  })
  readonly clearSelections = vi.fn()
  readonly hideROIs = vi.fn()
  readonly showROIs = vi.fn()
  readonly setAnnotationOptions = vi.fn()
  readonly toggleICCProfiles = vi.fn()
  readonly toggleSegmentationInterpolation = vi.fn()
  readonly toggleParametricMapInterpolation = vi.fn()

  constructor(options: Record<string, unknown>) {
    this.options = options
    const metadata = options.metadata
    const first = Array.isArray(metadata) ? metadata[0] : undefined
    this.frameOfReferenceUID =
      typeof first?.FrameOfReferenceUID === 'string'
        ? first.FrameOfReferenceUID
        : ''
    this.opticalPaths = [
      {
        identifier: '1',
        isMonochromatic: false,
        seriesInstanceUID:
          typeof first?.SeriesInstanceUID === 'string'
            ? first.SeriesInstanceUID
            : '',
      },
    ]
    fakeDmvInstances.volumeViewers.push(this)
  }

  getMap(): ReturnType<typeof createFakeMap> {
    return this.map
  }

  getPixelSpacing(level: number): number[] {
    return [0.001 * 2 ** (this.numLevels - 1 - level)]
  }

  getAllOpticalPaths(): FakeOpticalPath[] {
    return this.opticalPaths
  }

  getOpticalPathMetadata(): unknown[] {
    return []
  }

  getOpticalPathDefaultStyle(): OpticalPathStyle {
    return { opacity: 1 }
  }

  getOpticalPathStyle(identifier: string): OpticalPathStyle {
    return this.opticalPathStyles.get(identifier) ?? { opacity: 1 }
  }

  setOpticalPathStyle(identifier: string, style: OpticalPathStyle): void {
    this.opticalPathStyles.set(identifier, { ...style })
  }

  showOpticalPath(identifier: string): void {
    this.visibleOpticalPaths.add(identifier)
  }

  hideOpticalPath(identifier: string): void {
    this.visibleOpticalPaths.delete(identifier)
  }

  isOpticalPathVisible(identifier: string): boolean {
    return this.visibleOpticalPaths.has(identifier)
  }

  activateOpticalPath(identifier: string): void {
    this.activeOpticalPaths.add(identifier)
  }

  deactivateOpticalPath(identifier: string): void {
    this.activeOpticalPaths.delete(identifier)
  }

  isOpticalPathActive(identifier: string): boolean {
    return this.activeOpticalPaths.has(identifier)
  }

  getICCProfiles(): unknown[] {
    return []
  }

  getPaletteDisplayGammaCorrectionEnabled(): boolean {
    return this.gamma
  }

  setPaletteDisplayGammaCorrectionEnabled(enabled: boolean): void {
    this.gamma = enabled
  }

  getAllROIs(): FakeRoi[] {
    return [...this.rois]
  }

  getROI(uid: string): FakeRoi | undefined {
    return this.rois.find((roi) => roi.uid === uid)
  }

  addROI(roi: FakeRoi, style: StyleOptions = {}): void {
    this.rois.push(roi)
    this.roiStyles.set(roi.uid, style)
  }

  removeROI(uid: string): void {
    const index = this.rois.findIndex((roi) => roi.uid === uid)
    if (index >= 0) this.rois.splice(index, 1)
    this.roiStyles.delete(uid)
  }

  getROIStyle(uid: string): StyleOptions | undefined {
    return this.roiStyles.get(uid)
  }

  setROIStyle(uid: string, style: StyleOptions): void {
    this.roiStyles.set(uid, style)
  }

  readonly annotationGroups = new FakeLayers<FakeAnnotationGroup, unknown>()
  readonly segments = new FakeLayers<FakeSegment, FakeSegmentationMetadata>()
  readonly mappings = new FakeLayers<FakeMapping, unknown>()

  getAllAnnotationGroups(): FakeAnnotationGroup[] {
    return this.annotationGroups.all()
  }
  getAnnotationGroupMetadata(uid: string): unknown {
    return this.annotationGroups.metadata(uid)[0]
  }
  getAnnotationGroupStyle(uid: string): LayerStyle {
    return this.annotationGroups.style(uid)
  }
  readonly setAnnotationGroupStyle = vi.fn((uid: string, style: LayerStyle) =>
    this.annotationGroups.setStyle(uid, style),
  )
  readonly showAnnotationGroup = vi.fn((uid: string) =>
    this.annotationGroups.show(uid),
  )
  readonly hideAnnotationGroup = vi.fn((uid: string) =>
    this.annotationGroups.hide(uid),
  )
  readonly zoomToROI = vi.fn()

  getAllSegments(): FakeSegment[] {
    return this.segments.all()
  }
  getSegmentMetadata(uid: string): FakeSegmentationMetadata[] {
    return this.segments.metadata(uid)
  }
  getSegmentStyle(uid: string): LayerStyle {
    return this.segments.style(uid)
  }
  readonly setSegmentStyle = vi.fn((uid: string, style: LayerStyle) =>
    this.segments.setStyle(uid, style),
  )
  readonly showSegment = vi.fn((uid: string) => this.segments.show(uid))
  readonly hideSegment = vi.fn((uid: string) => this.segments.hide(uid))
  readonly zoomToSegment = vi.fn()

  getAllParameterMappings(): FakeMapping[] {
    return this.mappings.all()
  }
  getParameterMappingMetadata(uid: string): unknown[] {
    return this.mappings.metadata(uid)
  }
  getParameterMappingStyle(uid: string): LayerStyle {
    return this.mappings.style(uid)
  }
  readonly setParameterMappingStyle = vi.fn((uid: string, style: LayerStyle) =>
    this.mappings.setStyle(uid, style),
  )
  readonly showParameterMapping = vi.fn((uid: string) =>
    this.mappings.show(uid),
  )
  readonly hideParameterMapping = vi.fn((uid: string) =>
    this.mappings.hide(uid),
  )
}

export class FakeLabelImageViewer {
  readonly options: Record<string, unknown>
  readonly render = vi.fn()
  readonly cleanup = vi.fn()
  readonly resize = vi.fn()

  constructor(options: Record<string, unknown>) {
    this.options = options
    fakeDmvInstances.labelViewers.push(this)
  }
}

/** Viewers constructed since the last {@link resetFakeDmv} */
export const fakeDmvInstances: {
  volumeViewers: FakeVolumeImageViewer[]
  labelViewers: FakeLabelImageViewer[]
} = { volumeViewers: [], labelViewers: [] }

export function resetFakeDmv(): void {
  fakeDmvInstances.volumeViewers.length = 0
  fakeDmvInstances.labelViewers.length = 0
}

class FakePaletteColorLookupTable {
  readonly options: unknown
  constructor(options: unknown) {
    this.options = options
  }
}

/** Module shape returned by the `vi.mock('dicom-microscopy-viewer')` factory */
export const fakeDmvModule = {
  viewer: {
    VolumeImageViewer: FakeVolumeImageViewer,
    LabelImageViewer: FakeLabelImageViewer,
  },
  roi: { ROI: FakeRoi },
  scoord3d: { Point: FakePoint },
  color: {
    PaletteColorLookupTable: FakePaletteColorLookupTable,
    buildPaletteColorLookupTable: (options: unknown) =>
      new FakePaletteColorLookupTable(options),
  },
  metadata: {
    formatMetadata: (metadata: unknown) => ({
      dataset: metadata,
      bulkDataMapping: {},
    }),
  },
}
