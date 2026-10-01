/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
import { v4 as generateUUID } from 'uuid'

import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { CustomError, errorTypes } from './CustomError'
import type { KeyValueItem } from './keyValue'
import { findContentItemsByName, hasValueType } from './sr'

type ContentItem = dcmjs.sr.valueTypes.ContentItem
type CodeContentItem = dcmjs.sr.valueTypes.CodeContentItem
type TextContentItem = dcmjs.sr.valueTypes.TextContentItem
type NumContentItem = dcmjs.sr.valueTypes.NumContentItem
type Scoord3DContentItem = dcmjs.sr.valueTypes.Scoord3DContentItem
type EvaluationItem = CodeContentItem | TextContentItem

export type MeasurementReportDocument = Pick<
  dmv.metadata.Comprehensive3DSR,
  'ContentSequence'
>

export interface ParsedMeasurementReport {
  SpecimenUID?: string
  SpecimenIdentifier?: string
  ContainerIdentifier?: string
  PersonObserverName?: string
  PersonObserverLoginName?: string
  DeviceObserverUID?: string
  DeviceObserverName?: string
  ROIs: dmv.roi.ROI[]
  /** Template violations found while parsing, in document order */
  warnings: string[]
}

const TID_1410_CONTEXT =
  'Content of Comprehensive 3D SR document is not structured ' +
  'based on TID 1500 "Measurement Report" -> ' +
  'TID 1410 "Planar ROI Measurements and Qualitative Evaluations".'

const TID_1009_CONTEXT =
  'Content of Comprehensive 3D SR document is not structured based on ' +
  'TID 1500 "Measurement Report" -> TID 1001 "Observation Context" -> ' +
  'TID 1006 "Subject Context" -> TID 1009 "Subject Context, Specimen".'

function concept(
  value: string,
  meaning: string,
  schemeDesignator = 'DCM',
): dcmjs.sr.coding.CodedConcept {
  return new dcmjs.sr.coding.CodedConcept({ value, schemeDesignator, meaning })
}

const CONCEPTS = {
  imagingMeasurements: concept('126010', 'Imaging Measurements'),
  measurementGroup: concept('125007', 'Measurement Group'),
  trackingUID: concept('112040', 'Tracking Unique Identifier'),
  finding: concept('121071', 'Finding'),
  algorithmName: concept('111001', 'Algorithm Name'),
  algorithmVersion: concept('111003', 'Algorithm Version'),
  imageRegion: concept('111030', 'Image Region'),
  specimenUID: concept('121039', 'Specimen UID'),
  specimenIdentifier: concept('121041', 'Specimen Identifier'),
  containerIdentifier: concept('111700', 'Specimen Container Identifier'),
  personObserverName: concept('121008', 'Person Observer Name'),
  personObserverLoginName: concept('128774', "Person Observer's Login Name"),
  deviceObserverUID: concept('121012', 'Device Observer UID'),
  deviceObserverName: concept('121013', 'Device Observer Name'),
}

function isNumItem(item: ContentItem): item is NumContentItem {
  return hasValueType(item, dcmjs.sr.valueTypes.ValueTypes.NUM)
}

function isCodeItem(item: ContentItem): item is CodeContentItem {
  return hasValueType(item, dcmjs.sr.valueTypes.ValueTypes.CODE)
}

function isTextItem(item: ContentItem): item is TextContentItem {
  return hasValueType(item, dcmjs.sr.valueTypes.ValueTypes.TEXT)
}

function isScoord3DItem(item: ContentItem): item is Scoord3DContentItem {
  return (
    'GraphicType' in item &&
    'GraphicData' in item &&
    Array.isArray(item.GraphicData)
  )
}

/** String attribute of a content item, whatever its declared value type */
function readString(
  item: ContentItem | undefined,
  key: 'UID' | 'TextValue' | 'PersonName',
): string | undefined {
  if (item === undefined) return undefined
  const value: unknown = Reflect.get(item, key)
  return typeof value === 'string' ? value : undefined
}

function findFirst(
  content: ContentItem[] | undefined,
  name: dcmjs.sr.coding.CodedConcept,
): ContentItem | undefined {
  return findContentItemsByName({ content: content ?? [], name })[0]
}

