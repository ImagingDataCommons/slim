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
  on: jest.Mock
  un: jest.Mock
} {
  const viewport = document.createElement('div')
  const view = {
    getResolution: () => 0.001,
    getCenter: () => [0, 0],
    getProjection: () => ({
      getMetersPerUnit: () => 1,
      getPointResolutionFunc: () => undefined,
    }),
    animate: jest.fn(),
    getZoom: () => 1,
    fit: jest.fn(),
  }
  return {
    getView: () => view,
    getViewport: () => viewport,
    on: jest.fn(),
    un: jest.fn(),
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

  readonly render = jest.fn()
  readonly cleanup = jest.fn()
  readonly resize = jest.fn()
  readonly navigate = jest.fn()
  readonly activateSelectInteraction = jest.fn()
  readonly deactivateSelectInteraction = jest.fn()
  readonly activateDrawInteraction = jest.fn()
  readonly deactivateDrawInteraction = jest.fn()
  readonly activateSnapInteraction = jest.fn()
  readonly deactivateSnapInteraction = jest.fn()
  readonly activateModifyInteraction = jest.fn(() => {
    this.isModifyInteractionActive = true
  })
  readonly deactivateModifyInteraction = jest.fn(() => {
    this.isModifyInteractionActive = false
  })
  readonly activateTranslateInteraction = jest.fn(() => {
    this.isTranslateInteractionActive = true
  })
  readonly deactivateTranslateInteraction = jest.fn(() => {
    this.isTranslateInteractionActive = false
  })
  readonly clearSelections = jest.fn()
  readonly hideROIs = jest.fn()
  readonly showROIs = jest.fn()
  readonly setAnnotationOptions = jest.fn()
  readonly toggleICCProfiles = jest.fn()
  readonly toggleSegmentationInterpolation = jest.fn()
  readonly toggleParametricMapInterpolation = jest.fn()

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
  readonly setAnnotationGroupStyle = jest.fn((uid: string, style: LayerStyle) =>
    this.annotationGroups.setStyle(uid, style),
  )
  readonly showAnnotationGroup = jest.fn((uid: string) =>
    this.annotationGroups.show(uid),
  )
  readonly hideAnnotationGroup = jest.fn((uid: string) =>
    this.annotationGroups.hide(uid),
  )
  readonly zoomToROI = jest.fn()

  getAllSegments(): FakeSegment[] {
    return this.segments.all()
  }
  getSegmentMetadata(uid: string): FakeSegmentationMetadata[] {
    return this.segments.metadata(uid)
  }
  getSegmentStyle(uid: string): LayerStyle {
    return this.segments.style(uid)
  }
  readonly setSegmentStyle = jest.fn((uid: string, style: LayerStyle) =>
    this.segments.setStyle(uid, style),
  )
  readonly showSegment = jest.fn((uid: string) => this.segments.show(uid))
  readonly hideSegment = jest.fn((uid: string) => this.segments.hide(uid))
  readonly zoomToSegment = jest.fn()

  getAllParameterMappings(): FakeMapping[] {
    return this.mappings.all()
  }
  getParameterMappingMetadata(uid: string): unknown[] {
    return this.mappings.metadata(uid)
  }
  getParameterMappingStyle(uid: string): LayerStyle {
    return this.mappings.style(uid)
  }
  readonly setParameterMappingStyle = jest.fn(
    (uid: string, style: LayerStyle) => this.mappings.setStyle(uid, style),
  )
  readonly showParameterMapping = jest.fn((uid: string) =>
    this.mappings.show(uid),
  )
  readonly hideParameterMapping = jest.fn((uid: string) =>
    this.mappings.hide(uid),
  )
}

export class FakeLabelImageViewer {
  readonly options: Record<string, unknown>
  readonly render = jest.fn()
  readonly cleanup = jest.fn()
  readonly resize = jest.fn()

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

/** Module shape returned by the `jest.mock('dicom-microscopy-viewer')` factory */
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
