/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import type DicomWebManager from '../../../DicomWebManager'
import type { Slide } from '../../../data/slides'
import { logger } from '../../../utils/logger'
import { planDefaultOpticalPaths } from '../utils/opticalPathDefaults'
import type { PixelStatistics } from '../utils/pixelStatistics'
import {
  matchBlendingItems,
  referencesSlideSeries,
  windowLimitValues,
} from '../utils/presentationState'
import { notifyVisualizationError } from './derivedDataLoaders'

type PresentationState = dmv.metadata.AdvancedBlendingPresentationState
type VolumeViewer = dmv.viewer.VolumeImageViewer

/**
 * Retrieve the study's Presentation States and pass those that reference the
 * slide to `onPresentationState`, with their position in the search result.
 * Only monochrome slides are supported.
 */
export function loadPresentationStates({
  client,
  studyInstanceUID,
  slide,
  onPresentationState,
}: {
  client: DicomWebManager
  studyInstanceUID: string
  slide: Slide
  onPresentationState: (
    presentationState: PresentationState,
    index: number,
  ) => void
}): void {
  logger.log('search for Presentation State instances')
  client
    .searchForInstances({
      studyInstanceUID,
      queryParams: { Modality: 'PR' },
    })
    .then((matchedInstances: dwc.api.Instance[] | null): void => {
      ;(matchedInstances ?? []).forEach((rawInstance, index) => {
        const { dataset } = dmv.metadata.formatMetadata(rawInstance)
        const instance = dataset as dmv.metadata.Instance
        logger.log(`retrieve PR instance "${instance.SOPInstanceUID}"`)
        client
          .retrieveInstance({
            studyInstanceUID,
            seriesInstanceUID: instance.SeriesInstanceUID,
            sopInstanceUID: instance.SOPInstanceUID,
          })
          .then((retrievedInstance: dwc.api.Dataset): void => {
            const data = dcmjs.data.DicomMessage.readFile(retrievedInstance)
            const presentationState = dmv.metadata.formatMetadata(data.dict)
              .dataset as PresentationState
            if (!slide.areVolumeImagesMonochrome) {
              logger.log(
                `ignore presentation state "${instance.SOPInstanceUID}", ` +
                  'application of presentation states for color images ' +
                  'has not (yet) been implemented',
              )
              return
            }
            if (
              referencesSlideSeries(presentationState, slide.seriesInstanceUIDs)
            ) {
              logger.log(
                'include Advanced Blending Presentation State instance ' +
                  `"${presentationState.SOPInstanceUID}"`,
              )
              onPresentationState(presentationState, index)
            }
          })
          .catch((error: unknown) => {
            notifyVisualizationError('Presentation State could not be loaded')
            logger.error(
              'failed to load presentation state ' +
                `of SOP instance "${instance.SOPInstanceUID}" ` +
                `of series "${instance.SeriesInstanceUID}" ` +
                `of study "${studyInstanceUID}": `,
              error,
            )
          })
      })
    })
    .catch((error: unknown) => {
      logger.error(error)
      notifyVisualizationError('Presentation State could not be loaded')
    })
}

type BlendingItem = PresentationState['AdvancedBlendingSequence'][number]
type PaletteItem = BlendingItem['PaletteColorLookupTableSequence'][number]

function paletteColorLookupTable(
  item: PaletteItem,
): dmv.color.PaletteColorLookupTable {
  return new dmv.color.PaletteColorLookupTable({
    uid: item.PaletteColorLookupTableUID ?? '',
    redDescriptor: item.RedPaletteColorLookupTableDescriptor,
    greenDescriptor: item.GreenPaletteColorLookupTableDescriptor,
    blueDescriptor: item.BluePaletteColorLookupTableDescriptor,
    /**
     * Pass the LUT data through as retrieved. The element size of Palette
     * Color Lookup Table Data is governed by the third value of the
     * descriptor (bits per entry), not by the VR, so dicom-microscopy-viewer
     * reinterprets the bytes accordingly. In particular, conformant
     * Presentation States encode 8-bit entries (descriptor [n, first, 8])
     * byte-packed inside the OW element; eagerly wrapping in a Uint16Array
     * here would halve the entry count and break the LUT.
     */
    redData: item.RedPaletteColorLookupTableData ?? undefined,
    greenData: item.GreenPaletteColorLookupTableData ?? undefined,
    blueData: item.BluePaletteColorLookupTableData ?? undefined,
    redSegmentedData: item.SegmentedRedPaletteColorLookupTableData ?? undefined,
    greenSegmentedData:
      item.SegmentedGreenPaletteColorLookupTableData ?? undefined,
    blueSegmentedData:
      item.SegmentedBluePaletteColorLookupTableData ?? undefined,
  })
}

/**
 * Show exactly the optical paths a Presentation State blends, with its
 * palettes and windows. Returns the identifiers now shown.
 */
export function applyPresentationState(
  viewer: VolumeViewer,
  presentationState: PresentationState,
): Set<string> {
  logger.log(
    `apply Presentation State instance "${presentationState.SOPInstanceUID}"`,
  )
  const opticalPaths = viewer.getAllOpticalPaths()
  for (const { identifier } of opticalPaths) {
    viewer.hideOpticalPath(identifier)
    viewer.deactivateOpticalPath(identifier)
    viewer.setOpticalPathStyle(
      identifier,
      viewer.getOpticalPathDefaultStyle(identifier),
    )
  }
  const shown = new Set<string>()
  matchBlendingItems(
    opticalPaths,
    presentationState.AdvancedBlendingSequence,
  ).forEach((blendingItem, identifier) => {
    const lutItem = blendingItem.PaletteColorLookupTableSequence?.[0]
    viewer.setOpticalPathStyle(identifier, {
      opacity: 1,
      paletteColorLookupTable:
        lutItem !== undefined ? paletteColorLookupTable(lutItem) : undefined,
      limitValues: windowLimitValues(blendingItem),
    })
    viewer.activateOpticalPath(identifier)
    viewer.showOpticalPath(identifier)
    shown.add(identifier)
  })
  return shown
}

/**
 * Reset every optical path to its default style and show the viewer's
 * default selection. Returns the identifiers now shown.
 */
export function applyDefaultPresentationState(
  viewer: VolumeViewer,
  sortedOpticalPaths: readonly dmv.opticalPath.OpticalPath[],
  pixelStatistics: ReadonlyMap<string, PixelStatistics>,
): Set<string> {
  for (const { identifier } of sortedOpticalPaths) {
    viewer.setOpticalPathStyle(
      identifier,
      viewer.getOpticalPathDefaultStyle(identifier),
    )
    viewer.hideOpticalPath(identifier)
    viewer.deactivateOpticalPath(identifier)
  }
  const { visibleIdentifiers, colorAssignments } =
    planDefaultOpticalPaths(sortedOpticalPaths)
  for (const { identifier, color } of colorAssignments) {
    const stats = pixelStatistics.get(identifier)
    viewer.setOpticalPathStyle(identifier, {
      ...viewer.getOpticalPathStyle(identifier),
      color,
      ...(stats !== undefined ? { limitValues: [stats.min, stats.max] } : {}),
    })
  }
  logger.log(
    `selected n=${visibleIdentifiers.length} optical paths ` +
      'for visualization',
  )
  for (const identifier of visibleIdentifiers) {
    viewer.showOpticalPath(identifier)
  }
  return new Set(visibleIdentifiers)
}
