/** Pure validation and level choice for the "Go to position" dialog. */

export const MIN_GO_TO_MAGNIFICATION = 0
export const MAX_GO_TO_MAGNIFICATION = 40

/**
 * On an optical microscope an objective with 1x magnification corresponds to
 * approximately 10 micrometer pixel spacing (due to the ocular).
 */
const PIXEL_SPACING_AT_1X_MM = 0.01

/** Raw field text, kept as typed so the dialog stays controlled */
export interface GoToInput {
  x: string
  y: string
  magnification: string
}

export type GoToField = keyof GoToInput

export const EMPTY_GO_TO_INPUT: GoToInput = {
  x: '',
  y: '',
  magnification: '',
}

export type NumericRange = readonly [number, number]

export interface GoToRanges {
  x: NumericRange
  y: NumericRange
}

export interface GoToFieldStatus {
  isEmpty: boolean
  isValid: boolean
}

export interface GoToTarget {
  x: number
  y: number
  magnification: number
}

export interface GoToValidation {
  fields: Record<GoToField, GoToFieldStatus>
  /** Set only when every field is valid */
  target?: GoToTarget
}

function parseNumber(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function fieldStatus(
  raw: string,
  range: NumericRange,
): GoToFieldStatus & { value?: number } {
  const value = parseNumber(raw)
  const isValid = value !== undefined && value >= range[0] && value <= range[1]
  return { isEmpty: raw.trim() === '', isValid, value }
}

/** Validate the dialog fields against the slide extent and magnification. */
export function validateGoToInput(
  input: GoToInput,
  ranges: GoToRanges,
): GoToValidation {
  const x = fieldStatus(input.x, ranges.x)
  const y = fieldStatus(input.y, ranges.y)
  const magnification = fieldStatus(input.magnification, [
    MIN_GO_TO_MAGNIFICATION,
    MAX_GO_TO_MAGNIFICATION,
  ])
  const fields = {
    x: { isEmpty: x.isEmpty, isValid: x.isValid },
    y: { isEmpty: y.isEmpty, isValid: y.isValid },
    magnification: {
      isEmpty: magnification.isEmpty,
      isValid: magnification.isValid,
    },
  }
  if (
    x.value === undefined ||
    y.value === undefined ||
    magnification.value === undefined ||
    !x.isValid ||
    !y.isValid ||
    !magnification.isValid
  ) {
    return { fields }
  }
  return {
    fields,
    target: { x: x.value, y: y.value, magnification: magnification.value },
  }
}

/**
 * Index of the pyramid level whose pixel spacing (mm) is closest to the one
 * implied by `magnification`; the first level wins ties.
 */
export function choosePyramidLevel(
  magnification: number,
  pixelSpacings: readonly number[],
): number {
  const target = PIXEL_SPACING_AT_1X_MM / magnification
  let bestLevel = 0
  let bestDiff = Number.POSITIVE_INFINITY
  pixelSpacings.forEach((spacing, level) => {
    const diff = Math.abs(target - spacing)
    if (diff < bestDiff) {
      bestDiff = diff
      bestLevel = level
    }
  })
  return bestLevel
}
