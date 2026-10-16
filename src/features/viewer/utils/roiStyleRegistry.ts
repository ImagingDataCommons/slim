/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import {
  DEFAULT_ANNOTATION_COLOR_PALETTE,
  DEFAULT_ANNOTATION_OPACITY,
  DEFAULT_ANNOTATION_STROKE_COLOR,
} from '../../../components/SlideViewer/constants'
import { formatRoiStyle } from '../../../components/SlideViewer/utils/roiUtils'
import type { AnnotationStyle } from '../../../types/layerStyles'

type RoiStyle = dmv.viewer.ROIStyleOptions

/** ROI style for an annotation-list style; `radius` sizes point markers. */
export function annotationStyleToRoiStyle(
  styleOptions: AnnotationStyle,
  radius: number | undefined,
): RoiStyle {
  const opacity = styleOptions.opacity ?? DEFAULT_ANNOTATION_OPACITY
  const strokeColor = styleOptions.color ?? DEFAULT_ANNOTATION_STROKE_COLOR
  const fillColor = styleOptions.contourOnly
    ? [0, 0, 0, 0]
    : strokeColor.map((c) => Math.min(c + 25, 255))
  return formatRoiStyle({
    fill: { color: [...fillColor, opacity] },
    stroke: { color: [...strokeColor, opacity] },
    radius,
  })
}

/**
 * ROI styles of one viewer: configured per-finding styles, finding styles
 * picked up while ROIs are added or restyled, styles owned by single ROIs,
 * and the annotation-list style of every ROI. Finding keys are
 * `codedConceptKey` values.
 */
export class RoiStyleRegistry {
  private readonly configured: Readonly<Record<string, RoiStyle>>
  private readonly findingStyles: Record<string, RoiStyle> = {}
  private readonly stylesByUid: Record<string, RoiStyle> = {}
  private readonly annotationStyles: Record<string, AnnotationStyle> = {}

  /** Each finding starts with its configured style, else `defaultStyle` */
  constructor({
    configuredStyles,
    findingKeys,
    defaultStyle,
  }: {
    configuredStyles: Readonly<Record<string, RoiStyle>>
    findingKeys: readonly string[]
    defaultStyle: RoiStyle
  }) {
    this.configured = configuredStyles
    for (const key of findingKeys) {
      this.findingStyles[key] = configuredStyles[key] ?? defaultStyle
    }
  }

  findingStyle(key: string | undefined, defaultStyle: RoiStyle): RoiStyle {
    if (key === undefined) return defaultStyle
    return this.findingStyles[key] ?? defaultStyle
  }

  /** An ROI's own style (drawn or recolored) wins over its finding's style */
  styleForRoi(
    uid: string,
    key: string | undefined,
    defaultStyle: RoiStyle,
  ): RoiStyle {
    return this.stylesByUid[uid] ?? this.findingStyle(key, defaultStyle)
  }

  /** Style for a newly drawn ROI of a finding (also used for the preview) */
  drawStyle(key: string | undefined, defaultStyle: RoiStyle): RoiStyle {
    if (key === undefined) return defaultStyle
    return this.configured[key] ?? defaultStyle
  }

  /** Fill color of a finding's style, used for annotation groups */
  findingFillColor(key: string): number[] | undefined {
    return this.findingStyles[key]?.fill?.color
  }

  /** Keep `style` for a user-added ROI unless it is its finding's configured style */
  recordAddedRoi(uid: string, key: string | undefined, style: RoiStyle): void {
    if (key === undefined || this.configured[key] !== style) {
      this.stylesByUid[uid] = style
    }
  }

  /**
   * Record the list style of a newly added ROI and give its finding a
   * palette style when neither the ROI nor the finding has one.
   */
  registerAnnotationStyle(
    uid: string,
    key: string | undefined,
    radius: number | undefined,
  ): void {
    if (this.annotationStyles[uid] !== undefined) return
    const ownStyle = this.stylesByUid[uid]
    const findingStyle = key !== undefined ? this.findingStyles[key] : undefined
    const color =
      (ownStyle ?? findingStyle)?.stroke?.color.slice(0, 3) ??
      DEFAULT_ANNOTATION_COLOR_PALETTE[
        Object.keys(this.findingStyles).length %
          DEFAULT_ANNOTATION_COLOR_PALETTE.length
      ]
    const annotationStyle: AnnotationStyle = {
      color,
      opacity: DEFAULT_ANNOTATION_OPACITY,
      contourOnly: false,
    }
    this.annotationStyles[uid] = annotationStyle
    if (
      key !== undefined &&
      ownStyle === undefined &&
      findingStyle === undefined
    ) {
      this.findingStyles[key] = annotationStyleToRoiStyle(
        annotationStyle,
        radius,
      )
    }
  }

  /** Restyle an ROI from the category list; its finding follows */
  applyAnnotationStyle(
    uid: string,
    key: string | undefined,
    styleOptions: AnnotationStyle,
    style: RoiStyle,
  ): void {
    this.annotationStyles[uid] = styleOptions
    if (key !== undefined) {
      this.findingStyles[key] = style
    }
    this.stylesByUid[uid] = style
  }

  forget(uid: string): void {
    delete this.stylesByUid[uid]
    delete this.annotationStyles[uid]
  }

  /** Copy of the annotation-list styles, keyed by ROI UID */
  copyAnnotationStyles(): Record<string, AnnotationStyle> {
    return { ...this.annotationStyles }
  }
}
