/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'
import type OlMap from 'ol/Map'
import React from 'react'
import { runValidations } from '../contexts/ValidationContext'
import { StorageClasses } from '../data/uids'
import { loadPreferences, type UserPreferences } from '../features/preferences'
import { PREFERENCES_CHANGED_EVENT } from '../features/preferences/utils/preferences'
import {
  HIDDEN_HOVERED_ROI_TOOLTIP,
  HoveredRoiTooltipLayer,
  type HoveredRoiTooltipState,
} from '../features/viewer/components/HoveredRoiTooltipLayer'
import { RoiDescription } from '../features/viewer/components/RoiDescription'
import { AnnotationCategoriesSection } from '../features/viewer/components/sections/AnnotationCategoriesSection'
import { AnnotationConfigurationFields } from '../features/viewer/components/sections/AnnotationConfigurationFields'
import { AnnotationGroupsSection } from '../features/viewer/components/sections/AnnotationGroupsSection'
import { AnnotationsSection } from '../features/viewer/components/sections/AnnotationsSection'
import { EquipmentSection } from '../features/viewer/components/sections/EquipmentSection'
import {
  OpticalPathsSection,
  type OpticalPathsSectionProps,
} from '../features/viewer/components/sections/OpticalPathsSection'
import { ParametricMapsSection } from '../features/viewer/components/sections/ParametricMapsSection'
import { PresentationStatesSection } from '../features/viewer/components/sections/PresentationStatesSection'
import { SegmentationsSection } from '../features/viewer/components/sections/SegmentationsSection'
import { SpecimensSection } from '../features/viewer/components/sections/SpecimensSection'
import { ViewerFooter } from '../features/viewer/components/ViewerFooter'
import { ViewerToolbar } from '../features/viewer/components/ViewerToolbar'
import { ViewportLoadingIndicator } from '../features/viewer/components/ViewportLoadingIndicator'
import { ViewportOverlays } from '../features/viewer/components/ViewportOverlays'
import {
  type DmvEventPayload,
  subscribeDmvEvents,
  subscribeDomEvents,
} from '../features/viewer/services/dmvEvents'
import {
  createExternalStore,
  type ExternalStore,
} from '../features/viewer/services/externalStore'
import { publishToast } from '../features/viewer/services/toast'
import { deriveActiveRoiTool } from '../features/viewer/utils/activeRoiTool'
import {
  type ClusteringSettings,
  changedSettingKeys,
  DMV_DEFAULT_CLUSTERING_THRESHOLD_MM,
  resolveClusteringThreshold,
  shouldApplyClusteringSettings,
} from '../features/viewer/utils/displaySettings'
import {
  choosePyramidLevel,
  EMPTY_GO_TO_INPUT,
  type GoToField,
  type GoToRanges,
  validateGoToInput,
} from '../features/viewer/utils/goTo'
import {
  ALL_SERIES,
  buildSeriesOptions,
  groupBySeries,
  itemsForSeries,
} from '../features/viewer/utils/groupBySeries'
import {
  compareHoveredRois,
  describeBulkAnnotation,
  describeEvaluations,
  type HoveredFeature,
  type HoveredRoi,
  hoveredFeaturesSignature,
  visibleHoveredFeatures,
} from '../features/viewer/utils/hoveredRois'
import { hasIccProfile } from '../features/viewer/utils/iccProfile'
import { shortcutForKeyEvent } from '../features/viewer/utils/keyboardShortcuts'
import { sortByIdentifier } from '../features/viewer/utils/opticalPathOrder'
import {
  computePixelRange,
  mergePixelStatistics,
  type PixelStatistics,
} from '../features/viewer/utils/pixelStatistics'
import {
  matchBlendingItems,
  referencesSlideSeries,
  shouldApplyPresentationState,
  windowLimitValues,
} from '../features/viewer/utils/presentationState'
import { planRoiRemoval } from '../features/viewer/utils/roiRemoval'
import { nextSelectedRoiUIDs } from '../features/viewer/utils/roiSelection'
import { buildRoiDescription } from '../features/viewer/utils/selectedRoiDescription'
import { formatSeriesLabel } from '../features/viewer/utils/seriesLabel'
import {
  type SlideAffine,
  slideAffineFromImages,
} from '../features/viewer/utils/slideCoordinates'
import { reuseEqualStyles } from '../features/viewer/utils/stableStyles'
import {
  INITIAL_VIEWPORT_LOADING_PHASE,
  isViewportLoading,
  nextViewportLoadingPhase,
  type ViewportLoadingEvent,
} from '../features/viewer/utils/viewportLoading'
import {
  applyVisibilityChanges,
  removeHiddenUids,
} from '../features/viewer/utils/visibilityChanges'
import { ActiveSeriesService } from '../services/ActiveSeriesService'
import DicomMetadataStore from '../services/DICOMMetadataStore'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { adaptRoiToAnnotation } from '../services/RoiToAnnotationAdapter'
import type {
  AnnotationCategoryAndType,
  AnnotationSettings,
} from '../types/annotations'
import type {
  AnnotationGroupStyle,
  AnnotationStyle,
  MappingStyle,
  OpticalPathStyle,
  SegmentStyle,
} from '../types/layerStyles'
import { CustomError, errorTypes } from '../utils/CustomError'
import {
  clampOverviewMapInViewport,
  observeOverviewMapClamp,
} from '../utils/clampOverviewMapInViewport'
import { hexToRgb } from '../utils/color'
import { type DebouncedFunction, debounce } from '../utils/debounce'
import {
  applyDistinctFractionalSegmentPalettes,
  applyDistinctParametricMapPalettes,
} from '../utils/distinctOverlayColormaps'
import { encodeDicomDataset } from '../utils/encodeDicomDataset'
import generateReport from '../utils/generateReport'
import { logger } from '../utils/logger'
import { MeasurementReport } from '../utils/measurementReport'
import { withRouter } from '../utils/router'
import { getSegmentationType, getSegmentColor } from '../utils/segmentColors'
import { getSlideDisplayId, getSlideStainInfo } from '../utils/slideDisplay'
import type { VisibilityChange } from '../utils/visibility'
import type { AnnotationGroupDisplaySettings } from './AnnotationGroupList'
import { ConfirmDialog } from './ConfirmDialog'
import Report from './Report'
import {
  DEFAULT_ANNOTATION_COLOR_PALETTE,
  DEFAULT_ANNOTATION_OPACITY,
  DEFAULT_ANNOTATION_STROKE_COLOR,
  DEFAULT_ROI_RADIUS,
  SELECTION_FILL_COLOR,
  SELECTION_STROKE_COLOR,
} from './SlideViewer/constants'
import SlideViewerContent from './SlideViewer/SlideViewerContent'
import SlideViewerModals from './SlideViewer/SlideViewerModals'
import SlideViewerSidebar from './SlideViewer/SlideViewerSidebar'
import type {
  Evaluation,
  EvaluationOptions,
  Measurement,
  SlideViewerProps,
  SlideViewerState,
} from './SlideViewer/types'
import {
  areROIsEqual,
  buildDefaultRoiStyle,
  buildKey,
  formatRoiRemovalMessage,
  formatRoiStyle,
  getRoiKey,
  roiStrokeToCssColor,
} from './SlideViewer/utils/roiUtils'
import {
  constructViewers,
  containsROIAnnotations,
  describesSpecimenSubject,
  implementsTID1500,
} from './SlideViewer/utils/viewerUtils'

type PointerMovePayload = DmvEventPayload<'dicommicroscopyviewer_pointer_move'>

type OpticalPathDisplaySettings = NonNullable<
  OpticalPathsSectionProps['displaySettings']
>

/**
 * React component for interactive viewing of an individual digital slide,
 * which corresponds to one DICOM Series of DICOM Slide Microscopy images and
 * potentially one or more associated DICOM Series of DICOM SR documents.
 */
class SlideViewer extends React.Component<SlideViewerProps, SlideViewerState> {
  private readonly findingOptions: dcmjs.sr.coding.CodedConcept[] = []

  private readonly evaluationOptions: { [key: string]: EvaluationOptions[] } =
    {}

  private readonly measurements: Measurement[] = []

  private readonly geometryTypeOptions: { [key: string]: string[] } = {}

  private readonly volumeViewportRef: React.RefObject<HTMLDivElement>

  /** Element and viewer the label image was last rendered into */
  private labelViewportNode: HTMLDivElement | null = null

  private renderedLabel:
    | { viewer: dmv.viewer.LabelImageViewer; node: HTMLDivElement }
    | undefined

  private stopOverviewMapClamp: (() => void) | undefined

  private volumeViewer: dmv.viewer.VolumeImageViewer

  private labelViewer?: dmv.viewer.LabelImageViewer

  private hoveredRois: Array<HoveredFeature<dmv.roi.ROI>> = []

  private lastPixel: [number, number] = [0, 0]

  private readonly keysDown = new Set<string>()

  private readonly handlePointerMoveDebounced: DebouncedFunction<
    [PointerMovePayload]
  >

  private lastHoveredRoiSignature: string | null = null

  private readonly hoveredRoiTooltipStore: ExternalStore<HoveredRoiTooltipState> =
    createExternalStore<HoveredRoiTooltipState>(HIDDEN_HOVERED_ROI_TOOLTIP)

  private annotationGroupMetadataCache = new Map<
    string,
    dmv.metadata.MicroscopyBulkSimpleAnnotations
  >()

  /** Refreshed on {@link PREFERENCES_CHANGED_EVENT} */
  private preferences: UserPreferences = loadPreferences()

  private defaultRoiStyleCache:
    | { preferences: UserPreferences; style: dmv.viewer.ROIStyleOptions }
    | undefined

  private get defaultRoiStyle(): dmv.viewer.ROIStyleOptions {
    if (this.defaultRoiStyleCache?.preferences !== this.preferences) {
      const { strokeColor, strokeWidth } = this.preferences
      this.defaultRoiStyleCache = {
        preferences: this.preferences,
        style: buildDefaultRoiStyle({
          strokeColor: hexToRgb(strokeColor),
          strokeWidth,
          radius: DEFAULT_ROI_RADIUS,
        }),
      }
    }
    return this.defaultRoiStyleCache.style
  }

  /** Panel style maps of the last render, reused while the styles are equal */
  private panelStyles: {
    opticalPaths: Readonly<Record<string, OpticalPathStyle>>
    segments: Readonly<Record<string, SegmentStyle>>
    mappings: Readonly<Record<string, MappingStyle>>
    annotationGroups: Readonly<Record<string, AnnotationGroupStyle>>
  } = { opticalPaths: {}, segments: {}, mappings: {}, annotationGroups: {} }

  /** Base-level pixel → slide (mm) transform for the cursor readout. */
  private slideAffine: SlideAffine | undefined

  /** Volume image SOP Instance UIDs whose frames the footer counts. */
  private volumeSopInstanceUIDs: ReadonlySet<string> = new Set()

  /** Styles from the annotation configuration, keyed by finding */
  private readonly configuredRoiStyles: {
    [key: string]: dmv.viewer.ROIStyleOptions
  } = {}

  private roiStyles: { [key: string]: dmv.viewer.ROIStyleOptions } = {}

  /** Styles owned by individual ROIs (drawn with the user's preferences or recolored) */
  private roiStylesByUid: {
    [roiUID: string]: dmv.viewer.ROIStyleOptions
  } = {}

  private defaultAnnotationStyles: {
    [annotationUID: string]: AnnotationStyle
  } = {}

  /** Frames requested but not yet loaded; only emptiness is rendered */
  private readonly loadingFrames = new Set<string>()

  private pixelDataStatistics: {
    [opticalPathIdentifier: string]: PixelStatistics
  } = {}

  private unsubscribeEvents: (() => void) | undefined

  private selectedRoiInformation: React.ReactNode

  private readonly selectedRoiStyle: dmv.viewer.ROIStyleOptions = {
    stroke: { color: [...SELECTION_STROKE_COLOR, 1], width: 3 },
    fill: { color: [...SELECTION_FILL_COLOR, 0.5] },
    image: {
      circle: {
        radius: 5,
        fill: { color: [...SELECTION_STROKE_COLOR, 1] },
      },
    },
  }

  constructor(props: SlideViewerProps) {
    super(props)
    logger.log(
      `view slide "${this.props.slide.containerIdentifier}": `,
      this.props.slide,
    )
    const geometryTypeOptions = [
      'point',
      'circle',
      'box',
      'polygon',
      'line',
      'freehandpolygon',
      'freehandline',
    ]
    props.annotations.forEach((annotation: AnnotationSettings) => {
      const finding = new dcmjs.sr.coding.CodedConcept(annotation.finding)
      this.findingOptions.push(finding)
      const key = buildKey(finding)
      if (annotation.geometryTypes !== undefined) {
        this.geometryTypeOptions[key] = annotation.geometryTypes
      } else {
        this.geometryTypeOptions[key] = geometryTypeOptions
      }
      this.evaluationOptions[key] = []
      if (annotation.evaluations !== undefined) {
        annotation.evaluations.forEach((evaluation) => {
          this.evaluationOptions[key].push({
            name: new dcmjs.sr.coding.CodedConcept(evaluation.name),
            values: evaluation.values.map((value) => {
              return new dcmjs.sr.coding.CodedConcept(value)
            }),
          })
        })
      }
      if (annotation.measurements !== undefined) {
        annotation.measurements.forEach((measurement) => {
          this.measurements.push({
            name: new dcmjs.sr.coding.CodedConcept(measurement.name),
            value: undefined,
            unit: new dcmjs.sr.coding.CodedConcept(measurement.unit),
          })
        })
      }
      if (annotation.style !== null && annotation.style !== undefined) {
        this.configuredRoiStyles[key] = formatRoiStyle(annotation.style)
      }
    })
    this.roiStyles = this.buildFindingRoiStyles()

    /** `undefined` lets DMV use its automatic (zoom-based) default */
    const { volumeViewer, labelViewer } = constructViewers({
      clients: this.props.clients,
      slide: this.props.slide,
      preload: this.props.preload,
      clusteringPixelSizeThreshold: undefined,
    })
    this.volumeViewer = volumeViewer
    this.labelViewer = labelViewer
    this.updateSlideGeometry()
    this.volumeViewportRef = React.createRef<HTMLDivElement>()

    /**
     * Deactivate all optical paths. Visibility will be set later, potentially
     * using based on available presentation state instances.
     */
    this.volumeViewer.getAllOpticalPaths().forEach((opticalPath) => {
      this.volumeViewer.deactivateOpticalPath(opticalPath.identifier)
    })

    const [offset, size] = this.volumeViewer.boundingBox

    this.state = {
      selectedRoiUIDs: new Set(),
      visibleRoiUIDs: new Set(),
      visibleSegmentUIDs: new Set(),
      visibleMappingUIDs: new Set(),
      visibleAnnotationGroupUIDs: new Set(),
      visibleOpticalPathIdentifiers: new Set(),
      activeOpticalPathIdentifiers: new Set(),
      presentationStates: [],
      selectedFinding: undefined,
      selectedEvaluations: [],
      generatedReport: undefined,
      isLoading: false,
      isAnnotationModalVisible: false,
      isSelectedRoiModalVisible: false,
      isReportModalVisible: false,
      isRoiDrawingActive: false,
      isRoiTranslationActive: false,
      isRoiModificationActive: false,
      isGoToModalVisible: false,
      goToInput: EMPTY_GO_TO_INPUT,
      validXCoordinateRange: [offset[0], offset[0] + size[0]],
      validYCoordinateRange: [offset[1], offset[1] + size[1]],
      areRoisHidden: false,
      selectedSeriesInstanceUID: undefined,
      selectedSegmentationSeriesInstanceUID: undefined,
      selectedPresentationStateUID: this.props.selectedPresentationStateUID,
      viewportLoadingPhase: INITIAL_VIEWPORT_LOADING_PHASE,
      isICCProfilesEnabled: true,
      isPaletteDisplayGammaCorrectionEnabled:
        volumeViewer.getPaletteDisplayGammaCorrectionEnabled(),
      isSegmentationInterpolationEnabled: false,
      isParametricMapInterpolationEnabled: true,
      customizedSegmentColors: {},
      clusteringThresholdInput: '',
      isClusteringEnabled: true,
      isRightPanelOpen: true,
      viewerGeneration: 0,
      isRoiRemovalConfirmVisible: false,
    }

    this.handlePointerMoveDebounced = debounce(this.handlePointerMoveEvent, 0, {
      leading: true,
      trailing: true,
    })
  }

  /**
   * Create a palette color lookup table for a segment.
   *
   * @param {number[]} segmentColor - RGB color triplet [r, g, b]
   * @param {dmv.viewer.VolumeImageViewer} viewer - Volume image viewer
   * @returns {color.PaletteColorLookupTable} Palette color lookup table
   * @private
   */
  private static readonly createSegmentPaletteColorLookupTable = (
    segmentColor: number[],
    applyDisplayGammaCorrection = true,
  ): dmv.color.PaletteColorLookupTable => {
    /** Create a simple palette with the segment color
     * For binary segments, we typically have 2 values: background (0) and segment (1) */
    const paletteData = [
      [0, 0, 0] /** Background (black/transparent) */,
      segmentColor /** Segment color */,
    ]

    return dmv.color.buildPaletteColorLookupTable({
      data: paletteData,
      firstValueMapped: 0,
      applyDisplayGammaCorrection,
    })
  }