function toTriplets(data: number[]): number[][] {
  const coordinates: number[][] = []
  for (let i = 0; i < data.length; i += 3) {
    coordinates.push(data.slice(i, i + 3))
  }
  return coordinates
}

function createScoord3D(
  region: Scoord3DContentItem,
): dmv.scoord3d.Scoord3D | undefined {
  const frameOfReferenceUID = region.ReferencedFrameOfReferenceUID
  if (region.GraphicType === 'POINT') {
    return new dmv.scoord3d.Point({
      frameOfReferenceUID,
      coordinates: region.GraphicData,
    })
  }
  const coordinates = toTriplets(region.GraphicData)
  switch (region.GraphicType) {
    case 'POLYGON':
      return new dmv.scoord3d.Polygon({ frameOfReferenceUID, coordinates })
    case 'MULTIPOINT':
      return new dmv.scoord3d.MultiPoint({ frameOfReferenceUID, coordinates })
    case 'POLYLINE':
      return new dmv.scoord3d.Polyline({ frameOfReferenceUID, coordinates })
    case 'ELLIPSE':
      return new dmv.scoord3d.Ellipse({ frameOfReferenceUID, coordinates })
    case 'ELLIPSOID':
      return new dmv.scoord3d.Ellipsoid({ frameOfReferenceUID, coordinates })
    default:
      return undefined
  }
}

function parseMeasurementGroup(
  group: ContentItem,
  warnings: string[],
): dmv.roi.ROI | undefined {
  const content = group.ContentSequence ?? []

  const trackingUID = readString(
    findFirst(content, CONCEPTS.trackingUID),
    'UID',
  )
  if (trackingUID === undefined) {
    warnings.push(
      `Content item "Tracking Unique Identifier" not found. ${TID_1410_CONTEXT}`,
    )
    return undefined
  }

  if (findFirst(content, CONCEPTS.finding) === undefined) {
    warnings.push(`Content item "Finding" not found. ${TID_1410_CONTEXT}`)
  }

  const evaluations: EvaluationItem[] = []
  const algorithmName = findFirst(content, CONCEPTS.algorithmName)
  const observerType = algorithmName !== undefined ? 'Device' : 'Person'
  const algorithmVersion = findFirst(content, CONCEPTS.algorithmVersion)
  for (const item of [algorithmName, algorithmVersion]) {
    if (item !== undefined && (isCodeItem(item) || isTextItem(item))) {
      evaluations.push(item)
    }
  }

  const region = findFirst(content, CONCEPTS.imageRegion)
  if (region === undefined || !isScoord3DItem(region)) {
    warnings.push(`Content item "Image Region" not found. ${TID_1410_CONTEXT}`)
    return undefined
  }
  const scoord3d = createScoord3D(region)
  if (scoord3d === undefined) {
    warnings.push(
      'Content item "Image Region" has unknown graphic type ' +
        `"${region.GraphicType}". ${TID_1410_CONTEXT}`,
    )
    return undefined
  }

  evaluations.push(...content.filter(isCodeItem))

  return new dmv.roi.ROI({
    scoord3d,
    uid: generateUUID(),
    properties: {
      trackingUID,
      observerType,
      evaluations,
      measurements: content.filter(isNumItem),
    },
  })
}

function parseROIs(
  report: MeasurementReportDocument,
  warnings: string[],
): dmv.roi.ROI[] {
  /** TID 1500 Measurement Report */
  const matches = findContentItemsByName({
    content: report.ContentSequence,
    name: CONCEPTS.imagingMeasurements,
  })
  if (matches.length !== 1) {
    warnings.push(
      'Content item "Imaging Measurements" not found. ' +
        'Content of Comprehensive 3D SR document is not structured based on ' +
        'TID 1500 "Measurement Report".',
    )
  }
  const measurementsItem = matches[0]
  if (measurementsItem === undefined) return []

  /** TID 1410 Planar ROI Measurements and Qualitative Evaluations */
  const groups = findContentItemsByName({
    content: measurementsItem.ContentSequence ?? [],
    name: CONCEPTS.measurementGroup,
  })
  const rois: dmv.roi.ROI[] = []
  for (const group of groups) {
    const roi = parseMeasurementGroup(group, warnings)
    if (roi !== undefined) rois.push(roi)
  }
  return rois
}

