/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

export type RGB = [number, number, number]

/** Lookup table rows as `[r, g, b]` entries, used to draw gradient swatches */
export interface LookupTableLike {
  data: number[][]
}

/**
 * Viewer styles arrive with `color: number[]` because `SlideViewer` builds
 * them from DMV getters; the change payloads sent back use the `RGB` tuple.
 */
export interface OpticalPathStyle {
  opacity: number
  color?: number[]
  limitValues?: number[]
  paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
}

export interface OpticalPathStyleChange {
  opacity?: number
  color?: RGB
  limitValues?: [number, number]
}

export interface SegmentStyle {
  opacity: number
  color?: number[]
  /** Drives the FRACTIONAL swatch gradient when provided */
  paletteColorLookupTable?: LookupTableLike
}

export interface SegmentStyleChange {
  opacity?: number
  color?: RGB
}

export interface MappingStyle {
  opacity: number
  /** Drives the value bar gradient when provided */
  paletteColorLookupTable?: LookupTableLike
}

export interface MappingStyleChange {
  opacity?: number
}

export interface AnnotationGroupStyle {
  opacity: number
  color: number[]
  fill?: boolean
  fillOpacity?: number
}

export interface AnnotationGroupStyleChange {
  opacity?: number
  color?: RGB
  measurement?: dcmjs.sr.coding.CodedConcept
  fill?: boolean
  fillOpacity?: number
}

/** Style of individual ROI annotations */
export interface AnnotationStyle {
  opacity: number
  color: number[]
  contourOnly: boolean
}
