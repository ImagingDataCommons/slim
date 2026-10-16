/** Option builders for the viewer's Radix selects (values must be unique, non-empty strings). */
import {
  type CodedConceptLike as BaseCodedConcept,
  isSameCodedConcept,
} from '../../../utils/dicom/codedConcept'

/** Select value standing for "no presentation state" (Radix forbids ''). */
export const DEFAULT_PRESENTATION_STATE_VALUE = '__default__'

/** Select value that clears an evaluation. */
export const NO_EVALUATION_VALUE = '__none__'

/** Option labels need a meaning */
export interface CodedConceptLike extends BaseCodedConcept {
  CodeMeaning: string
}

export interface SelectOption<T = undefined> {
  value: string
  label: string
  item: T
}

/**
 * One option per concept, valued "<scheme>-<code>". Concepts without a code
 * or repeating an earlier value get "<prefix>-<index>" so values stay unique.
 */
export function buildCodedConceptOptions<T extends CodedConceptLike>(
  concepts: readonly T[],
  fallbackPrefix: string,
): Array<SelectOption<T>> {
  const used = new Set<string>()
  return concepts.map((concept, index) => {
    const code = concept.CodeValue ?? ''
    const candidate =
      code !== '' ? `${concept.CodingSchemeDesignator ?? ''}-${code}` : ''
    const value =
      candidate !== '' && !used.has(candidate)
        ? candidate
        : `${fallbackPrefix}-${index}`
    used.add(value)
    return { value, label: concept.CodeMeaning, item: concept }
  })
}

/** Value of the option whose concept equals `concept`, or '' (placeholder). */
export function selectedConceptValue<T extends CodedConceptLike>(
  options: ReadonlyArray<SelectOption<T>>,
  concept: CodedConceptLike | undefined,
): string {
  if (concept === undefined) return ''
  return (
    options.find((option) => isSameCodedConcept(option.item, concept))?.value ??
    ''
  )
}

export function findOptionItem<T>(
  options: ReadonlyArray<SelectOption<T>>,
  value: string,
): T | undefined {
  return options.find((option) => option.value === value)?.item
}

const GEOMETRY_TYPE_LABELS: { [name: string]: string } = {
  point: 'Point',
  circle: 'Circle',
  box: 'Box',
  polygon: 'Polygon',
  line: 'Line',
  freehandpolygon: 'Polygon (freehand)',
  freehandline: 'Line (freehand)',
}

export function buildGeometryTypeOptions(
  names: readonly string[],
): Array<SelectOption> {
  return Array.from(new Set(names)).map((name) => ({
    value: name,
    label: GEOMETRY_TYPE_LABELS[name] ?? name,
    item: undefined,
  }))
}

export interface PresentationStateLike {
  SOPInstanceUID?: string
  ContentDescription?: string
}

/** Presentation state options followed by the "Default" sentinel. */
export function buildPresentationStateOptions(
  presentationStates: readonly PresentationStateLike[],
): Array<SelectOption> {
  const used = new Set<string>([DEFAULT_PRESENTATION_STATE_VALUE])
  const options = presentationStates.map((instance, index) => {
    const uid = instance.SOPInstanceUID ?? ''
    const value =
      uid !== '' && !used.has(uid) ? uid : `presentation-state-${index}`
    used.add(value)
    const description = instance.ContentDescription ?? ''
    return {
      value,
      label: description !== '' ? description : 'Untitled',
      item: undefined,
    }
  })
  options.push({
    value: DEFAULT_PRESENTATION_STATE_VALUE,
    label: 'Default',
    item: undefined,
  })
  return options
}

/** Select value for a presentation state UID; the sentinel when none. */
export function toPresentationStateValue(uid: string | undefined): string {
  return uid !== undefined && uid !== ''
    ? uid
    : DEFAULT_PRESENTATION_STATE_VALUE
}

/** Presentation state UID for a select value; `undefined` for the sentinel. */
export function fromPresentationStateValue(value: string): string | undefined {
  return value === DEFAULT_PRESENTATION_STATE_VALUE ? undefined : value
}