function readRequiredString(
  content: ContentItem[],
  name: dcmjs.sr.coding.CodedConcept,
  key: 'UID' | 'TextValue',
  warnings: string[],
): string | undefined {
  const item = findFirst(content, name)
  if (item === undefined) {
    warnings.push(
      `Content item "${name.CodeMeaning}" not found. ${TID_1009_CONTEXT}`,
    )
  }
  return readString(item, key)
}

/**
 * Reads the observer and specimen context and the planar ROIs of a TID 1500
 * Measurement Report. Missing content is reported in `warnings` instead of
 * throwing; ROIs whose measurement group is incomplete are skipped.
 */
export function parseMeasurementReport(
  report: MeasurementReportDocument,
): ParsedMeasurementReport {
  const warnings: string[] = []
  const content = report.ContentSequence ?? []
  const SpecimenUID = readRequiredString(
    content,
    CONCEPTS.specimenUID,
    'UID',
    warnings,
  )
  const SpecimenIdentifier = readRequiredString(
    content,
    CONCEPTS.specimenIdentifier,
    'TextValue',
    warnings,
  )
  const ContainerIdentifier = readRequiredString(
    content,
    CONCEPTS.containerIdentifier,
    'TextValue',
    warnings,
  )
  return {
    SpecimenUID,
    SpecimenIdentifier,
    ContainerIdentifier,
    PersonObserverName: readString(
      findFirst(content, CONCEPTS.personObserverName),
      'PersonName',
    ),
    PersonObserverLoginName: readString(
      findFirst(content, CONCEPTS.personObserverLoginName),
      'TextValue',
    ),
    DeviceObserverUID: readString(
      findFirst(content, CONCEPTS.deviceObserverUID),
      'UID',
    ),
    DeviceObserverName: readString(
      findFirst(content, CONCEPTS.deviceObserverName),
      'TextValue',
    ),
    ROIs: parseROIs(report, warnings),
    warnings,
  }
}

/** Concept name / value rows of the CODE and TEXT evaluations of an ROI */
export function describeEvaluations(
  evaluations: readonly EvaluationItem[],
): KeyValueItem[] {
  const items: KeyValueItem[] = []
  for (const item of evaluations) {
    const label = item.ConceptNameCodeSequence[0]?.CodeMeaning ?? ''
    if (isCodeItem(item)) {
      items.push({ label, value: item.ConceptCodeSequence[0]?.CodeMeaning })
    } else if (isTextItem(item)) {
      items.push({ label, value: item.TextValue })
    }
  }
  return items
}

/** Surfaces parser warnings as Slim error notifications */
export function notifyMeasurementReportWarnings(
  warnings: readonly string[],
): void {
  for (const warning of warnings) {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(errorTypes.ENCODINGANDDECODING, warning),
    )
  }
}

/**
 * Parsed measurement report that notifies its warnings on construction.
 * Use `parseMeasurementReport` where notifications must not fire (render).
 */
export class MeasurementReport implements ParsedMeasurementReport {
  public SpecimenUID?: string

  public SpecimenIdentifier?: string

  public ContainerIdentifier?: string

  public PersonObserverName?: string

  public PersonObserverLoginName?: string

  public DeviceObserverUID?: string

  public DeviceObserverName?: string

  public ROIs: dmv.roi.ROI[]

  public warnings: string[]

  constructor(report: MeasurementReportDocument) {
    const parsed = parseMeasurementReport(report)
    this.SpecimenUID = parsed.SpecimenUID
    this.SpecimenIdentifier = parsed.SpecimenIdentifier
    this.ContainerIdentifier = parsed.ContainerIdentifier
    this.PersonObserverName = parsed.PersonObserverName
    this.PersonObserverLoginName = parsed.PersonObserverLoginName
    this.DeviceObserverUID = parsed.DeviceObserverUID
    this.DeviceObserverName = parsed.DeviceObserverName
    this.ROIs = parsed.ROIs
    this.warnings = parsed.warnings
    notifyMeasurementReportWarnings(parsed.warnings)
  }
}