  /** Recompute slide-derived values used by the overlays and footer. */
  private updateSlideGeometry(): void {
    this.slideAffine = slideAffineFromImages(this.props.slide.volumeImages)
    this.volumeSopInstanceUIDs = new Set(
      this.props.slide.volumeImages.map((image) => image.SOPInstanceUID),
    )
  }

  /** Per-finding styles: the configured style, else the preference style */
  private buildFindingRoiStyles(): {
    [key: string]: dmv.viewer.ROIStyleOptions
  } {
    const styles: { [key: string]: dmv.viewer.ROIStyleOptions } = {}
    this.findingOptions.forEach((finding) => {
      const key = buildKey(finding)
      styles[key] = this.configuredRoiStyles[key] ?? this.defaultRoiStyle
    })
    return styles
  }

  /** Style for a newly drawn ROI of `finding` (also used for the preview) */
  private getDrawStyle(
    finding: dcmjs.sr.coding.CodedConcept | undefined,
  ): dmv.viewer.ROIStyleOptions {
    if (finding === undefined) return this.defaultRoiStyle
    return this.configuredRoiStyles[buildKey(finding)] ?? this.defaultRoiStyle
  }

  private readonly handlePreferencesChanged = (): void => {
    this.preferences = loadPreferences()
  }

  /**
   * Push clustering settings to DMV. `setAnnotationOptions` treats an
   * undefined threshold as "clustering off", so automatic mode sends DMV's
   * construction default instead.
   */
  private applyClusteringOptions(
    isEnabled: boolean,
    rawThreshold: string,
  ): void {
    try {
      this.volumeViewer.setAnnotationOptions({
        clusteringPixelSizeThreshold: resolveClusteringThreshold(
          isEnabled,
          rawThreshold,
          DMV_DEFAULT_CLUSTERING_THRESHOLD_MM,
        ),
      })
    } catch (error) {
      logger.error('failed to update annotation options:', error)
    }
  }

  /**
   * Publish active series (image + visible derived data) to ActiveSeriesService
   * for use by the DICOM Tag Browser to show eye icons.
   */
  private publishActiveSeriesToService = (): void => {
    try {
      const activeImageSeriesUID = this.props.seriesInstanceUID ?? ''
      const derivedSet = new Set<string>()

      this.volumeViewer.getAllAnnotationGroups().forEach((ag) => {
        if (this.state.visibleAnnotationGroupUIDs.has(ag.uid)) {
          derivedSet.add(ag.seriesInstanceUID)
        }
      })
      this.volumeViewer.getAllSegments().forEach((segment) => {
        if (this.state.visibleSegmentUIDs.has(segment.uid)) {
          derivedSet.add(segment.seriesInstanceUID)
        }
      })
      this.volumeViewer.getAllParameterMappings().forEach((mapping) => {
        if (this.state.visibleMappingUIDs.has(mapping.uid)) {
          derivedSet.add(mapping.seriesInstanceUID)
        }
      })

      ActiveSeriesService.setActiveSeries(activeImageSeriesUID, derivedSet)
    } catch {
      /** volumeViewer may be in a transitional state */
    }
  }

  componentDidUpdate(
    previousProps: SlideViewerProps,
    _previousState: SlideViewerState,
  ): void {
    /** Fetch data and update the viewports if the route has changed (
     * i.e., if another series has been selected) or if the client has changed.
     */
    if (
      this.props.location.pathname !== previousProps.location.pathname ||
      this.props.studyInstanceUID !== previousProps.studyInstanceUID ||
      this.props.seriesInstanceUID !== previousProps.seriesInstanceUID ||
      this.props.slide !== previousProps.slide ||
      this.props.clients !== previousProps.clients
    ) {
      if (
        this.volumeViewportRef.current !== null &&
        this.volumeViewportRef.current !== undefined
      ) {
        this.volumeViewportRef.current.innerHTML = ''
      }
      this.volumeViewer.cleanup()
      if (this.labelViewer !== null && this.labelViewer !== undefined) {
        if (this.labelViewportNode !== null) {
          this.labelViewportNode.innerHTML = ''
        }
        this.labelViewer.cleanup()
      }
      this.renderedLabel = undefined
      this.resetViewerCaches()
      const { volumeViewer, labelViewer } = constructViewers({
        clients: this.props.clients,
        slide: this.props.slide,
        preload: this.props.preload,
        clusteringPixelSizeThreshold: resolveClusteringThreshold(
          true,
          this.state.clusteringThresholdInput,
        ),
      })
      this.volumeViewer = volumeViewer
      this.labelViewer = labelViewer
      this.updateSlideGeometry()
      if (!this.state.isClusteringEnabled) {
        this.applyClusteringOptions(false, this.state.clusteringThresholdInput)
      }
      this.volumeViewer.setPaletteDisplayGammaCorrectionEnabled(
        this.state.isPaletteDisplayGammaCorrectionEnabled,
      )

      const activeOpticalPathIdentifiers: Set<string> = new Set()
      const visibleOpticalPathIdentifiers: Set<string> = new Set()
      this.volumeViewer.getAllOpticalPaths().forEach((opticalPath) => {
        const identifier = opticalPath.identifier
        if (this.volumeViewer.isOpticalPathVisible(identifier)) {
          visibleOpticalPathIdentifiers.add(identifier)
        }
        if (this.volumeViewer.isOpticalPathActive(identifier)) {
          activeOpticalPathIdentifiers.add(identifier)
        }
      })

      const [offset, size] = this.volumeViewer.boundingBox

      this.setState((state) => ({
        viewerGeneration: state.viewerGeneration + 1,
        visibleRoiUIDs: new Set(),
        visibleSegmentUIDs: new Set(),
        visibleMappingUIDs: new Set(),
        visibleAnnotationGroupUIDs: new Set(),
        visibleOpticalPathIdentifiers,
        activeOpticalPathIdentifiers,
        presentationStates: [],
        viewportLoadingPhase: nextViewportLoadingPhase(
          state.viewportLoadingPhase,
          'reset',
        ),
        selectedSeriesInstanceUID: undefined,
        validXCoordinateRange: [offset[0], offset[0] + size[0]],
        validYCoordinateRange: [offset[1], offset[1] + size[1]],
        /**
         * A freshly constructed viewer always starts with ICC profiles
         * enabled; reset the flag so the settings switch stays in sync.
         */
        isICCProfilesEnabled: true,
      }))
      this.populateViewports()
    }

    this.publishActiveSeriesToService()
  }

  /** Drop per-viewer caches so a rebuilt viewer starts clean */
  private resetViewerCaches(): void {
    this.roiStyles = this.buildFindingRoiStyles()
    this.roiStylesByUid = {}
    this.defaultAnnotationStyles = {}
    this.annotationGroupMetadataCache = new Map()
    this.loadingFrames.clear()
    this.pixelDataStatistics = {}
    this.hoveredRois = []
    this.lastHoveredRoiSignature = null
    this.hoveredRoiTooltipStore.set(HIDDEN_HOVERED_ROI_TOOLTIP)
  }

  /**
   * Merge a presentation state into component state, replacing any previously
   * stored instance with the same SOP Instance UID.
   */
  private readonly upsertPresentationState = (
    presentationState: dmv.metadata.AdvancedBlendingPresentationState,
  ): void => {
    this.setState((state) => {
      const mapping: {
        [sopInstanceUID: string]: dmv.metadata.AdvancedBlendingPresentationState
      } = {}
      state.presentationStates.forEach((instance) => {
        mapping[instance.SOPInstanceUID] = instance
      })
      mapping[presentationState.SOPInstanceUID] = presentationState
      return { presentationStates: Object.values(mapping) }
    })
  }

  /**
   * Retrieve Presentation State instances that reference the any images of
   * the currently selected series.
   */
  loadPresentationStates = (): void => {
    logger.log('search for Presentation State instances')
    const client =
      this.props.clients[StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE]
    client
      .searchForInstances({
        studyInstanceUID: this.props.studyInstanceUID,
        queryParams: {
          Modality: 'PR',
        },
      })
      .then((matchedInstances: dwc.api.Instance[] | null): void => {
        if (matchedInstances === null || matchedInstances === undefined) {
          matchedInstances = []
        }
        matchedInstances.forEach(
          (rawInstance: dwc.api.Instance, index: number) => {
            const { dataset } = dmv.metadata.formatMetadata(rawInstance)
            const instance = dataset as dmv.metadata.Instance
            logger.log(`retrieve PR instance "${instance.SOPInstanceUID}"`)
            client
              .retrieveInstance({
                studyInstanceUID: this.props.studyInstanceUID,
                seriesInstanceUID: instance.SeriesInstanceUID,
                sopInstanceUID: instance.SOPInstanceUID,
              })
              .then((retrievedInstance: dwc.api.Dataset): void => {
                const data = dcmjs.data.DicomMessage.readFile(retrievedInstance)
                const { dataset } = dmv.metadata.formatMetadata(data.dict)
                if (this.props.slide.areVolumeImagesMonochrome) {
                  const presentationState =
                    dataset as unknown as dmv.metadata.AdvancedBlendingPresentationState
                  if (
                    referencesSlideSeries(
                      presentationState,
                      this.props.slide.seriesInstanceUIDs,
                    )
                  ) {
                    logger.log(
                      'include Advanced Blending Presentation State instance ' +
                        `"${presentationState.SOPInstanceUID}"`,
                    )
                    if (
                      shouldApplyPresentationState({
                        index,
                        sopInstanceUID: presentationState.SOPInstanceUID,
                        requestedUID: this.props.selectedPresentationStateUID,
                      })
                    ) {
                      this.setPresentationState(presentationState)
                    }
                    this.upsertPresentationState(presentationState)
                  }
                } else {
                  logger.log(
                    `ignore presentation state "${instance.SOPInstanceUID}", ` +
                      'application of presentation states for color images ' +
                      'has not (yet) been implemented',
                  )
                }
              })
              .catch((error) => {
                NotificationMiddleware.onError(
                  NotificationMiddlewareContext.SLIM,
                  new CustomError(
                    errorTypes.VISUALIZATION,
                    'Presentation State could not be loaded',
                  ),
                )
                logger.error(
                  'failed to load presentation state ' +
                    `of SOP instance "${instance.SOPInstanceUID}" ` +
                    `of series "${instance.SeriesInstanceUID}" ` +
                    `of study "${this.props.studyInstanceUID}": `,
                  error,
                )
              })
          },
        )
      })
      .catch((error) => {
        logger.error(error)
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Presentation State could not be loaded',
          ),
        )
      })
  }

  /**
   * Set presentation state as specified by a DICOM Presentation State instance.
   */
  setPresentationState = (
    presentationState: dmv.metadata.AdvancedBlendingPresentationState,
  ): void => {
    const opticalPaths = this.volumeViewer.getAllOpticalPaths()
    logger.log(
      `apply Presentation State instance "${presentationState.SOPInstanceUID}"`,
    )
    const opticalPathStyles: {
      [opticalPathIdentifier: string]: {
        opacity: number
        paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
        limitValues?: number[]
      } | null
    } = {}
    opticalPaths.forEach((opticalPath) => {
      const identifier = opticalPath.identifier
      this.volumeViewer.hideOpticalPath(identifier)
      this.volumeViewer.deactivateOpticalPath(identifier)
      const style = this.volumeViewer.getOpticalPathDefaultStyle(identifier)
      this.volumeViewer.setOpticalPathStyle(identifier, style)
    })

    const matchedItems = matchBlendingItems(
      opticalPaths,
      presentationState.AdvancedBlendingSequence,
    )
    matchedItems.forEach((blendingItem, identifier) => {
      let paletteColorLUT: dmv.color.PaletteColorLookupTable | undefined
      const cpLUTItem = blendingItem.PaletteColorLookupTableSequence?.[0]
      if (cpLUTItem !== undefined) {
        paletteColorLUT = new dmv.color.PaletteColorLookupTable({
          uid: cpLUTItem.PaletteColorLookupTableUID ?? '',
          redDescriptor: cpLUTItem.RedPaletteColorLookupTableDescriptor,
          greenDescriptor: cpLUTItem.GreenPaletteColorLookupTableDescriptor,
          blueDescriptor: cpLUTItem.BluePaletteColorLookupTableDescriptor,
          /**
           * Pass the LUT data through as retrieved. The element size of
           * Palette Color Lookup Table Data is governed by the third value of
           * the descriptor (bits per entry), not by the VR, so
           * dicom-microscopy-viewer reinterprets the bytes accordingly. In
           * particular, conformant Presentation States encode 8-bit entries
           * (descriptor [n, first, 8]) byte-packed inside the OW element;
           * eagerly wrapping in a Uint16Array here would halve the entry
           * count and break the LUT.
           */
          redData: cpLUTItem.RedPaletteColorLookupTableData ?? undefined,
          greenData: cpLUTItem.GreenPaletteColorLookupTableData ?? undefined,
          blueData: cpLUTItem.BluePaletteColorLookupTableData ?? undefined,
          redSegmentedData:
            cpLUTItem.SegmentedRedPaletteColorLookupTableData ?? undefined,
          greenSegmentedData:
            cpLUTItem.SegmentedGreenPaletteColorLookupTableData ?? undefined,
          blueSegmentedData:
            cpLUTItem.SegmentedBluePaletteColorLookupTableData ?? undefined,
        })
      }
      opticalPathStyles[identifier] = {
        opacity: 1,
        paletteColorLookupTable: paletteColorLUT,
        limitValues: windowLimitValues(blendingItem),
      }
    })

    const selectedOpticalPathIdentifiers: Set<string> = new Set()
    Object.keys(opticalPathStyles).forEach((identifier) => {
      const styleOptions = opticalPathStyles[identifier]
      if (styleOptions !== null) {
        this.volumeViewer.setOpticalPathStyle(identifier, styleOptions)
        this.volumeViewer.activateOpticalPath(identifier)
        this.volumeViewer.showOpticalPath(identifier)
        selectedOpticalPathIdentifiers.add(identifier)
      } else {
        this.volumeViewer.hideOpticalPath(identifier)
        this.volumeViewer.deactivateOpticalPath(identifier)
      }
    })
    const searchParams = new URLSearchParams(this.props.location.search)
    searchParams.set('state', presentationState.SOPInstanceUID)
    this.props.navigate(
      {
        pathname: this.props.location.pathname,
        search: searchParams.toString(),
      },
      { replace: true },
    )
    this.setState((_state) => ({
      activeOpticalPathIdentifiers: selectedOpticalPathIdentifiers,
      visibleOpticalPathIdentifiers: selectedOpticalPathIdentifiers,
      selectedPresentationStateUID: presentationState.SOPInstanceUID,
    }))
  }

  getRoiStyle = (key?: string): dmv.viewer.ROIStyleOptions => {
    if (key === null || key === undefined) {
      return this.defaultRoiStyle
    }
    if (this.roiStyles[key] !== undefined) {
      return this.roiStyles[key]
    }
    return this.defaultRoiStyle
  }

  /** An ROI's own style (drawn or recolored) wins over its finding's style. */
  getStyleForRoi = (roi: dmv.roi.ROI): dmv.viewer.ROIStyleOptions =>
    this.roiStylesByUid[roi.uid] ?? this.getRoiStyle(getRoiKey(roi))

  loadDerivedDataset = (derivedDataset: dmv.metadata.Dataset): void => {
    logger.debug('Loading derived dataset:', derivedDataset)

    const Comprehensive3DSR = StorageClasses.COMPREHENSIVE_3D_SR
    const ComprehensiveSR = StorageClasses.COMPREHENSIVE_SR
    const MicroscopyBulkSimpleAnnotation =
      StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION
    const Segmentation = StorageClasses.SEGMENTATION
    const LabelmapSegmentation = StorageClasses.LABELMAP_SEGMENTATION
    const ParametricMap = StorageClasses.PARAMETRIC_MAP
    const OpticalPath = StorageClasses.OPTICAL_PATH
    const AdvancedBlendingPresentationState =
      StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE
    const ColorSoftcopyPresentationState =
      StorageClasses.COLOR_SOFTCOPY_PRESENTATION_STATE
    const GrayscaleSoftcopyPresentationState =
      StorageClasses.GRAYSCALE_SOFTCOPY_PRESENTATION_STATE
    const PseudocolorSoftcopyPresentationState =
      StorageClasses.PSEUDOCOLOR_SOFTCOPY_PRESENTATION_STATE

    if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID ===
      Comprehensive3DSR
    ) {
      /**
       * ROIs carry no series UID, so show every ROI; addAnnotations already
       * kept only those in this frame of reference.
       */
      this.handleAnnotationVisibilityChanges(
        this.volumeViewer
          .getAllROIs()
          .map((roi) => ({ uid: roi.uid, isVisible: true })),
      )
      logger.debug('Loading Comprehensive 3D SR')
    } else if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID ===
      MicroscopyBulkSimpleAnnotation
    ) {
      const allAnnotationGroups = this.volumeViewer.getAllAnnotationGroups()
      const derivedSeriesInstanceUID = (
        derivedDataset as { SeriesInstanceUID: string }
      ).SeriesInstanceUID
      const matchingAnnotationGroups = allAnnotationGroups.filter(
        (annotationGroup) => {
          return annotationGroup.seriesInstanceUID === derivedSeriesInstanceUID
        },
      )
      logger.debug(
        `auto-load Microscopy Bulk Simple Annotation: found ` +
          `${matchingAnnotationGroups.length} matching annotation group(s) ` +
          `out of ${allAnnotationGroups.length} total ` +
          `for series "${derivedSeriesInstanceUID}"`,
      )
      /**
       * We bypass handleAnnotationGroupVisibilityChange because it re-throws
       * dmv errors after showing a notification, which aborts the forEach
       * and leaves only the first annotation group toggled when any
       * subsequent group throws. We also short-circuit the per-group
       * runValidations dialog (which is intended for manual user toggles,
       * not auto-load). We update state once at the end with all
       * successfully-shown UIDs to avoid any chance of intermediate
       * setState/re-render interleavings dropping updates.
       */
      const shownAnnotationGroupUIDs: string[] = []
      matchingAnnotationGroups.forEach((annotationGroup) => {
        try {
          this.volumeViewer.showAnnotationGroup(annotationGroup.uid)
          shownAnnotationGroupUIDs.push(annotationGroup.uid)
        } catch (error) {
          logger.error(
            `failed to auto-show annotation group "${annotationGroup.uid}":`,
            error,
          )
        }
      })
      logger.debug(
        `auto-load Microscopy Bulk Simple Annotation: showing ` +
          `${shownAnnotationGroupUIDs.length}/` +
          `${matchingAnnotationGroups.length} annotation group(s)`,
      )
      if (shownAnnotationGroupUIDs.length > 0) {
        this.setState((state) => {
          const visibleAnnotationGroupUIDs = new Set(
            state.visibleAnnotationGroupUIDs,
          )
          shownAnnotationGroupUIDs.forEach((uid) => {
            visibleAnnotationGroupUIDs.add(uid)
          })
          return { visibleAnnotationGroupUIDs }
        })
      }
      logger.debug('Loading Microscopy Bulk Simple Annotation')
    } else if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID ===
        Segmentation ||
      (derivedDataset as { SOPClassUID: string }).SOPClassUID ===
        LabelmapSegmentation
    ) {
      const allSegments = this.volumeViewer.getAllSegments()
      const derivedSeriesInstanceUID = (
        derivedDataset as { SeriesInstanceUID: string }
      ).SeriesInstanceUID
      const matchingSegments = allSegments.filter((segment) => {
        return segment.seriesInstanceUID === derivedSeriesInstanceUID
      })
      logger.debug(
        `auto-load Segmentation: found ` +
          `${matchingSegments.length} matching segment(s) ` +
          `out of ${allSegments.length} total ` +
          `for series "${derivedSeriesInstanceUID}"`,
      )
      /**
       * Bypass handleSegmentVisibilityChange so that a throw from dmv's
       * showSegment on any single segment does not abort the forEach and
       * leave subsequent segments hidden. We batch the state update at
       * the end with all successfully-shown UIDs.
       *
       * Skip background segments - they are identified by PixelPaddingValue
       * or Segmented Property Type (DCM, 125040, "Background"). Background
       * segments remain in the panel but are not auto-shown.
       */
      const shownSegmentUIDs: string[] = []
      matchingSegments.forEach((segment) => {
        if (segment.isAbsent) {
          logger.debug(
            `auto-load Segmentation: skipping absent segment "${segment.uid}"`,
          )
          return
        }
        if (segment.isBackground === true) {
          logger.debug(
            `skipping auto-show for background segment "${segment.uid}"`,
          )
          return
        }
        try {
          this.volumeViewer.showSegment(segment.uid)
          shownSegmentUIDs.push(segment.uid)
        } catch (error) {
          logger.error(`failed to auto-show segment "${segment.uid}":`, error)
        }
      })
      logger.debug(
        `auto-load Segmentation: showing ` +
          `${shownSegmentUIDs.length}/${matchingSegments.length} segment(s)`,
      )
      if (shownSegmentUIDs.length > 0) {
        this.setState((state) => {
          const visibleSegmentUIDs = new Set(state.visibleSegmentUIDs)
          shownSegmentUIDs.forEach((uid) => {
            visibleSegmentUIDs.add(uid)
          })
          return { visibleSegmentUIDs }
        })
      }
      logger.debug('Loading Segmentation')
    } else if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID === ParametricMap
    ) {
      const allParameterMappings = this.volumeViewer.getAllParameterMappings()
      const derivedSeriesInstanceUID = (
        derivedDataset as { SeriesInstanceUID: string }
      ).SeriesInstanceUID
      const matchingMappings = allParameterMappings.filter(
        (parameterMapping) => {
          return parameterMapping.seriesInstanceUID === derivedSeriesInstanceUID
        },
      )
      logger.debug(
        `auto-load Parametric Map: found ` +
          `${matchingMappings.length} matching mapping(s) ` +
          `out of ${allParameterMappings.length} total ` +
          `for series "${derivedSeriesInstanceUID}"`,
      )
      const shownMappingUIDs: string[] = []
      matchingMappings.forEach((parameterMapping) => {
        try {
          this.volumeViewer.showParameterMapping(parameterMapping.uid)
          shownMappingUIDs.push(parameterMapping.uid)
        } catch (error) {
          logger.error(
            `failed to auto-show parameter mapping "${parameterMapping.uid}":`,
            error,
          )
        }
      })
      logger.debug(
        `auto-load Parametric Map: showing ` +
          `${shownMappingUIDs.length}/${matchingMappings.length} mapping(s)`,
      )
      if (shownMappingUIDs.length > 0) {
        this.setState((state) => {
          const visibleMappingUIDs = new Set(state.visibleMappingUIDs)
          shownMappingUIDs.forEach((uid) => {
            visibleMappingUIDs.add(uid)
          })
          return { visibleMappingUIDs }
        })
      }
      logger.debug('Loading Parametric Map')
    } else if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID === OpticalPath
    ) {
      const allOpticalPaths = this.volumeViewer.getAllOpticalPaths()
      const derivedSeriesInstanceUID = (
        derivedDataset as { SeriesInstanceUID: string }
      ).SeriesInstanceUID
      const matchingOpticalPaths = allOpticalPaths.filter((opticalPath) => {
        return opticalPath.seriesInstanceUID === derivedSeriesInstanceUID
      })
      logger.debug(
        `auto-load Optical Path: found ` +
          `${matchingOpticalPaths.length} matching optical path(s) ` +
          `out of ${allOpticalPaths.length} total ` +
          `for series "${derivedSeriesInstanceUID}"`,
      )
      const shownOpticalPathIdentifiers: string[] = []
      matchingOpticalPaths.forEach((opticalPath) => {
        try {
          this.volumeViewer.showOpticalPath(opticalPath.identifier)
          shownOpticalPathIdentifiers.push(opticalPath.identifier)
        } catch (error) {
          logger.error(
            `failed to auto-show optical path "${opticalPath.identifier}":`,
            error,
          )
        }
      })
      logger.debug(
        `auto-load Optical Path: showing ` +
          `${shownOpticalPathIdentifiers.length}/` +
          `${matchingOpticalPaths.length} optical path(s)`,
      )
      if (shownOpticalPathIdentifiers.length > 0) {
        this.setState((state) => {
          const visibleOpticalPathIdentifiers = new Set(
            state.visibleOpticalPathIdentifiers,
          )
          shownOpticalPathIdentifiers.forEach((identifier) => {
            visibleOpticalPathIdentifiers.add(identifier)
          })
          return { visibleOpticalPathIdentifiers }
        })
      }
      logger.debug('Loading Optical Path')
    } else if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID ===
      ComprehensiveSR
    ) {
      logger.debug('TODO: Loading Comprehensive SR')
    } else if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID ===
      AdvancedBlendingPresentationState
    ) {
      logger.debug('TODO: Loading Advanced Blending Presentation State')
    } else if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID ===
      ColorSoftcopyPresentationState
    ) {
      logger.debug('TODO: Loading Color Softcopy Presentation State')
    } else if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID ===
      GrayscaleSoftcopyPresentationState
    ) {
      logger.debug('TODO: Loading Grayscale Softcopy Presentation State')
    } else if (
      (derivedDataset as { SOPClassUID: string }).SOPClassUID ===
      PseudocolorSoftcopyPresentationState
    ) {
      logger.debug('TODO: Loading Pseudocolor Softcopy Presentation State')
    }
  }

  /**
   * Parse a retrieved Comprehensive 3D SR instance and add the ROIs of a
   * suitable measurement report to the volume viewer. Returns whether the
   * report was accepted: ignored documents must not settle the promise in
   * addAnnotations (matching the pre-refactoring control flow, where the
   * early returns skipped resolve()).
   */
  private readonly addRetrievedSrRois = (
    retrievedInstance: dwc.api.Dataset,
  ): boolean => {
    const data = dcmjs.data.DicomMessage.readFile(retrievedInstance)
    const { dataset } = dmv.metadata.formatMetadata(data.dict)
    const report = dataset as unknown as dmv.metadata.Comprehensive3DSR
    /*
     * Perform a couple of checks to ensure the document content of the
     * report fullfils the requirements of the application.
     */
    if (!implementsTID1500(report)) {
      logger.debug(
        `ignore SR document "${report.SOPInstanceUID}" ` +
          'because it is not structured according to template ' +
          'TID 1500 "MeasurementReport"',
      )
      return false
    }
    if (!describesSpecimenSubject(report)) {
      logger.debug(
        `ignore SR document "${report.SOPInstanceUID}" ` +
          'because it does not describe a specimen subject',
      )
      return false
    }
    if (!containsROIAnnotations(report)) {
      logger.debug(
        `ignore SR document "${report.SOPInstanceUID}" ` +
          'because it does not contain any suitable ROI annotations',
      )
      return false
    }

    const content = new MeasurementReport(report)
    content.ROIs.forEach((roi) => {
      logger.log(`add ROI "${roi.uid}"`)
      const scoord3d = roi.scoord3d
      const image = this.props.slide.volumeImages[0]
      if (scoord3d.frameOfReferenceUID === image.FrameOfReferenceUID) {
        /*
         * ROIs may get assigned new UIDs upon re-rendering of the
         * page and we need to ensure that we don't add them twice.
         * The same ROI may be stored in multiple SR documents and
         * we don't want them to show up twice.
         * TODO: We should probably either "merge" measurements and
         * quantitative evaluations or pick the ROI from the "best"
         * available report (COMPLETE and VERIFIED).
         */
        const doesROIExist = this.volumeViewer
          .getAllROIs()
          .some((otherROI: dmv.roi.ROI): boolean => {
            return areROIsEqual(otherROI, roi)
          })
        if (!doesROIExist) {
          try {
            /** Added without style so that it stays hidden */
            this.volumeViewer.addROI(roi, {})
            this.registerRoiAnnotationStyle(roi)
          } catch {
            logger.error(`could not add ROI "${roi.uid}"`)
          }
        } else {
          logger.debug(`skip already existing ROI "${roi.uid}"`)
        }
      } else {
        logger.debug(
          `skip ROI "${roi.uid}" ` +
            `of SR document "${report.SOPInstanceUID}"` +
            'because it is defined in another frame of reference',
        )
      }
    })
    return true
  }

  /**
   * Retrieve Structured Report instances that contain regions of interests
   * with 3D spatial coordinates defined in the same frame of reference as the
   * currently selected series and add them to the VOLUME image viewer.
   */
  async addAnnotations(): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      logger.log('search for Comprehensive 3D SR instances')
      const client = this.props.clients[StorageClasses.COMPREHENSIVE_3D_SR]
      client
        .searchForInstances({
          studyInstanceUID: this.props.studyInstanceUID,
          queryParams: {
            Modality: 'SR',
          },
        })
        .then((matchedInstances): void => {
          if (matchedInstances === null || matchedInstances === undefined) {
            matchedInstances = []
          }
          if (matchedInstances.length === 0) {
            resolve()
            return
          }
          matchedInstances.forEach((i) => {
            const { dataset } = dmv.metadata.formatMetadata(i)
            const instance = dataset as dmv.metadata.Instance
            if (instance.SOPClassUID === StorageClasses.COMPREHENSIVE_3D_SR) {
              logger.log(`retrieve SR instance "${instance.SOPInstanceUID}"`)
              client
                .retrieveInstance({
                  studyInstanceUID: this.props.studyInstanceUID,
                  seriesInstanceUID: instance.SeriesInstanceUID,
                  sopInstanceUID: instance.SOPInstanceUID,
                })
                .then((retrievedInstance): void => {
                  if (this.addRetrievedSrRois(retrievedInstance)) {
                    resolve()
                  }
                })
                .catch((error) => {
                  NotificationMiddleware.onError(
                    NotificationMiddlewareContext.SLIM,
                    new CustomError(
                      errorTypes.VISUALIZATION,
                      'Annotations could not be loaded',
                    ),
                  )
                  logger.error(
                    'failed to load ROIs ' +
                      `of SOP instance "${instance.SOPInstanceUID}" ` +
                      `of series "${instance.SeriesInstanceUID}" ` +
                      `of study "${this.props.studyInstanceUID}": `,
                    error,
                  )
                })
              /*
               * React is not aware of the fact that ROIs have been added via the
               * viewer (the viewport is a ref object) and won't show the
               * annotations in the user interface unless an update is forced.
               */
              this.forceUpdate()
            }
          })
        })
        .catch((error) => {
          logger.error(error)
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.SLIM,
            new CustomError(
              errorTypes.VISUALIZATION,
              'Annotations could not be loaded',
            ),
          )
          reject(
            error instanceof Error
              ? error
              : new Error(String(error as unknown)),
          )
        })
    })
  }

  /**
   * Add retrieved Microscopy Bulk Simple Annotations metadata to the volume
   * viewer and apply configured styles per annotation group.
   */
  private readonly addRetrievedAnnotationGroups = (
    retrievedMetadata: dwc.api.Metadata[],
  ): void => {
    const annotations: dmv.metadata.MicroscopyBulkSimpleAnnotations[] =
      retrievedMetadata.map((metadata) => {
        return new dmv.metadata.MicroscopyBulkSimpleAnnotations({
          metadata,
        })
      })
    annotations.forEach((ann) => {
      try {
        this.volumeViewer.addAnnotationGroups(ann)
      } catch (error: unknown) {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Microscopy Bulk Simple Annotations cannot be displayed.',
          ),
        )
        logger.error('failed to add annotation groups:', error)
      }
      ann.AnnotationGroupSequence.forEach((item) => {
        const annotationGroupUID = item.AnnotationGroupUID
        const finding = item.AnnotationPropertyTypeCodeSequence[0]
        const key = buildKey(finding)
        const style = this.roiStyles[key]
        if (
          style !== null &&
          style !== undefined &&
          style.fill !== null &&
          style.fill !== undefined
        ) {
          this.volumeViewer.setAnnotationGroupStyle(annotationGroupUID, {
            color: style.fill.color,
          })
        }
      })
    })
    /*
     * React is not aware of the fact that annotation groups have been
     * added via the viewer (the underlying HTML viewport element is a
     * ref object) and won't show the annotation groups in the user
     * interface unless an update is forced.
     */
    this.forceUpdate()
  }

  /**
   * Retrieve Microscopy Bulk Simple Annotations instances that contain
   * annotation groups defined in the same frame of reference as the currently
   * selected series and add them to the VOLUME image viewer.
   */
  addAnnotationGroups = async (): Promise<void> => {
    return await new Promise<void>((resolve, reject) => {
      logger.log('search for Microscopy Bulk Simple Annotations instances')
      const client =
        this.props.clients[StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION]
      client
        .searchForSeries({
          studyInstanceUID: this.props.studyInstanceUID,
          queryParams: {
            Modality: 'ANN',
          },
        })
        .then((matchedSeries): void => {
          if (matchedSeries === null || matchedSeries === undefined) {
            matchedSeries = []
          }
          if (matchedSeries.length === 0) {
            resolve()
            return
          }
          /**
           * Wait for every per-series retrieval to settle before resolving.
           * Previously resolve() fired inside the per-series success path,
           * so the outer Promise settled on whichever ANN series finished
           * first, racing siblings in the same study and causing
           * loadDerivedDataset to run before the URL-targeted ANN series
           * had been added to the viewer.
           */
          let pendingSeriesCount = matchedSeries.length
          const finishOne = (): void => {
            pendingSeriesCount -= 1
            if (pendingSeriesCount === 0) {
              resolve()
            }
          }
          matchedSeries.forEach((s) => {
            const { dataset } = dmv.metadata.formatMetadata(s)
            const series = dataset as dmv.metadata.Series
            client
              .retrieveSeriesMetadata({
                studyInstanceUID: this.props.studyInstanceUID,
                seriesInstanceUID: series.SeriesInstanceUID,
              })
              .then((retrievedMetadata): void => {
                this.addRetrievedAnnotationGroups(retrievedMetadata)
                finishOne()
              })
              .catch((error) => {
                logger.error(error)
                NotificationMiddleware.onError(
                  NotificationMiddlewareContext.SLIM,
                  new CustomError(
                    errorTypes.VISUALIZATION,
                    'Retrieval of metadata of Microscopy Bulk Simple Annotations ' +
                      'instances failed.',
                  ),
                )
                finishOne()
              })
          })
        })
        .catch((error) => {
          logger.error(error)
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.SLIM,
            new CustomError(
              errorTypes.VISUALIZATION,
              'Search for Microscopy Bulk Simple Annotations instances failed.',
            ),
          )
          reject(
            error instanceof Error
              ? error
              : new Error(String(error as unknown)),
          )
        })
    })
  }

  /**
   * Retrieve Segmentation instances that contain segments defined in the same
   * frame of reference as the currently selected series and add them to the
   * VOLUME image viewer.
   */
  /**
   * Add retrieved Segmentation metadata matching the current slide's frame of
   * reference and container to the volume viewer.
   */
  private readonly addRetrievedSegmentations = (
    retrievedMetadata: dwc.api.Metadata[],
  ): void => {
    const segmentations: dmv.metadata.Segmentation[] = []
    retrievedMetadata.forEach((metadata) => {
      const seg = new dmv.metadata.Segmentation({ metadata })
      const refImage = this.props.slide.volumeImages[0]
      if (
        seg.FrameOfReferenceUID === refImage.FrameOfReferenceUID &&
        seg.ContainerIdentifier === refImage.ContainerIdentifier
      ) {
        segmentations.push(seg)
      }
    })
    if (segmentations.length > 0) {
      try {
        this.volumeViewer.addSegments(segmentations)
        applyDistinctFractionalSegmentPalettes(this.volumeViewer)
      } catch (error: unknown) {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Segmentations cannot be displayed',
          ),
        )
        logger.error('failed to add segments: ', error)
      }
      /*
       * React is not aware of the fact that segments have been added via
       * the viewer (the underlying HTML viewport element is a ref object)
       * and won't show the segments in the user interface unless an update
       * is forced.
       */
      this.forceUpdate()
    }
  }

  addSegmentations = async (): Promise<void> => {
    return await new Promise<void>((resolve, reject) => {
      logger.log('search for Segmentation instances')
      const client = this.props.clients[StorageClasses.SEGMENTATION]
      client
        .searchForSeries({
          studyInstanceUID: this.props.studyInstanceUID,
          queryParams: {
            Modality: 'SEG',
          },
        })
        .then((matchedSeries): void => {
          if (matchedSeries === null || matchedSeries === undefined) {
            matchedSeries = []
          }
          if (matchedSeries.length === 0) {
            resolve()
            return
          }
          /**
           * Wait for every per-series retrieval to settle before resolving.
           * Previously resolve() fired inside the per-series success path,
           * so the outer Promise settled on whichever SEG series finished
           * first, racing siblings in the same study and causing
           * loadDerivedDataset to run before the URL-targeted SEG series
           * had been added to the viewer (observed as
           * "auto-load Segmentation: found 0 matching segment(s) out of 1
           * total" when the URL points to a SEG that hadn't loaded yet).
           */
          let pendingSeriesCount = matchedSeries.length
          const finishOne = (): void => {
            pendingSeriesCount -= 1
            if (pendingSeriesCount === 0) {
              resolve()
            }
          }
          matchedSeries.forEach((s, _i) => {
            const { dataset } = dmv.metadata.formatMetadata(s)
            const series = dataset as dmv.metadata.Series
            client
              .retrieveSeriesMetadata({
                studyInstanceUID: this.props.studyInstanceUID,
                seriesInstanceUID: series.SeriesInstanceUID,
              })
              .then((retrievedMetadata): void => {
                this.addRetrievedSegmentations(retrievedMetadata)
                finishOne()
              })
              .catch((error) => {
                logger.error(error)
                NotificationMiddleware.onError(
                  NotificationMiddlewareContext.SLIM,
                  new CustomError(
                    errorTypes.VISUALIZATION,
                    'Retrieval of metadata of Segmentation instances failed.',
                  ),
                )
                finishOne()
              })
          })
        })
        .catch((error) => {
          logger.error(error)
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.SLIM,
            new CustomError(
              errorTypes.VISUALIZATION,
              'Search for Segmentation instances failed.',
            ),
          )
          reject(
            error instanceof Error
              ? error
              : new Error(String(error as unknown)),
          )
        })
    })
  }

  /**
   * Retrieve Parametric Map instances that contain mappings defined in the same
   * frame of reference as the currently selected series and add them to the
   * VOLUME image viewer.
   */
  /**
   * Add retrieved Parametric Map metadata matching the current slide's frame
   * of reference and container to the volume viewer.
   */
  private readonly addRetrievedParametricMaps = (
    retrievedMetadata: dwc.api.Metadata[],
  ): void => {
    const parametricMaps: dmv.metadata.ParametricMap[] = []
    retrievedMetadata.forEach((metadata) => {
      const pm = new dmv.metadata.ParametricMap({ metadata })
      const refImage = this.props.slide.volumeImages[0]
      if (
        pm.FrameOfReferenceUID === refImage.FrameOfReferenceUID &&
        pm.ContainerIdentifier === refImage.ContainerIdentifier
      ) {
        parametricMaps.push(pm)
      } else {
        /** console.warn (not logger) so the header notifications list it */
        console.warn(`skip Parametric Map instance "${pm.SOPInstanceUID}"`)
      }
    })
    if (parametricMaps.length > 0) {
      try {
        this.volumeViewer.addParameterMappings(parametricMaps)
        applyDistinctParametricMapPalettes(this.volumeViewer)
      } catch (error: unknown) {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Parametric Map cannot be displayed',
          ),
        )
        logger.error('failed to add mappings: ', error)
      }
      /*
       * React is not aware of the fact that mappings have been added via
       * the viewer (the underlying HTML viewport element is a ref object)
       * and won't show the mappings in the user interface unless an update
       * is forced.
       */
      this.forceUpdate()
    }
  }

  addParametricMaps = async (): Promise<void> => {
    return await new Promise<void>((resolve, reject) => {
      logger.log('search for Parametric Map instances')
      const client = this.props.clients[StorageClasses.PARAMETRIC_MAP]
      client
        .searchForSeries({
          studyInstanceUID: this.props.studyInstanceUID,
          queryParams: {
            Modality: 'OT',
          },
        })
        .then((matchedSeries): void => {
          if (matchedSeries === null || matchedSeries === undefined) {
            matchedSeries = []
          }
          if (matchedSeries.length === 0) {
            resolve()
            return
          }
          /**
           * Wait for every per-series retrieval to settle before resolving.
           * Previously resolve() fired inside the per-series success path,
           * so the outer Promise settled on whichever PM series finished
           * first, racing siblings in the same study and causing
           * loadDerivedDataset to run before the URL-targeted PM series
           * had been added to the viewer.
           */
          let pendingSeriesCount = matchedSeries.length
          const finishOne = (): void => {
            pendingSeriesCount -= 1
            if (pendingSeriesCount === 0) {
              resolve()
            }
          }
          matchedSeries.forEach((s) => {
            const { dataset } = dmv.metadata.formatMetadata(s)
            const series = dataset as dmv.metadata.Series
            client
              .retrieveSeriesMetadata({
                studyInstanceUID: this.props.studyInstanceUID,
                seriesInstanceUID: series.SeriesInstanceUID,
              })
              .then((retrievedMetadata): void => {
                this.addRetrievedParametricMaps(retrievedMetadata)
                finishOne()
              })
              .catch((error) => {
                logger.error(error)
                NotificationMiddleware.onError(
                  NotificationMiddlewareContext.SLIM,
                  new CustomError(
                    errorTypes.VISUALIZATION,
                    'Retrieval of metadata of Parametric Map instances failed.',
                  ),
                )
                finishOne()
              })
          })
        })
        .catch((error) => {
          logger.error(error)
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.SLIM,
            new CustomError(
              errorTypes.VISUALIZATION,
              'Search for Parametric Map instances failed.',
            ),
          )
          reject(
            error instanceof Error
              ? error
              : new Error(String(error as unknown)),
          )
        })
    })
  }

  /**
   * Populate viewports of the VOLUME and LABEL image viewers.
   */
  populateViewports = (): void => {
    logger.log('populate viewports...')
    this.setState({
      isLoading: true,
      presentationStates: [],
    })

    if (this.volumeViewportRef.current !== null) {
      this.volumeViewer.render({ container: this.volumeViewportRef.current })
      this.stopOverviewMapClamp?.()
      this.stopOverviewMapClamp = observeOverviewMapClamp(
        this.volumeViewportRef.current,
        { volumeViewer: this.volumeViewer },
      )
    }
    this.renderLabelViewer()

    this.setState({ isLoading: false })

    this.setDefaultPresentationState()
    this.loadPresentationStates()

    Promise.allSettled([
      this.addAnnotations(),
      this.addAnnotationGroups(),
      this.addSegmentations(),
      this.addParametricMaps(),
    ])
      .then(() => {
        logger.debug(
          'Loaded annotations, annotation groups, segmentations, and parametric maps!',
        )
        if (
          this.props.derivedDataset !== null &&
          this.props.derivedDataset !== undefined
        ) {
          this.loadDerivedDataset(this.props.derivedDataset)
        }
      })
      .catch((error) => {
        logger.error('Failed to add derived data:', error)
      })
  }

  /**
   * Render the label viewer into the sidebar slot once both exist. The slot
   * mounts after the viewer is constructed, so this runs from the ref
   * callback as well as after (re)construction.
   */
  private renderLabelViewer(): void {
    const viewer = this.labelViewer
    const node = this.labelViewportNode
    if (viewer === undefined || node === null) return
    if (
      this.renderedLabel?.viewer === viewer &&
      this.renderedLabel.node === node
    )
      return
    viewer.render({ container: node })
    this.renderedLabel = { viewer, node }
  }

  private readonly setLabelViewport = (node: HTMLDivElement | null): void => {
    this.labelViewportNode = node
    if (node === null) {
      this.renderedLabel = undefined
      return
    }
    this.renderLabelViewer()
  }

  onRoiModified = (): void => {
    /** New Set identity re-renders the annotation list */
    this.setState((state) => ({
      visibleRoiUIDs: new Set(state.visibleRoiUIDs),
    }))
  }

  onViewportResize = (): void => {
    this.volumeViewer.resize()
    if (this.labelViewer !== null && this.labelViewer !== undefined) {
      this.labelViewer.resize()
    }
    if (this.volumeViewportRef.current !== null) {
      clampOverviewMapInViewport(this.volumeViewportRef.current, {
        volumeViewer: this.volumeViewer,
      })
    }
  }

  onRoiDrawn = (
    roi: DmvEventPayload<'dicommicroscopyviewer_roi_drawn'>,
  ): void => {
    const selectedFinding = this.state.selectedFinding
    const selectedEvaluations = this.state.selectedEvaluations
    if (roi !== undefined && selectedFinding !== undefined) {
      logger.debug(`add ROI "${roi.uid}"`)
      const findingItem = new dcmjs.sr.valueTypes.CodeContentItem({
        name: new dcmjs.sr.coding.CodedConcept({
          value: '121071',
          meaning: 'Finding',
          schemeDesignator: 'DCM',
        }),
        value: selectedFinding,
        relationshipType: 'CONTAINS',
      })
      roi.addEvaluation(findingItem)
      selectedEvaluations.forEach((evaluation: Evaluation) => {
        const item = new dcmjs.sr.valueTypes.CodeContentItem({
          name: evaluation.name,
          value: evaluation.value,
          relationshipType: 'CONTAINS',
        })
        roi.addEvaluation(item)
      })
      this.addStyledRoi(roi, this.getDrawStyle(selectedFinding))
    } else {
      logger.debug(`could not add ROI "${roi?.uid}"`)
    }
  }

  /**
   * Add a user-created ROI and show it. Only a style that differs from its
   * finding's configured style is recorded per ROI.
   */
  private addStyledRoi(
    roi: dmv.roi.ROI,
    style: dmv.viewer.ROIStyleOptions,
  ): void {
    const key = getRoiKey(roi)
    if (key === undefined || this.configuredRoiStyles[key] !== style) {
      this.roiStylesByUid[roi.uid] = style
    }
    this.volumeViewer.addROI(roi, style)
    this.registerRoiAnnotationStyle(roi, key)
    this.setState((state) => ({
      visibleRoiUIDs: new Set(state.visibleRoiUIDs).add(roi.uid),
    }))
  }

  onRoiDoubleClicked = (
    selectedRoi: DmvEventPayload<'dicommicroscopyviewer_roi_double_clicked'>,
  ): void => {
    if (selectedRoi !== null && selectedRoi !== undefined) {
      const roiUid = selectedRoi.uid
      const allAnnotationGroups = this.volumeViewer.getAllAnnotationGroups()
      const isBulkAnnotation = allAnnotationGroups.some((annotationGroup) =>
        roiUid?.startsWith(`${String(annotationGroup.uid)}-`),
      )
      /** Bulk annotations have no ROI details to show */
      if (isBulkAnnotation) {
        return
      }

      this.setState({
        selectedRoi,
        isSelectedRoiModalVisible: true,
      })
    } else {
      this.setState({
        selectedRoi: undefined,
        isSelectedRoiModalVisible: false,
      })
    }
  }

  /** Tooltip row for a hovered ROI or bulk annotation */
  private describeHoveredFeature(
    { roi, annotationGroupUID }: HoveredFeature<dmv.roi.ROI>,
    rois: readonly dmv.roi.ROI[],
  ): HoveredRoi {
    if (annotationGroupUID !== null) {
      try {
        let metadata = this.annotationGroupMetadataCache.get(annotationGroupUID)
        if (metadata === undefined) {
          metadata =
            this.volumeViewer.getAnnotationGroupMetadata(annotationGroupUID)
          this.annotationGroupMetadataCache.set(annotationGroupUID, metadata)
        }
        const item = metadata.AnnotationGroupSequence.find(
          (group) => group.AnnotationGroupUID === annotationGroupUID,
        )
        if (item !== undefined) {
          const seriesUID = metadata.SeriesInstanceUID
          return describeBulkAnnotation({
            roiUid: roi.uid,
            item,
            seriesDescription:
              seriesUID !== undefined && seriesUID !== null
                ? this.getSeriesDescription(seriesUID)
                : '',
          })
        }
      } catch (error) {
        logger.warn(
          `Failed to get annotation group metadata for ${annotationGroupUID}:`,
          error,
        )
      }
    }
    if (rois.length === 0) {
      return {
        index: 0,
        roiUid: roi.uid,
        attributes: [],
        seriesDescription: '',
      }
    }
    return {
      index: rois.findIndex((r) => r.uid === roi.uid) + 1,
      roiUid: roi.uid,
      attributes: describeEvaluations(roi.evaluations),
      seriesDescription: '',
    }
  }

  private describeHoveredFeatures(
    features: ReadonlyArray<HoveredFeature<dmv.roi.ROI>>,
  ): HoveredRoi[] {
    const rois = this.volumeViewer.getAllROIs()
    return features
      .map((feature) => this.describeHoveredFeature(feature, rois))
      .sort(compareHoveredRois)
  }

  isSamePixelAsLast = (event: MouseEvent): boolean => {
    return (
      event.clientX === this.lastPixel[0] && event.clientY === this.lastPixel[1]
    )
  }

  onPointerMove = (payload: PointerMovePayload): void => {
    this.handlePointerMoveDebounced(payload)
  }

  handlePointerMoveEvent = (payload: PointerMovePayload): void => {
    const originalEvent = payload.event.originalEvent

    if (!this.isSamePixelAsLast(originalEvent)) {
      this.lastPixel = [originalEvent.clientX, originalEvent.clientY]
      this.hoveredRois = []
    }

    const features: Array<HoveredFeature<dmv.roi.ROI>> = []
    for (const item of payload.features ?? []) {
      if (item.feature !== null && item.feature !== undefined) {
        features.push({
          roi: item.feature,
          annotationGroupUID: item.annotationGroupUID ?? null,
        })
      }
    }
    this.hoveredRois = visibleHoveredFeatures(
      features,
      this.state.visibleRoiUIDs,
      this.state.visibleAnnotationGroupUIDs,
    )

    if (this.hoveredRois.length === 0) {
      this.lastHoveredRoiSignature = null
      this.hoveredRoiTooltipStore.update((tooltip) =>
        tooltip.isVisible ? { ...tooltip, isVisible: false } : tooltip,
      )
      return
    }

    const signature = hoveredFeaturesSignature(this.hoveredRois)
    const position = { x: originalEvent.clientX, y: originalEvent.clientY }
    const tooltip = this.hoveredRoiTooltipStore.getSnapshot()
    if (this.lastHoveredRoiSignature === signature && tooltip.isVisible) {
      this.hoveredRoiTooltipStore.set({ ...tooltip, ...position })
      return
    }
    this.lastHoveredRoiSignature = signature
    this.hoveredRoiTooltipStore.set({
      isVisible: true,
      ...position,
      rois: this.describeHoveredFeatures(this.hoveredRois),
    })
  }

  getUpdatedSelectedRois = (
    newSelectedRoiUid?: string,
  ): { selectedRoiUIDs: Set<string>; selectedRoi?: dmv.roi.ROI } => {
    const selectedRoiUid = newSelectedRoiUid
    const emptySelection = {
      selectedRoiUIDs: new Set<string>(),
      selectedRoi: undefined,
    }

    if (selectedRoiUid === undefined) {
      return emptySelection
    }

    const selectedRoi = this.volumeViewer.getROI(selectedRoiUid)
    if (selectedRoi === undefined) {
      return emptySelection
    }

    logger.debug(`selected ROI "${selectedRoi.uid}"`)

    return {
      selectedRoiUIDs: nextSelectedRoiUIDs(
        this.state.selectedRoiUIDs,
        selectedRoi.uid,
        this.keysDown.has('Shift'),
      ),
      selectedRoi,
    }
  }

  resetUnselectedRoiStyles = (selectionState: {
    selectedRoiUIDs: Set<string>
  }): void => {
    this.volumeViewer.getAllROIs().forEach((roi) => {
      const uid = roi.uid
      if (
        selectionState.selectedRoiUIDs.has(uid) ||
        !this.state.visibleRoiUIDs.has(uid)
      ) {
        return
      }
      this.volumeViewer.setROIStyle(uid, this.getStyleForRoi(roi))
    })
  }

  onMapClicked = (
    payload: DmvEventPayload<'dicommicroscopyviewer_viewport_clicked'>,
  ): void => {
    const roisClicked = payload?.rois ?? []
    if (roisClicked.length !== 0) {
      return
    }

    const updatedSelectedRois = this.getUpdatedSelectedRois()
    this.setState(updatedSelectedRois)
    this.volumeViewer.clearSelections()
    this.resetUnselectedRoiStyles(updatedSelectedRois)
  }

  onRoiSelected = (
    payload: DmvEventPayload<'dicommicroscopyviewer_roi_selected'>,
  ): void => {
    if (
      payload !== null &&
      payload !== undefined &&
      'uid' in payload &&
      'scoord3d' in payload
    ) {
      const selectedRoi = payload
      const updatedSelectedRois = !this.keysDown.has('Shift')
        ? {
            selectedRoiUIDs: new Set([selectedRoi.uid]),
            selectedRoi,
          }
        : {
            selectedRoiUIDs: new Set([
              ...Array.from(this.state.selectedRoiUIDs),
              selectedRoi.uid,
            ]),
            selectedRoi,
          }
      this.setState(updatedSelectedRois)
      this.resetUnselectedRoiStyles(updatedSelectedRois)
    } else {
      const updatedSelectedRois = this.getUpdatedSelectedRois(payload?.uid)
      this.setState(updatedSelectedRois)
      this.resetUnselectedRoiStyles(updatedSelectedRois)
    }
  }

  handleAnnotationSelection = (uid: string): void => {
    this.volumeViewer.clearSelections()
    const updatedSelectedRois = this.getUpdatedSelectedRois(uid)
    const selectedVisibleUIDs: string[] = []
    this.volumeViewer.getAllROIs().forEach((roi) => {
      let style = {}
      if (updatedSelectedRois.selectedRoiUIDs.has(roi.uid)) {
        style = this.selectedRoiStyle
        selectedVisibleUIDs.push(roi.uid)
      } else if (this.state.visibleRoiUIDs.has(roi.uid)) {
        style = this.getStyleForRoi(roi)
      }
      this.volumeViewer.setROIStyle(roi.uid, style)
    })
    this.setState((state) => ({
      ...updatedSelectedRois,
      visibleRoiUIDs: selectedVisibleUIDs.every((roiUID) =>
        state.visibleRoiUIDs.has(roiUID),
      )
        ? state.visibleRoiUIDs
        : new Set([...state.visibleRoiUIDs, ...selectedVisibleUIDs]),
    }))
  }

  handleRoiSelectionCancellation = (): void => {
    logger.log('cancel ROI selection')
    this.setState({
      isSelectedRoiModalVisible: false,
    })
  }

  /**
   * Keep the side-panel segment switch in sync when the overlay's visibility
   * is toggled from the in-viewport legend (dicom-microscopy-viewer already
   * applied the change, so we only mirror it into component state).
   */
  onSegmentVisibilityChanged = (
    payload: DmvEventPayload<'dicommicroscopyviewer_segment_visibility_changed'>,
  ): void => {
    if (payload?.segmentUID == null || payload.isVisible == null) {
      return
    }
    const { segmentUID, isVisible } = payload
    this.setState((state) => {
      const visibleSegmentUIDs = new Set(state.visibleSegmentUIDs)
      if (isVisible) {
        visibleSegmentUIDs.add(segmentUID)
      } else {
        visibleSegmentUIDs.delete(segmentUID)
      }
      return { visibleSegmentUIDs }
    })
  }

  /**
   * Keep the side-panel mapping switch in sync when the overlay's visibility
   * is toggled from the in-viewport legend.
   */
  onMappingVisibilityChanged = (
    payload: DmvEventPayload<'dicommicroscopyviewer_parameter_mapping_visibility_changed'>,
  ): void => {
    if (payload?.mappingUID == null || payload.isVisible == null) {
      return
    }
    const { mappingUID, isVisible } = payload
    this.setState((state) => {
      const visibleMappingUIDs = new Set(state.visibleMappingUIDs)
      if (isVisible) {
        visibleMappingUIDs.add(mappingUID)
      } else {
        visibleMappingUIDs.delete(mappingUID)
      }
      return { visibleMappingUIDs }
    })
  }

  private readonly advanceViewportLoading = (
    event: ViewportLoadingEvent,
  ): void => {
    this.setState((state) => {
      const viewportLoadingPhase = nextViewportLoadingPhase(
        state.viewportLoadingPhase,
        event,
      )
      return viewportLoadingPhase === state.viewportLoadingPhase
        ? null
        : { viewportLoadingPhase }
    })
  }

  onLoadingStarted = (): void => {
    this.setState({ isLoading: true })
    this.advanceViewportLoading('started')
  }

  onLoadingEnded = (): void => {
    this.setState({ isLoading: false })
    this.advanceViewportLoading('ended')
  }

  onFrameLoadingStarted = (
    frameInfo: DmvEventPayload<'dicommicroscopyviewer_frame_loading_started'>,
  ): void => {
    this.loadingFrames.add(
      `${frameInfo.sopInstanceUID}-${frameInfo.frameNumber}`,
    )
  }

  onFrameLoadingError = (): void => {
    logger.error('Failed to load frame')
  }

  onLoadingError = (
    error: DmvEventPayload<'dicommicroscopyviewer_loading_error'>,
  ): void => {
    const message = error?.message ?? 'Failed to load data'
    logger.error(message)
    this.advanceViewportLoading('failed')
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(errorTypes.VISUALIZATION, message),
    )
  }

  onFrameLoadingEnded = (
    frameInfo: DmvEventPayload<'dicommicroscopyviewer_frame_loading_ended'>,
  ): void => {
    this.loadingFrames.delete(
      `${frameInfo.sopInstanceUID}-${frameInfo.frameNumber}`,
    )
    const isLoading = this.loadingFrames.size > 0
    this.setState((state) => {
      const viewportLoadingPhase = isLoading
        ? state.viewportLoadingPhase
        : nextViewportLoadingPhase(state.viewportLoadingPhase, 'ended')
      if (
        state.isLoading === isLoading &&
        state.viewportLoadingPhase === viewportLoadingPhase
      ) {
        return null
      }
      return { isLoading, viewportLoadingPhase }
    })
    if (
      frameInfo.sopClassUID ===
        StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE &&
      this.props.slide.areVolumeImagesMonochrome
    ) {
      this.samplePixelStatistics(
        frameInfo.channelIdentifier,
        frameInfo.pixelArray,
      )
    }
  }

  /**
   * Derive default window limits for an optical path from its first loaded
   * frame, unless a presentation state controls the display.
   */
  private samplePixelStatistics(
    opticalPathIdentifier: string,
    pixelArray: ArrayLike<number> | null | undefined,
  ): void {
    if (
      opticalPathIdentifier in this.pixelDataStatistics ||
      pixelArray === null ||
      pixelArray === undefined
    ) {
      return
    }
    const range = computePixelRange(pixelArray)
    if (range === undefined) return
    const stats = mergePixelStatistics(
      this.pixelDataStatistics[opticalPathIdentifier],
      range,
    )
    this.pixelDataStatistics = {
      ...this.pixelDataStatistics,
      [opticalPathIdentifier]: stats,
    }
    if (this.state.selectedPresentationStateUID === null) {
      this.volumeViewer.setOpticalPathStyle(opticalPathIdentifier, {
        ...this.volumeViewer.getOpticalPathStyle(opticalPathIdentifier),
        limitValues: [stats.min, stats.max],
      })
    }
  }

  onRoiRemoved = (
    roi: DmvEventPayload<'dicommicroscopyviewer_roi_removed'>,
  ): void => {
    logger.debug(`removed ROI "${roi?.uid}"`)
  }

  /** Release listeners and viewers; safe to call more than once. */
  componentCleanup = (): void => {
    if (this.unsubscribeEvents === undefined) return
    this.unsubscribeEvents()
    this.unsubscribeEvents = undefined
    this.handlePointerMoveDebounced.cancel()

    this.stopOverviewMapClamp?.()
    this.stopOverviewMapClamp = undefined

    this.volumeViewer.cleanup()
    if (this.labelViewer !== null && this.labelViewer !== undefined) {
      this.labelViewer.cleanup()
    }
  }

  onKeyDown = (event: KeyboardEvent): void => {
    this.keysDown.add(event.key)
  }

  onKeyUp = (event: KeyboardEvent): void => {
    this.keysDown.delete(event.key)
    switch (shortcutForKeyEvent(event)) {
      case 'cancel':
        this.cancelActiveInteraction()
        break
      case 'draw':
        this.handleRoiDrawing()
        break
      case 'modify':
        this.handleRoiModification()
        break
      case 'translate':
        this.handleRoiTranslation()
        break
      case 'remove':
        this.handleRoiRemoval()
        break
      case 'toggleRoiVisibility':
        this.handleRoiVisibilityChange()
        break
      case 'save':
        this.handleReportGeneration()
        break
      case 'goTo':
        this.handleGoTo()
        break
      case undefined:
        break
    }
  }

  private cancelActiveInteraction(): void {
    if (this.state.isRoiDrawingActive) {
      logger.log('deactivate drawing of ROIs')
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.activateSelectInteraction({})
    } else if (this.state.isRoiModificationActive) {
      logger.log('deactivate modification of ROIs')
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.activateSelectInteraction({})
    } else if (this.state.isRoiTranslationActive) {
      logger.log('deactivate translation of ROIs')
      this.volumeViewer.deactivateTranslateInteraction()
      this.volumeViewer.activateSelectInteraction({})
    }
    this.setState({
      isAnnotationModalVisible: false,
      isSelectedRoiModalVisible: false,
      isRoiTranslationActive: false,
      isRoiDrawingActive: false,
      isRoiModificationActive: false,
      isGoToModalVisible: false,
      goToInput: EMPTY_GO_TO_INPUT,
    })
  }

  componentWillUnmount = (): void => {
    this.componentCleanup()
    ActiveSeriesService.clear()
  }

  componentSetup = (): void => {
    const unsubscribeDmv = subscribeDmvEvents(document.body, {
      dicommicroscopyviewer_roi_drawn: this.onRoiDrawn,
      dicommicroscopyviewer_roi_selected: this.onRoiSelected,
      dicommicroscopyviewer_viewport_clicked: this.onMapClicked,
      dicommicroscopyviewer_roi_double_clicked: this.onRoiDoubleClicked,
      dicommicroscopyviewer_pointer_move: this.onPointerMove,
      dicommicroscopyviewer_roi_removed: this.onRoiRemoved,
      dicommicroscopyviewer_roi_modified: this.onRoiModified,
      dicommicroscopyviewer_loading_started: this.onLoadingStarted,
      dicommicroscopyviewer_loading_ended: this.onLoadingEnded,
      dicommicroscopyviewer_loading_error: this.onLoadingError,
      dicommicroscopyviewer_frame_loading_started: this.onFrameLoadingStarted,
      dicommicroscopyviewer_frame_loading_ended: this.onFrameLoadingEnded,
      dicommicroscopyviewer_frame_loading_error: this.onFrameLoadingError,
      dicommicroscopyviewer_segment_visibility_changed:
        this.onSegmentVisibilityChanged,
      dicommicroscopyviewer_parameter_mapping_visibility_changed:
        this.onMappingVisibilityChanged,
    })
    const unsubscribeKeys = subscribeDomEvents(document.body, [
      [
        'keyup',
        (event) => {
          if (event instanceof KeyboardEvent) this.onKeyUp(event)
        },
      ],
      [
        'keydown',
        (event) => {
          if (event instanceof KeyboardEvent) this.onKeyDown(event)
        },
      ],
    ])
    const unsubscribeWindow = subscribeDomEvents(window, [
      ['beforeunload', this.componentCleanup],
      [PREFERENCES_CHANGED_EVENT, this.handlePreferencesChanged],
    ])
    this.unsubscribeEvents = () => {
      unsubscribeDmv()
      unsubscribeKeys()
      unsubscribeWindow()
    }
  }

  componentDidMount = (): void => {
    this.componentSetup()
    this.populateViewports()
    this.publishActiveSeriesToService()

    if (
      !this.props.slide.areVolumeImagesMonochrome &&
      !hasIccProfile(this.props.slide.volumeImages[0])
    ) {
      publishToast('No ICC Profile was found for color images', 'warning')
    }
  }

  /**
   * Handler that gets called when a finding has been selected for annotation.
   * Evaluations are reset, as is a geometry type the finding does not allow.
   */
  handleAnnotationFindingSelection = (
    finding: dcmjs.sr.coding.CodedConcept,
  ): void => {
    logger.log(`selected finding "${finding.CodeMeaning}"`)
    const allowedGeometryTypes = this.geometryTypeOptions[buildKey(finding)]
    this.setState((state) => ({
      selectedFinding: finding,
      selectedEvaluations: [],
      selectedGeometryType:
        state.selectedGeometryType !== undefined &&
        allowedGeometryTypes?.includes(state.selectedGeometryType) === true
          ? state.selectedGeometryType
          : undefined,
    }))
  }

  /**
   * Handler that gets called when a geometry type has been selected for
   * annotation.
   *
   * @param value - Name of the geometry type that got selected
   */
  handleAnnotationGeometryTypeSelection = (value: string): void => {
    this.setState({ selectedGeometryType: value })
  }

  /**
   * Handler that gets called when measurements have been selected for
   * annotation.
   */
  handleAnnotationMeasurementActivation = (checked: boolean): void => {
    this.setState({ selectedMarkup: checked ? 'measurement' : undefined })
  }

  /**
   * Handler that gets called when an evaluation has been selected for an
   * annotation; replaces any earlier value of the same evaluation.
   */
  handleAnnotationEvaluationSelection = (
    name: dcmjs.sr.coding.CodedConcept,
    value: dcmjs.sr.coding.CodedConcept,
  ): void => {
    this.setState((state) => ({
      selectedEvaluations: [
        ...state.selectedEvaluations.filter(
          (item: Evaluation) => buildKey(item.name) !== buildKey(name),
        ),
        { name, value },
      ],
    }))
  }

  /**
   * Handler that gets called when an evaluation has been cleared for an
   * annotation. Clears only `name` when given, otherwise all evaluations.
   */
  handleAnnotationEvaluationClearance = (
    name?: dcmjs.sr.coding.CodedConcept,
  ): void => {
    this.setState((state) => ({
      selectedEvaluations:
        name === undefined
          ? []
          : state.selectedEvaluations.filter(
              (item: Evaluation) => buildKey(item.name) !== buildKey(name),
            ),
    }))
  }

  private getGoToRanges(): GoToRanges {
    return {
      x: this.state.validXCoordinateRange,
      y: this.state.validYCoordinateRange,
    }
  }

  handleGoToInputChange = (field: GoToField, value: string): void => {
    this.setState((state) => ({
      goToInput: { ...state.goToInput, [field]: value },
    }))
  }

  /**
   * Handler that gets called when the selection of slide position was
   * completed.
   */
  handleSlidePositionSelection = (): void => {
    const { target } = validateGoToInput(
      this.state.goToInput,
      this.getGoToRanges(),
    )
    if (target === undefined) return
    logger.log(
      `select slide position (${target.x}, ${target.y}) ` +
        `at ${target.magnification}x magnification`,
    )
    const pixelSpacings = Array.from(
      { length: this.volumeViewer.numLevels },
      (_, level) => this.volumeViewer.getPixelSpacing(level)[0],
    )
    this.volumeViewer.navigate({
      position: [target.x, target.y],
      level: choosePyramidLevel(target.magnification, pixelSpacings),
    })
    const point = new dmv.scoord3d.Point({
      coordinates: [target.x, target.y, 0],
      frameOfReferenceUID: this.volumeViewer.frameOfReferenceUID,
    })
    this.addStyledRoi(
      new dmv.roi.ROI({ scoord3d: point }),
      this.defaultRoiStyle,
    )
    this.setState({ isGoToModalVisible: false, goToInput: EMPTY_GO_TO_INPUT })
  }

  /**
   * Handler that gets called when the selection of a slide position was
   * canceled.
   */
  handleSlidePositionSelectionCancellation = (): void => {
    logger.log('cancel slide position selection')
    this.setState({ isGoToModalVisible: false, goToInput: EMPTY_GO_TO_INPUT })
  }

  /**
   * Handler that gets called when annotation configuration has been completed.
   */
  handleAnnotationConfigurationCompletion = (): void => {
    logger.debug('complete annotation configuration')
    const finding = this.state.selectedFinding
    const geometryType = this.state.selectedGeometryType
    const markup = this.state.selectedMarkup
    if (geometryType !== undefined && finding !== undefined) {
      this.volumeViewer.activateDrawInteraction({
        geometryType,
        markup,
        styleOptions: this.getDrawStyle(finding),
      })
      this.setState({
        isAnnotationModalVisible: false,
        isRoiDrawingActive: true,
      })
    } else {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.VISUALIZATION,
          'Could not complete annotation configuration',
        ),
      )
    }
  }

  /**
   * Handler that gets called when annotation configuration has been cancelled.
   */
  handleAnnotationConfigurationCancellation = (): void => {
    logger.log('cancel annotation configuration')
    this.volumeViewer.activateSelectInteraction({})
    this.setState({
      isAnnotationModalVisible: false,
      isRoiDrawingActive: false,
    })
  }

  /**
   * Handler that gets called when a report should be generated for the current
   * set of annotations.
   */
  handleReportGeneration = (): void => {
    logger.log('save ROIs')
    const rois = this.volumeViewer.getAllROIs()
    const opticalPaths = this.volumeViewer.getAllOpticalPaths()
    const metadata = this.volumeViewer.getOpticalPathMetadata(
      opticalPaths[0].identifier,
    )
    this.setState((prevState) => {
      const report = generateReport({
        rois,
        metadata,
        user: this.props.user,
        app: this.props.app,
        visibleRoiUIDs: prevState.visibleRoiUIDs,
      })
      return {
        isReportModalVisible: report.isReportModalVisible,
        generatedReport: report.generatedReport,
      }
    })
  }

  /**
   * Handler that gets called when a report should be verified. The current
   * list of annotations will be presented to the user together with other
   * pertinent metadata about the patient, study, and specimen.
   */
  handleReportVerification = (): void => {
    logger.log('verify report generation')
    const report = this.state.generatedReport
    if (report !== undefined) {
      const client = this.props.clients[StorageClasses.COMPREHENSIVE_3D_SR]
      Promise.resolve()
        .then(() =>
          client.storeInstances({
            datasets: [encodeDicomDataset(report, this.props.app.uid)],
          }),
        )
        .then(() => publishToast('Annotations were saved.', 'success'))
        .catch((error) => {
          logger.error(error)
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.SLIM,
            new CustomError(
              errorTypes.ENCODINGANDDECODING,
              'Annotations could not be saved',
            ),
          )
        })
    }
    this.setState({
      isReportModalVisible: false,
      generatedReport: undefined,
    })
  }

  /**
   * Handler that gets called when report generation has been cancelled.
   */
  handleReportCancellation = (): void => {
    this.setState({
      isReportModalVisible: false,
      generatedReport: undefined,
    })
  }

  /**
   * Handle toggling of annotation visibility, i.e., whether a given
   * annotation should be either displayed or hidden by the viewer.
   */
  handleAnnotationVisibilityChange = ({
    roiUID,
    isVisible,
  }: {
    roiUID: string
    isVisible: boolean
  }): void => {
    this.handleAnnotationVisibilityChanges([{ uid: roiUID, isVisible }])
  }

  /** Shows or hides several ROIs with a single state update */
  handleAnnotationVisibilityChanges = (changes: VisibilityChange[]): void => {
    const applied: VisibilityChange[] = []
    try {
      for (const { uid, isVisible } of changes) {
        if (isVisible) {
          logger.log(`show ROI ${uid}`)
          const roi = this.volumeViewer.getROI(uid)
          this.volumeViewer.setROIStyle(roi.uid, this.getStyleForRoi(roi))
          applied.push({ uid: roi.uid, isVisible })
        } else {
          logger.log(`hide ROI ${uid}`)
          this.volumeViewer.setROIStyle(uid, {})
          applied.push({ uid, isVisible })
        }
      }
    } finally {
      if (applied.length > 0) {
        this.setState((state) => ({
          visibleRoiUIDs: applyVisibilityChanges(state.visibleRoiUIDs, applied),
          selectedRoiUIDs: removeHiddenUids(state.selectedRoiUIDs, applied),
        }))
      }
    }
  }

  /**
   * Handle toggling of annotation group visibility, i.e., whether a given
   * annotation group should be either displayed or hidden by the viewer.
   */
  handleAnnotationGroupVisibilityChange = ({
    annotationGroupUID,
    isVisible,
  }: {
    annotationGroupUID: string
    isVisible: boolean
  }): void => {
    this.handleAnnotationGroupVisibilityChanges([
      { uid: annotationGroupUID, isVisible },
    ])
  }

  /** Shows or hides several annotation groups with a single state update */
  handleAnnotationGroupVisibilityChanges = (
    changes: VisibilityChange[],
  ): void => {
    const allAnnotationGroups = this.volumeViewer.getAllAnnotationGroups()
    const applied: VisibilityChange[] = []
    try {
      for (const { uid, isVisible } of changes) {
        const annotationGroup = allAnnotationGroups.find((ag) => ag.uid === uid)
        if (annotationGroup !== undefined) {
          runValidations({
            dialog: true,
            context: { annotationGroup, slide: this.props.slide },
          })
        }

        logger.log(`change visibility of annotation group ${uid}`)
        if (isVisible) {
          logger.log(`show annotation group ${uid}`)
          try {
            this.volumeViewer.showAnnotationGroup(uid)
          } catch (error) {
            NotificationMiddleware.onError(
              NotificationMiddlewareContext.SLIM,
              new CustomError(
                errorTypes.VISUALIZATION,
                'Failed to show annotation group.',
              ),
            )
            throw error
          }
        } else {
          logger.log(`hide annotation group ${uid}`)
          this.volumeViewer.hideAnnotationGroup(uid)
        }
        applied.push({ uid, isVisible })
      }
    } finally {
      if (applied.length > 0) {
        this.setState((state) => ({
          visibleAnnotationGroupUIDs: applyVisibilityChanges(
            state.visibleAnnotationGroupUIDs,
            applied,
          ),
        }))
      }
    }
  }

  /**
   * Handle change of annotation group style.
   */
  handleAnnotationGroupStyleChange = ({
    uid,
    styleOptions,
  }: {
    uid: string
    styleOptions: {
      opacity?: number
      color?: number[]
      measurement?: dcmjs.sr.coding.CodedConcept
      fill?: boolean
      fillOpacity?: number
    }
  }): void => {
    logger.log(`change style of annotation group ${uid}`)
    try {
      this.volumeViewer.setAnnotationGroupStyle(uid, styleOptions)
    } catch (error) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.VISUALIZATION,
          'Failed to change style of annotation group.',
        ),
      )
      throw error
    }
  }

  generateRoiStyle = (
    styleOptions: AnnotationStyle,
  ): dmv.viewer.ROIStyleOptions => {
    const opacity = styleOptions.opacity ?? DEFAULT_ANNOTATION_OPACITY
    const strokeColor = styleOptions.color ?? DEFAULT_ANNOTATION_STROKE_COLOR
    const fillColor = styleOptions.contourOnly
      ? [0, 0, 0, 0]
      : strokeColor.map((c) => Math.min(c + 25, 255))
    return formatRoiStyle({
      fill: { color: [...fillColor, opacity] },
      stroke: { color: [...strokeColor, opacity] },
      radius: this.defaultRoiStyle.stroke?.width,
    })
  }

  /** Restyles the ROIs and shows the hidden ones, in a single state update */
  handleRoiStylesChange = ({
    uids,
    styleOptions,
  }: {
    uids: string[]
    styleOptions: AnnotationStyle
  }): void => {
    const style = this.generateRoiStyle(styleOptions)
    const styledUids: string[] = []
    try {
      for (const uid of uids) {
        logger.log(`change style of ROI ${uid}`)
        this.defaultAnnotationStyles[uid] = styleOptions
        const key = getRoiKey(this.volumeViewer.getROI(uid))
        if (key !== undefined) {
          this.roiStyles[key] = style
        }
        this.roiStylesByUid[uid] = style
        this.volumeViewer.setROIStyle(uid, style)
        styledUids.push(uid)
      }
    } catch (error) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.VISUALIZATION,
          'Failed to change style of ROI.',
        ),
      )
      throw error
    } finally {
      this.setState((state) =>
        styledUids.every((uid) => state.visibleRoiUIDs.has(uid))
          ? null
          : {
              visibleRoiUIDs: applyVisibilityChanges(
                state.visibleRoiUIDs,
                styledUids.map((uid) => ({ uid, isVisible: true })),
              ),
            },
      )
    }
  }

  /**
   * Handle toggling of segment visibility, i.e., whether a given
   * segment should be either displayed or hidden by the viewer.
   */
  handleSegmentVisibilityChange = ({
    segmentUID,
    isVisible,
  }: {
    segmentUID: string
    isVisible: boolean
  }): void => {
    const segment = this.volumeViewer
      .getAllSegments()
      .find((item) => item.uid === segmentUID)
    if (segment?.isAbsent) {
      logger.debug(`ignore visibility change for absent segment ${segmentUID}`)
      return
    }
    logger.log(`change visibility of segment ${segmentUID}`)
    if (isVisible) {
      logger.log(`show segment ${segmentUID}`)
      this.volumeViewer.showSegment(segmentUID)
      this.setState((state) => {
        const visibleSegmentUIDs = new Set(state.visibleSegmentUIDs)
        visibleSegmentUIDs.add(segmentUID)
        return { visibleSegmentUIDs }
      })
    } else {
      logger.log(`hide segment ${segmentUID}`)
      this.volumeViewer.hideSegment(segmentUID)
      this.setState((state) => {
        const visibleSegmentUIDs = new Set(state.visibleSegmentUIDs)
        visibleSegmentUIDs.delete(segmentUID)
        return { visibleSegmentUIDs }
      })
    }
  }

  handleSegmentClick = (segmentUID: string): void => {
    this.volumeViewer.zoomToSegment(segmentUID)
  }

  /**
   * Handle change of segment style.
   */
  handleSegmentStyleChange = ({
    segmentUID,
    styleOptions,
  }: {
    segmentUID: string
    styleOptions: {
      opacity?: number
      color?: number[]
    }
  }): void => {
    logger.log(`change style of segment ${segmentUID}`)

    /** Track user customization if color is provided */
    if (styleOptions.color !== undefined) {
      const color = styleOptions.color
      this.setState((state) => ({
        customizedSegmentColors: {
          ...state.customizedSegmentColors,
          [segmentUID]: color,
        },
      }))
    }

    /**
     * Only pass a palette when the user changed color. Opacity-only updates
     * must not send a default RGB for fractional segments or distinct
     * colormaps are replaced by a flat LUT.
     */
    const stylePayload: {
      opacity?: number
      paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
    } = {}
    if (styleOptions.opacity !== undefined) {
      stylePayload.opacity = styleOptions.opacity
    }
    if (styleOptions.color !== undefined) {
      stylePayload.paletteColorLookupTable =
        SlideViewer.createSegmentPaletteColorLookupTable(
          styleOptions.color,
          this.volumeViewer.getPaletteDisplayGammaCorrectionEnabled(),
        )
    }

    this.volumeViewer.setSegmentStyle(segmentUID, stylePayload)
  }

  /**
   * Handle toggling of mapping visibility, i.e., whether a given
   * mapping should be either displayed or hidden by the viewer.
   */
  handleMappingVisibilityChange = ({
    mappingUID,
    isVisible,
  }: {
    mappingUID: string
    isVisible: boolean
  }): void => {
    logger.log(`change visibility of mapping ${mappingUID}`)
    if (isVisible) {
      logger.log(`show mapping ${mappingUID}`)
      this.volumeViewer.showParameterMapping(mappingUID)
      this.setState((state) => {
        const visibleMappingUIDs = new Set(state.visibleMappingUIDs)
        visibleMappingUIDs.add(mappingUID)
        return { visibleMappingUIDs }
      })
    } else {
      logger.log(`hide mapping ${mappingUID}`)
      this.volumeViewer.hideParameterMapping(mappingUID)
      this.setState((state) => {
        const visibleMappingUIDs = new Set(state.visibleMappingUIDs)
        visibleMappingUIDs.delete(mappingUID)
        return { visibleMappingUIDs }
      })
    }
  }

  /**
   * Handle change of mapping style.
   */
  handleMappingStyleChange = ({
    mappingUID,
    styleOptions,
  }: {
    mappingUID: string
    styleOptions: {
      opacity?: number
    }
  }): void => {
    logger.log(`change style of mapping ${mappingUID}`)
    this.volumeViewer.setParameterMappingStyle(mappingUID, styleOptions)
  }

  /**
   * Handle toggling of optical path visibility, i.e., whether a given
   * optical path should be either displayed or hidden by the viewer.
   */
  handleOpticalPathVisibilityChange = ({
    opticalPathIdentifier,
    isVisible,
  }: {
    opticalPathIdentifier: string
    isVisible: boolean
  }): void => {
    logger.log(`change visibility of optical path ${opticalPathIdentifier}`)
    if (isVisible) {
      logger.log(`show optical path ${opticalPathIdentifier}`)
      this.volumeViewer.showOpticalPath(opticalPathIdentifier)
      this.setState((state) => {
        const visibleOpticalPathIdentifiers = new Set(
          state.visibleOpticalPathIdentifiers,
        )
        visibleOpticalPathIdentifiers.add(opticalPathIdentifier)
        return { visibleOpticalPathIdentifiers }
      })
    } else {
      logger.log(`hide optical path ${opticalPathIdentifier}`)
      this.volumeViewer.hideOpticalPath(opticalPathIdentifier)
      this.setState((state) => {
        const visibleOpticalPathIdentifiers = new Set(
          state.visibleOpticalPathIdentifiers,
        )
        visibleOpticalPathIdentifiers.delete(opticalPathIdentifier)
        return { visibleOpticalPathIdentifiers }
      })
    }
  }

  /**
   * Handle change of optical path style.
   */
  handleOpticalPathStyleChange = ({
    opticalPathIdentifier,
    styleOptions,
  }: {
    opticalPathIdentifier: string
    styleOptions: {
      opacity?: number
      color?: number[]
      limitValues?: number[]
    }
  }): void => {
    logger.log(`change style of optical path ${opticalPathIdentifier}`)
    this.volumeViewer.setOpticalPathStyle(opticalPathIdentifier, styleOptions)
  }

  /**
   * Handle toggling of optical path activity, i.e., whether a given
   * optical path should be either added or removed from the viewport.
   */
  handleOpticalPathActivityChange = ({
    opticalPathIdentifier,
    isActive,
  }: {
    opticalPathIdentifier: string
    isActive: boolean
  }): void => {
    logger.log(`change activity of optical path ${opticalPathIdentifier}`)
    if (isActive) {
      logger.log(`activate optical path ${opticalPathIdentifier}`)
      this.volumeViewer.activateOpticalPath(opticalPathIdentifier)
      this.setState((state) => {
        const activeOpticalPathIdentifiers = new Set(
          state.activeOpticalPathIdentifiers,
        )
        activeOpticalPathIdentifiers.add(opticalPathIdentifier)
        return { activeOpticalPathIdentifiers }
      })
    } else {
      logger.log(`deactivate optical path ${opticalPathIdentifier}`)
      this.volumeViewer.deactivateOpticalPath(opticalPathIdentifier)
      this.setState((state) => {
        const activeOpticalPathIdentifiers = new Set(
          state.activeOpticalPathIdentifiers,
        )
        activeOpticalPathIdentifiers.delete(opticalPathIdentifier)
        return { activeOpticalPathIdentifiers }
      })
    }
  }

  /**
   * Set default presentation state that is either defined by metadata included
   * in the DICOM Slide Microscopy instance or by the viewer.
   */
  setDefaultPresentationState = (): void => {
    const visibleOpticalPathIdentifiers: Set<string> = new Set()
    const opticalPaths = this.getSortedOpticalPaths()
    opticalPaths.forEach((item: dmv.opticalPath.OpticalPath) => {
      const identifier = item.identifier
      const style = this.volumeViewer.getOpticalPathDefaultStyle(identifier)
      this.volumeViewer.setOpticalPathStyle(identifier, style)
      this.volumeViewer.hideOpticalPath(identifier)
      this.volumeViewer.deactivateOpticalPath(identifier)
      if (item.isMonochromatic) {
        /**
         * If the image metadata contains a palette color lookup table for the
         * optical path, then it will be displayed by default.
         */
        if (
          item.paletteColorLookupTableUID !== null &&
          item.paletteColorLookupTableUID !== undefined
        ) {
          visibleOpticalPathIdentifiers.add(identifier)
        }
      } else {
        visibleOpticalPathIdentifiers.add(identifier)
      }
    })

    /**
     * If no optical paths have been selected for visualization so far, select
     * first n optical paths and set a default value of interest (VOI) window
     * (using pre-computed pixel data statistics) and a default color.
     */
    if (visibleOpticalPathIdentifiers.size === 0) {
      const defaultColors = [[255, 255, 255]]
      opticalPaths.forEach((item: dmv.opticalPath.OpticalPath) => {
        const identifier = item.identifier
        if (item.isMonochromatic) {
          const numVisible = visibleOpticalPathIdentifiers.size
          if (numVisible < defaultColors.length) {
            const style = {
              ...this.volumeViewer.getOpticalPathStyle(identifier),
            }
            style.color = defaultColors[numVisible]
            const stats = this.pixelDataStatistics[item.identifier]
            if (stats !== undefined) {
              style.limitValues = [stats.min, stats.max]
            }
            this.volumeViewer.setOpticalPathStyle(item.identifier, style)
            visibleOpticalPathIdentifiers.add(item.identifier)
          }
        }
      })
    }

    logger.log(
      `selected n=${visibleOpticalPathIdentifiers.size} optical paths ` +
        'for visualization',
    )
    visibleOpticalPathIdentifiers.forEach((identifier) => {
      this.volumeViewer.showOpticalPath(identifier)
    })
    this.setState({
      activeOpticalPathIdentifiers: new Set(visibleOpticalPathIdentifiers),
      visibleOpticalPathIdentifiers: new Set(visibleOpticalPathIdentifiers),
    })
  }

  /**
   * Handler that gets called when the presentation state selection has been
   * cleared, restoring the viewer defaults.
   */
  handlePresentationStateReset = (): void => {
    this.setState({ selectedPresentationStateUID: undefined })
    const urlPath = this.props.location.pathname
    this.props.navigate(urlPath)
    this.setDefaultPresentationState()
  }

  /**
   * Handler that gets called when a presentation state has been selected from
   * the current list of available presentation states.
   */
  handlePresentationStateSelection = (value?: string): void => {
    if (value !== undefined) {
      logger.log(`select Presentation State instance "${value}"`)
      const presentationState = this.state.presentationStates.find(
        (instance) => instance.SOPInstanceUID === value,
      )
      if (presentationState !== undefined) {
        this.props.navigate(`${this.props.location.pathname}?state=${value}`)
        this.setPresentationState(presentationState)
      } else {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Presentation State could not be found',
          ),
        )
        logger.log(
          'failed to handle section of presentation state: ' +
            `could not find instance "${value}"`,
        )
      }
    } else {
      this.handlePresentationStateReset()
    }
    this.setState({ selectedPresentationStateUID: value })
  }

  /**
   * Handler that will toggle the ROI drawing tool, i.e., either activate or
   * de-activate it, depending on its current state.
   */
  handleRoiDrawing = (): void => {
    if (this.state.isRoiDrawingActive) {
      logger.log('deactivate drawing of ROIs')
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.activateSelectInteraction({})
      this.setState({
        isAnnotationModalVisible: false,
        isSelectedRoiModalVisible: false,
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false,
        isGoToModalVisible: false,
      })
    } else {
      logger.log('activate drawing of ROIs')
      this.setState({
        isAnnotationModalVisible: true,
        isSelectedRoiModalVisible: false,
        isRoiDrawingActive: true,
        isRoiModificationActive: false,
        isRoiTranslationActive: false,
        isGoToModalVisible: false,
      })
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.deactivateTranslateInteraction()
      this.volumeViewer.deactivateModifyInteraction()
    }
  }

  /**
   * Handler that will toggle the ROI modification tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiModification = (): void => {
    logger.log('toggle modification of ROIs')
    if (this.volumeViewer.isModifyInteractionActive) {
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.activateSelectInteraction({})
      this.setState({
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false,
      })
    } else {
      this.setState({
        isRoiModificationActive: true,
        isRoiDrawingActive: false,
        isRoiTranslationActive: false,
      })
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.deactivateTranslateInteraction()
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.activateSnapInteraction({})
      this.volumeViewer.activateModifyInteraction({})
    }
  }

  /**
   * Handler that will toggle the ROI translation tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiTranslation = (): void => {
    logger.log('toggle translation of ROIs')
    if (this.volumeViewer.isTranslateInteractionActive) {
      this.volumeViewer.deactivateTranslateInteraction()
      this.setState({
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false,
      })
    } else {
      this.setState({
        isRoiTranslationActive: true,
        isRoiDrawingActive: false,
        isRoiModificationActive: false,
      })
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.activateTranslateInteraction({})
    }
  }

  handleGoTo = (): void => {
    this.volumeViewer.deactivateDrawInteraction()
    this.volumeViewer.deactivateModifyInteraction()
    this.volumeViewer.deactivateSnapInteraction()
    this.volumeViewer.deactivateTranslateInteraction()
    this.volumeViewer.deactivateSelectInteraction()
    this.setState({
      isGoToModalVisible: true,
      goToInput: EMPTY_GO_TO_INPUT,
      isAnnotationModalVisible: false,
      isSelectedRoiModalVisible: false,
      isReportModalVisible: false,
      isRoiTranslationActive: false,
      isRoiModificationActive: false,
      isRoiDrawingActive: false,
    })
  }

  /**
   * Remove the selected ROIs (or all visible ones), asking for confirmation
   * first when the user's preferences require it.
   */
  handleRoiRemoval = (): void => {
    const roiCount =
      this.state.selectedRoiUIDs.size > 0
        ? this.state.selectedRoiUIDs.size
        : this.state.visibleRoiUIDs.size
    if (roiCount === 0) {
      publishToast('No annotation was selected for removal', 'warning')
      return
    }
    if (this.preferences.confirmRoiRemoval) {
      this.setState({ isRoiRemovalConfirmVisible: true })
      return
    }
    this.removeRois()
  }

  handleRoiRemovalConfirmation = (): void => {
    this.setState({ isRoiRemovalConfirmVisible: false })
    this.removeRois()
  }

  handleRoiRemovalCancellation = (): void => {
    this.setState({ isRoiRemovalConfirmVisible: false })
  }

  private forgetRoiStyle(uid: string): void {
    delete this.roiStylesByUid[uid]
    delete this.defaultAnnotationStyles[uid]
  }

  /** Remove the selected ROIs, or all visible ROIs when none is selected. */
  private removeRois(): void {
    this.volumeViewer.deactivateDrawInteraction()
    this.volumeViewer.deactivateSnapInteraction()
    this.volumeViewer.deactivateTranslateInteraction()
    this.volumeViewer.deactivateModifyInteraction()
    const plan = planRoiRemoval(
      this.state.selectedRoiUIDs,
      this.state.visibleRoiUIDs,
    )
    plan.removedUIDs.forEach((uid) => {
      logger.log(`remove ROI "${uid}"`)
      this.volumeViewer.removeROI(uid)
      this.forgetRoiStyle(uid)
    })
    publishToast(formatRoiRemovalMessage(plan.removedUIDs.length), 'success')
    this.setState({
      selectedRoiUIDs: plan.selectedRoiUIDs,
      visibleRoiUIDs: plan.visibleRoiUIDs,
      isRoiTranslationActive: false,
      isRoiDrawingActive: false,
      isRoiModificationActive: false,
    })
    this.volumeViewer.activateSelectInteraction({})
  }

  /**
   * Handler that will toggle the ROI visibility tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiVisibilityChange = (): void => {
    logger.log('toggle visibility of ROIs')
    if (!this.state.areRoisHidden) {
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.deactivateTranslateInteraction()
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.hideROIs()
      this.setState({
        areRoisHidden: true,
        isRoiDrawingActive: false,
        isRoiModificationActive: false,
        isRoiTranslationActive: false,
      })
    } else {
      this.volumeViewer.showROIs()
      this.volumeViewer.activateSelectInteraction({})
      this.state.selectedRoiUIDs.forEach((uid) => {
        this.volumeViewer.setROIStyle(uid, this.selectedRoiStyle)
      })
      this.setState({ areRoisHidden: false })
    }
  }

  handleAnnotationGroupClick = (annotationGroupUID: string): void => {
    this.volumeViewer.zoomToROI(annotationGroupUID)
  }

  /** Switching series hides every group shown for the previous one */
  handleAnnotationGroupSelection = (value: string): void => {
    this.state.visibleAnnotationGroupUIDs.forEach((annotationGroupUID) => {
      this.volumeViewer.hideAnnotationGroup(annotationGroupUID)
    })
    this.setState({
      selectedSeriesInstanceUID: value,
      visibleAnnotationGroupUIDs: new Set(),
    })
  }

  private getSegmentSeriesUID = (segment: dmv.segment.Segment): string =>
    this.volumeViewer.getSegmentMetadata(segment.uid)?.[0]?.SeriesInstanceUID ??
    'unknown'

  /**
   * Switching series hides the previous segments; if any were shown, every
   * present segment of the new series is shown instead.
   */
  handleSegmentationSeriesSelection = (value: string): void => {
    this.state.visibleSegmentUIDs.forEach((segmentUID) => {
      this.volumeViewer.hideSegment(segmentUID)
    })
    const segments = this.volumeViewer.getAllSegments()
    const selectedSeriesSegments = itemsForSeries(
      segments,
      groupBySeries(segments, this.getSegmentSeriesUID),
      value,
    )
    const newVisibleSegmentUIDs = new Set<string>()
    if (this.state.visibleSegmentUIDs.size > 0) {
      selectedSeriesSegments.forEach((segment) => {
        if (!segment.isAbsent) {
          newVisibleSegmentUIDs.add(segment.uid)
        }
      })
    }
    this.setState({
      selectedSegmentationSeriesInstanceUID: value,
      visibleSegmentUIDs: newVisibleSegmentUIDs,
    })
    newVisibleSegmentUIDs.forEach((segmentUID) => {
      this.volumeViewer.showSegment(segmentUID)
    })
  }

  /** Series description from the metadata store, else a truncated UID */
  getSeriesDescription = (seriesInstanceUID: string): string => {
    const study = DicomMetadataStore.getStudy(this.props.studyInstanceUID)
    const series = study?.series?.find(
      (s) => s.SeriesInstanceUID === seriesInstanceUID,
    )
    return formatSeriesLabel(seriesInstanceUID, series?.SeriesDescription)
  }

  /**
   * Handler that will toggle the ICC profile color management, i.e., either
   * enable or disable it, depending on its current state.
   */
  handleICCProfilesToggle = (checked: boolean): void => {
    this.setState({ isICCProfilesEnabled: checked })
    this.volumeViewer.toggleICCProfiles()
  }

  /**
   * Toggle display gamma compensation for palette-based rendering (optical paths,
   * segment overlays, parametric maps).
   */
  handlePaletteDisplayGammaCorrectionToggle = (checked: boolean): void => {
    this.setState({ isPaletteDisplayGammaCorrectionEnabled: checked })
    this.volumeViewer.setPaletteDisplayGammaCorrectionEnabled(checked)
  }

  /**
   * Handler that will toggle the segmentation interpolation, i.e., either
   * enable or disable it, depending on its current state.
   */
  handleSegmentationInterpolationToggle = (checked: boolean): void => {
    this.setState({ isSegmentationInterpolationEnabled: checked })
    this.volumeViewer.toggleSegmentationInterpolation()
  }

  /**
   * Handler that will toggle the parametric map interpolation, i.e., either
   * enable or disable it, depending on its current state.
   */
  handleParametricMapInterpolationToggle = (checked: boolean): void => {
    this.setState({ isParametricMapInterpolationEnabled: checked })
    this.volumeViewer.toggleParametricMapInterpolation()
  }

  private getClusteringSettings(): ClusteringSettings {
    return {
      isEnabled: this.state.isClusteringEnabled,
      thresholdInput: this.state.clusteringThresholdInput,
    }
  }

  /**
   * Store new clustering settings and push them to DMV when they take effect.
   * The threshold text is kept as typed so decimals can be entered.
   */
  private updateClusteringSettings(changes: Partial<ClusteringSettings>): void {
    const previous = this.getClusteringSettings()
    const next = { ...previous, ...changes }
    if (
      previous.isEnabled === next.isEnabled &&
      previous.thresholdInput === next.thresholdInput
    ) {
      return
    }
    this.setState({
      isClusteringEnabled: next.isEnabled,
      clusteringThresholdInput: next.thresholdInput,
    })
    if (shouldApplyClusteringSettings(previous, next)) {
      this.applyClusteringOptions(next.isEnabled, next.thresholdInput)
    }
  }

  /**
   * Handler that toggles clustering of bulk annotations on/off.
   */
  handleClusteringToggle = (checked: boolean): void => {
    this.updateClusteringSettings({ isEnabled: checked })
  }

  /**
   * Handler for the raw clustering pixel size threshold field; DMV is updated
   * only with valid values.
   */
  handleClusteringThresholdInputChange = (raw: string): void => {
    this.updateClusteringSettings({ thresholdInput: raw })
  }

  handleAnnotationGroupDisplaySettingsChange = (
    settings: AnnotationGroupDisplaySettings,
  ): void => {
    const changed = changedSettingKeys(
      this.getAnnotationGroupDisplaySettings(),
      settings,
    )
    if (changed.length === 0) return
    this.updateClusteringSettings({
      isEnabled: settings.clusteringEnabled,
      thresholdInput: settings.clusteringThreshold,
    })
  }

  private getAnnotationGroupDisplaySettings(): AnnotationGroupDisplaySettings {
    return {
      clusteringEnabled: this.state.isClusteringEnabled,
      clusteringThreshold: this.state.clusteringThresholdInput,
    }
  }

  /**
   * Record the list style of a newly added ROI and give its finding a
   * palette style when neither the ROI nor the finding has one.
   */
  private registerRoiAnnotationStyle(
    roi: dmv.roi.ROI,
    key: string | undefined = getRoiKey(roi),
  ): void {
    if (this.defaultAnnotationStyles[roi.uid] !== undefined) return
    const ownStyle = this.roiStylesByUid[roi.uid]
    const findingStyle = key !== undefined ? this.roiStyles[key] : undefined
    const color =
      (ownStyle ?? findingStyle)?.stroke?.color.slice(0, 3) ??
      DEFAULT_ANNOTATION_COLOR_PALETTE[
        Object.keys(this.roiStyles).length %
          DEFAULT_ANNOTATION_COLOR_PALETTE.length
      ]
    const annotationStyle: AnnotationStyle = {
      color,
      opacity: DEFAULT_ANNOTATION_OPACITY,
      contourOnly: false,
    }
    this.defaultAnnotationStyles[roi.uid] = annotationStyle
    if (
      key !== undefined &&
      ownStyle === undefined &&
      findingStyle === undefined
    ) {
      this.roiStyles[key] = this.generateRoiStyle(annotationStyle)
    }
  }

  private readonly getDataFromViewer = (): {
    rois: dmv.roi.ROI[]
    segments: dmv.segment.Segment[]
    mappings: dmv.mapping.ParameterMapping[]
    annotationGroups: dmv.annotation.AnnotationGroup[]
    annotations: AnnotationCategoryAndType[]
  } => {
    const rois = this.volumeViewer.getAllROIs()
    const annotationGroups = this.volumeViewer
      .getAllAnnotationGroups()
      .filter((annotationGroup) =>
        this.props.slide.seriesInstanceUIDs.includes(
          annotationGroup.referencedSeriesInstanceUID,
        ),
      )
    return {
      rois,
      segments: this.volumeViewer.getAllSegments(),
      mappings: this.volumeViewer.getAllParameterMappings(),
      annotationGroups,
      annotations: rois.map((roi) => adaptRoiToAnnotation(roi)),
    }
  }

  private readonly getReport = (): React.ReactNode => {
    const dataset = this.state.generatedReport
    if (dataset !== undefined) {
      return <Report dataset={dataset} />
    }
    return undefined
  }

  private readonly getRoiColor = (roi: dmv.roi.ROI): string => {
    let color: number[] | undefined
    try {
      color = this.volumeViewer.getROIStyle(roi.uid)?.stroke?.color
    } catch {
      /** ROIs being removed may no longer have a style */
      color = undefined
    }
    return roiStrokeToCssColor(color, 'rgb(var(--primary))')
  }

  private getSortedOpticalPaths(): dmv.opticalPath.OpticalPath[] {
    return sortByIdentifier(this.volumeViewer.getAllOpticalPaths())
  }

  private readonly handleOpticalPathDisplaySettingsChange = (
    settings: OpticalPathDisplaySettings,
  ): void => {
    const changed = changedSettingKeys(
      {
        iccProfileEnabled: this.state.isICCProfilesEnabled,
        gammaEnabled: this.state.isPaletteDisplayGammaCorrectionEnabled,
      },
      settings,
    )
    if (changed.includes('iccProfileEnabled')) {
      this.handleICCProfilesToggle(settings.iccProfileEnabled)
    }
    if (changed.includes('gammaEnabled')) {
      this.handlePaletteDisplayGammaCorrectionToggle(settings.gammaEnabled)
    }
  }

  private readonly handleSegmentationDisplaySettingsChange = (settings: {
    interpolationEnabled: boolean
  }): void => {
    if (
      settings.interpolationEnabled !==
      this.state.isSegmentationInterpolationEnabled
    ) {
      this.handleSegmentationInterpolationToggle(settings.interpolationEnabled)
    }
  }

  private readonly handleParametricMapDisplaySettingsChange = (settings: {
    interpolationEnabled: boolean
  }): void => {
    this.handleParametricMapInterpolationToggle(settings.interpolationEnabled)
  }

  private renderOpticalPathsSection(): React.ReactNode {
    const opticalPaths = this.getSortedOpticalPaths()
    const opticalPathStyles: Record<string, OpticalPathStyle> = {}
    const opticalPathMetadata: {
      [identifier: string]: dmv.metadata.VLWholeSlideMicroscopyImage[]
    } = {}
    opticalPaths.forEach(({ identifier }) => {
      opticalPathMetadata[identifier] =
        this.volumeViewer.getOpticalPathMetadata(identifier)
      opticalPathStyles[identifier] = {
        ...this.volumeViewer.getOpticalPathStyle(identifier),
      }
    })
    this.panelStyles.opticalPaths = reuseEqualStyles(
      this.panelStyles.opticalPaths,
      opticalPathStyles,
    )
    return (
      <OpticalPathsSection
        metadata={opticalPathMetadata}
        opticalPaths={opticalPaths}
        defaultOpticalPathStyles={this.panelStyles.opticalPaths}
        visibleOpticalPathIdentifiers={this.state.visibleOpticalPathIdentifiers}
        activeOpticalPathIdentifiers={this.state.activeOpticalPathIdentifiers}
        onOpticalPathVisibilityChange={this.handleOpticalPathVisibilityChange}
        onOpticalPathStyleChange={this.handleOpticalPathStyleChange}
        onOpticalPathActivityChange={this.handleOpticalPathActivityChange}
        selectedPresentationStateUID={this.state.selectedPresentationStateUID}
        hasIccProfiles={this.volumeViewer.getICCProfiles().length > 0}
        displaySettings={{
          iccProfileEnabled: this.state.isICCProfilesEnabled,
          gammaEnabled: this.state.isPaletteDisplayGammaCorrectionEnabled,
        }}
        onDisplaySettingsChange={this.handleOpticalPathDisplaySettingsChange}
      />
    )
  }

  /**
   * Segment list styles. BINARY segment palettes are (re)applied to DMV here
   * so they follow customized colors and the gamma setting.
   */
  private renderSegmentationsSection(
    segments: dmv.segment.Segment[],
  ): React.ReactNode {
    if (segments.length === 0) return undefined
    const defaultSegmentStyles: Record<string, SegmentStyle> = {}
    const segmentMetadata: {
      [segmentUID: string]: dmv.metadata.Segmentation[]
    } = {}
    segments.forEach((segment) => {
      const metadata = this.volumeViewer.getSegmentMetadata(segment.uid)
      segmentMetadata[segment.uid] = metadata
      const defaultStyle = this.volumeViewer.getSegmentStyle(segment.uid)
      if (getSegmentationType(metadata[0]) !== 'BINARY') {
        /** Non-BINARY segments are drawn through their palette, not a color */
        defaultSegmentStyles[segment.uid] = {
          opacity: defaultStyle.opacity,
          color: undefined,
          paletteColorLookupTable:
            defaultStyle.paletteColorLookupTable ?? undefined,
        }
        return
      }
      const color =
        this.state.customizedSegmentColors[segment.uid] ??
        getSegmentColor({
          segmentSequence: metadata?.[0]?.SegmentSequence,
          segmentNumber: segment.number,
        }) ??
        undefined
      defaultSegmentStyles[segment.uid] = {
        opacity: defaultStyle.opacity,
        color,
      }
      this.volumeViewer.setSegmentStyle(segment.uid, {
        opacity: defaultStyle.opacity,
        paletteColorLookupTable:
          color !== undefined
            ? SlideViewer.createSegmentPaletteColorLookupTable(
                color,
                this.volumeViewer.getPaletteDisplayGammaCorrectionEnabled(),
              )
            : undefined,
      })
    })

    this.panelStyles.segments = reuseEqualStyles(
      this.panelStyles.segments,
      defaultSegmentStyles,
    )

    const groups = groupBySeries(
      segments,
      (segment) =>
        segmentMetadata[segment.uid]?.[0]?.SeriesInstanceUID ?? 'unknown',
    )
    const selectedSeriesUID =
      this.state.selectedSegmentationSeriesInstanceUID ?? ALL_SERIES
    return (
      <SegmentationsSection
        seriesOptions={buildSeriesOptions({
          groups,
          allLabel: `All Series (${segments.length} segments)`,
          unit: 'segments',
          describeSeries: this.getSeriesDescription,
        })}
        selectedSeriesUID={selectedSeriesUID}
        onSeriesChange={this.handleSegmentationSeriesSelection}
        segments={[...itemsForSeries(segments, groups, selectedSeriesUID)]}
        metadata={segmentMetadata}
        defaultSegmentStyles={this.panelStyles.segments}
        visibleSegmentUIDs={this.state.visibleSegmentUIDs}
        onSegmentVisibilityChange={this.handleSegmentVisibilityChange}
        onSegmentStyleChange={this.handleSegmentStyleChange}
        onSegmentClick={this.handleSegmentClick}
        displaySettings={{
          interpolationEnabled: this.state.isSegmentationInterpolationEnabled,
        }}
        onDisplaySettingsChange={this.handleSegmentationDisplaySettingsChange}
      />
    )
  }

  private renderParametricMapsSection(
    mappings: dmv.mapping.ParameterMapping[],
  ): React.ReactNode {
    if (mappings.length === 0) return undefined
    const defaultMappingStyles: Record<string, MappingStyle> = {}
    const mappingMetadata: {
      [mappingUID: string]: dmv.metadata.ParametricMap[]
    } = {}
    mappings.forEach((mapping) => {
      const style = this.volumeViewer.getParameterMappingStyle(mapping.uid)
      defaultMappingStyles[mapping.uid] = {
        opacity: style.opacity,
        paletteColorLookupTable: style.paletteColorLookupTable ?? undefined,
      }
      mappingMetadata[mapping.uid] =
        this.volumeViewer.getParameterMappingMetadata(mapping.uid)
    })
    this.panelStyles.mappings = reuseEqualStyles(
      this.panelStyles.mappings,
      defaultMappingStyles,
    )
    return (
      <ParametricMapsSection
        mappings={mappings}
        metadata={mappingMetadata}
        defaultMappingStyles={this.panelStyles.mappings}
        visibleMappingUIDs={this.state.visibleMappingUIDs}
        onMappingVisibilityChange={this.handleMappingVisibilityChange}
        onMappingStyleChange={this.handleMappingStyleChange}
        displaySettings={{
          interpolationEnabled: this.state.isParametricMapInterpolationEnabled,
        }}
        onDisplaySettingsChange={this.handleParametricMapDisplaySettingsChange}
      />
    )
  }

  private renderAnnotationGroupsSection(
    annotationGroups: dmv.annotation.AnnotationGroup[],
  ): React.ReactNode {
    if (annotationGroups.length === 0) return undefined
    const annotationGroupMetadata: {
      [annotationGroupUID: string]: dmv.metadata.MicroscopyBulkSimpleAnnotations
    } = {}
    const defaultAnnotationGroupStyles: Record<string, AnnotationGroupStyle> =
      {}
    annotationGroups.forEach((annotationGroup) => {
      defaultAnnotationGroupStyles[annotationGroup.uid] =
        this.volumeViewer.getAnnotationGroupStyle(annotationGroup.uid)
      annotationGroupMetadata[annotationGroup.uid] =
        this.volumeViewer.getAnnotationGroupMetadata(annotationGroup.uid)
    })
    this.panelStyles.annotationGroups = reuseEqualStyles(
      this.panelStyles.annotationGroups,
      defaultAnnotationGroupStyles,
    )
    const groups = groupBySeries(
      annotationGroups,
      (annotationGroup) => annotationGroup.seriesInstanceUID,
    )
    const selectedSeriesUID = this.state.selectedSeriesInstanceUID ?? ALL_SERIES
    return (
      <AnnotationGroupsSection
        seriesOptions={buildSeriesOptions({
          groups,
          allLabel: 'All',
          unit: 'groups',
          describeSeries: this.getSeriesDescription,
        })}
        selectedSeriesUID={selectedSeriesUID}
        onSeriesChange={this.handleAnnotationGroupSelection}
        annotationGroups={[
          ...itemsForSeries(annotationGroups, groups, selectedSeriesUID),
        ]}
        metadata={annotationGroupMetadata}
        onAnnotationGroupClick={this.handleAnnotationGroupClick}
        defaultAnnotationGroupStyles={this.panelStyles.annotationGroups}
        visibleAnnotationGroupUIDs={this.state.visibleAnnotationGroupUIDs}
        onAnnotationGroupVisibilityChange={
          this.handleAnnotationGroupVisibilityChange
        }
        onBulkAnnotationGroupVisibilityChange={
          this.handleAnnotationGroupVisibilityChanges
        }
        onAnnotationGroupStyleChange={this.handleAnnotationGroupStyleChange}
        displaySettings={this.getAnnotationGroupDisplaySettings()}
        onDisplaySettingsChange={
          this.handleAnnotationGroupDisplaySettingsChange
        }
      />
    )
  }

  private renderAnnotationConfiguration(): React.ReactNode {
    const finding = this.state.selectedFinding
    const key = finding !== undefined ? buildKey(finding) : undefined
    return (
      <AnnotationConfigurationFields
        findings={this.findingOptions}
        selectedFinding={finding}
        evaluationOptions={
          key !== undefined ? (this.evaluationOptions[key] ?? []) : []
        }
        selectedEvaluations={this.state.selectedEvaluations}
        geometryTypes={
          key !== undefined ? (this.geometryTypeOptions[key] ?? []) : []
        }
        selectedGeometryType={this.state.selectedGeometryType}
        isMeasurementActive={this.state.selectedMarkup === 'measurement'}
        onFindingChange={this.handleAnnotationFindingSelection}
        onEvaluationChange={this.handleAnnotationEvaluationSelection}
        onEvaluationClear={this.handleAnnotationEvaluationClearance}
        onGeometryTypeChange={this.handleAnnotationGeometryTypeSelection}
        onMeasurementChange={this.handleAnnotationMeasurementActivation}
      />
    )
  }

  /**
   * Built only while the dialog is open; the last body is kept so it does
   * not vanish during the close animation.
   */
  private renderSelectedRoiInformation(): React.ReactNode {
    const roi = this.state.selectedRoi
    if (this.state.isSelectedRoiModalVisible) {
      this.selectedRoiInformation =
        roi !== undefined && roi !== null ? (
          <RoiDescription
            description={buildRoiDescription(
              roi,
              this.volumeViewer
                .getAllROIs()
                .findIndex((r) => r.uid === roi.uid),
              this.preferences.units,
            )}
          />
        ) : undefined
    }
    return this.selectedRoiInformation
  }

  private readonly getVolumeMap = (): OlMap => this.volumeViewer.getMap()

  private readonly handleRightPanelToggle = (): void => {
    this.setState((state) => ({ isRightPanelOpen: !state.isRightPanelOpen }))
  }

  render = (): React.ReactNode => {
    const { rois, segments, mappings, annotationGroups, annotations } =
      this.getDataFromViewer()
    const viewerKey = `${this.props.studyInstanceUID}/${this.props.seriesInstanceUID}/${this.state.viewerGeneration}`
    const metadata = this.props.slide.volumeImages[0]

    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1">
        <SlideViewerContent
          toolbar={
            <ViewerToolbar
              isLeftPanelOpen={this.props.isLeftPanelOpen ?? true}
              onToggleLeftPanel={this.props.onToggleLeftPanel}
              isRightPanelOpen={this.state.isRightPanelOpen}
              onToggleRightPanel={this.handleRightPanelToggle}
              enableAnnotationTools={this.props.enableAnnotationTools}
              activeTool={deriveActiveRoiTool(this.state)}
              areRoisHidden={this.state.areRoisHidden}
              onDraw={this.handleRoiDrawing}
              onModify={this.handleRoiModification}
              onTranslate={this.handleRoiTranslation}
              onRemove={this.handleRoiRemoval}
              onToggleRoiVisibility={this.handleRoiVisibilityChange}
              onSave={this.handleReportGeneration}
              onGoTo={this.handleGoTo}
            />
          }
          overlays={
            <>
              <ViewportOverlays
                key={viewerKey}
                getMap={this.getVolumeMap}
                slideAffine={this.slideAffine}
                slideId={getSlideDisplayId(this.props.slide)}
                slideDescription={getSlideStainInfo(this.props.slide)}
              />
              <ViewportLoadingIndicator
                isVisible={isViewportLoading(this.state.viewportLoadingPhase)}
                label="Loading slide"
              />
            </>
          }
          footer={
            <ViewerFooter
              resetKey={viewerKey}
              enableMemoryMonitoring={this.props.enableMemoryMonitoring ?? true}
              sopInstanceUIDs={this.volumeSopInstanceUIDs}
            />
          }
          cursor={this.state.isLoading ? 'progress' : 'default'}
          isFluorescence={this.props.slide.areVolumeImagesMonochrome}
          volumeViewportRef={this.volumeViewportRef}
          onViewportResize={this.onViewportResize}
        >
          <SlideViewerModals
            isAnnotationModalVisible={this.state.isAnnotationModalVisible}
            onAnnotationConfigurationCompletion={
              this.handleAnnotationConfigurationCompletion
            }
            onAnnotationConfigurationCancellation={
              this.handleAnnotationConfigurationCancellation
            }
            isAnnotationOkDisabled={
              this.state.selectedFinding === undefined ||
              this.state.selectedGeometryType === undefined
            }
            annotationConfigurations={this.renderAnnotationConfiguration()}
            isSelectedRoiModalVisible={this.state.isSelectedRoiModalVisible}
            onRoiSelectionCancellation={this.handleRoiSelectionCancellation}
            selectedRoiInformation={this.renderSelectedRoiInformation()}
            isGoToModalVisible={this.state.isGoToModalVisible}
            goToInput={this.state.goToInput}
            goToRanges={this.getGoToRanges()}
            onGoToInputChange={this.handleGoToInputChange}
            onSlidePositionSelection={this.handleSlidePositionSelection}
            onSlidePositionSelectionCancellation={
              this.handleSlidePositionSelectionCancellation
            }
            isReportModalVisible={this.state.isReportModalVisible}
            onReportVerification={this.handleReportVerification}
            onReportCancellation={this.handleReportCancellation}
            report={this.getReport()}
          />
          <ConfirmDialog
            open={this.state.isRoiRemovalConfirmVisible}
            title={
              this.state.selectedRoiUIDs.size > 0
                ? 'Remove selected annotations?'
                : 'Remove all visible annotations?'
            }
            description="Unsaved annotations cannot be recovered."
            confirmLabel="Remove"
            variant="destructive"
            onConfirm={this.handleRoiRemovalConfirmation}
            onCancel={this.handleRoiRemovalCancellation}
          />
        </SlideViewerContent>

        <SlideViewerSidebar
          isOpen={this.state.isRightPanelOpen}
          labelViewportRef={this.setLabelViewport}
          labelViewer={this.labelViewer}
          specimenMenu={<SpecimensSection metadata={metadata} />}
          equipmentMenu={<EquipmentSection metadata={metadata} />}
          opticalPathMenu={this.renderOpticalPathsSection()}
          presentationStateMenu={
            <PresentationStatesSection
              presentationStates={this.state.presentationStates}
              selectedPresentationStateUID={
                this.state.selectedPresentationStateUID ?? undefined
              }
              onSelect={this.handlePresentationStateSelection}
              onReset={this.handlePresentationStateReset}
            />
          }
          annotationMenu={
            <AnnotationsSection
              enableAnnotationTools={this.props.enableAnnotationTools}
              rois={rois}
              selectedRoiUIDs={this.state.selectedRoiUIDs}
              visibleRoiUIDs={this.state.visibleRoiUIDs}
              getRoiColor={this.getRoiColor}
              onSelection={this.handleAnnotationSelection}
              onVisibilityChange={this.handleAnnotationVisibilityChange}
              onBulkVisibilityChange={this.handleAnnotationVisibilityChanges}
            />
          }
          annotationGroupMenu={this.renderAnnotationGroupsSection(
            annotationGroups,
          )}
          annotationCategoryMenu={
            <AnnotationCategoriesSection
              annotations={annotations}
              onChange={this.handleAnnotationVisibilityChanges}
              checkedAnnotationUids={this.state.visibleRoiUIDs}
              onStyleChange={this.handleRoiStylesChange}
              defaultAnnotationStyles={this.defaultAnnotationStyles}
            />
          }
          segmentationMenu={this.renderSegmentationsSection(segments)}
          parametricMapMenu={this.renderParametricMapsSection(mappings)}
        />

        <HoveredRoiTooltipLayer store={this.hoveredRoiTooltipStore} />
      </div>
    )
  }
}

export default withRouter(SlideViewer)
