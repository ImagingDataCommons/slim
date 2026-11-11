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

/**
 * ROI style for an annotation-list style. Finding color/opacity come from the
 * list; stroke width and point radius come from the caller's drawing defaults
 * (usually the user preferences).
 */
export function annotationStyleToRoiStyle(
  styleOptions: AnnotationStyle,
  { radius, strokeWidth }: { radius?: number; strokeWidth?: number } = {},
): RoiStyle {
  const opacity = styleOptions.opacity ?? DEFAULT_ANNOTATION_OPACITY
  const strokeColor = styleOptions.color ?? DEFAULT_ANNOTATION_STROKE_COLOR
  const fillColor = styleOptions.contourOnly
    ? [0, 0, 0, 0]
    : strokeColor.map((c) => Math.min(c + 25, 255))
  return formatRoiStyle({
    fill: { color: [...fillColor, opacity] },
    stroke: { color: [...strokeColor, opacity], width: strokeWidth },
    radius,
  })
}

/**
 * ROI styles of one viewer: configured per-finding styles, finding styles
 * picked up while ROIs are added or restyled, styles owned by single ROIs,
 * and the annotation-list style of every ROI. Finding keys are
 * `codedConceptKey` values.
 */
/**
 * Fill alpha from an ROI style, when the 4th channel is a finite number.
 */
export function roiFillAlpha(style: RoiStyle | undefined): number | undefined {
  const alpha = style?.fill?.color?.[3]
  return typeof alpha === 'number' && Number.isFinite(alpha) ? alpha : undefined
}

export class RoiStyleRegistry {
  private readonly configured: Readonly<Record<string, RoiStyle>>
  private readonly findingStyles: Record<string, RoiStyle> = {}
  private readonly stylesByUid: Record<string, RoiStyle> = {}
  private readonly annotationStyles: Record<string, AnnotationStyle> = {}
  /**
   * ROIs still following Preferences → Annotations draw style (not recolored
   * from the category chips). Preference changes restyle these live.
   */
  private readonly preferenceStyledUids = new Set<string>()
  /**
   * Draw styles built from a finding's configured colors, cached per finding
   * and drawing width so the draw interaction gets a stable object. ROIs drawn
   * with one keep their finding color when preferences change.
   */
  private readonly findingDrawStyles = new Map<string, RoiStyle>()
  private readonly findingDrawStyleSet = new WeakSet<RoiStyle>()

  /**
   * Seed only findings that have a viewer-config style. Findings without one
   * fall back to the live `defaultStyle` argument on each lookup, so stroke
   * preferences stay current for the session.
   */
  constructor({
    configuredStyles,
    findingKeys,
  }: {
    configuredStyles: Readonly<Record<string, RoiStyle>>
    findingKeys: readonly string[]
  }) {
    this.configured = configuredStyles
    for (const key of findingKeys) {
      const style = configuredStyles[key]
      if (style !== undefined) {
        this.findingStyles[key] = style
      }
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

  /**
   * Style for a newly drawn ROI (and the draw preview). With
   * `useFindingColors`, a finding that has a configured style keeps its
   * colors and takes stroke width and point radius from the preference
   * default; otherwise the live preference default is used as is.
   */
  drawStyle(
    key: string | undefined,
    defaultStyle: RoiStyle,
    useFindingColors = true,
  ): RoiStyle {
    if (!useFindingColors || key === undefined) return defaultStyle
    const configured = this.configured[key]
    if (configured === undefined) return defaultStyle
    const strokeWidth = defaultStyle.stroke?.width
    const radius = defaultStyle.image?.circle?.radius
    const cacheKey = `${key}|${strokeWidth}|${radius}`
    const cached = this.findingDrawStyles.get(cacheKey)
    if (cached !== undefined) return cached
    const style = formatRoiStyle({
      stroke: {
        color: configured.stroke?.color,
        width: strokeWidth ?? configured.stroke?.width,
      },
      fill: { color: configured.fill?.color },
      radius,
    })
    this.findingDrawStyles.set(cacheKey, style)
    this.findingDrawStyleSet.add(style)
    return style
  }

  /** Fill color of a finding's style, used for annotation groups */
  findingFillColor(key: string): number[] | undefined {
    return this.findingStyles[key]?.fill?.color
  }

  /**
   * Keep `style` for a user-added ROI unless it matches the finding's
   * configured style exactly (color and width unchanged by preferences).
   */
  recordAddedRoi(uid: string, key: string | undefined, style: RoiStyle): void {
    if (key !== undefined && this.configured[key] === style) return
    this.stylesByUid[uid] = style
    /** Drawn in its finding's color: Preferences changes must not recolor it */
    if (!this.findingDrawStyleSet.has(style)) {
      this.preferenceStyledUids.add(uid)
    }
  }

  /**
   * Record the list style of a newly added ROI and give its finding a
   * palette style when neither the ROI nor the finding has one.
   */
  registerAnnotationStyle(
    uid: string,
    key: string | undefined,
    { radius, strokeWidth }: { radius?: number; strokeWidth?: number } = {},
  ): void {
    if (this.annotationStyles[uid] !== undefined) return
    const ownStyle = this.stylesByUid[uid]
    const findingStyle = key !== undefined ? this.findingStyles[key] : undefined
    const stroke = (ownStyle ?? findingStyle)?.stroke?.color
    const color =
      stroke !== undefined && stroke.length >= 3
        ? [stroke[0], stroke[1], stroke[2]]
        : DEFAULT_ANNOTATION_COLOR_PALETTE[
            Object.keys(this.findingStyles).length %
              DEFAULT_ANNOTATION_COLOR_PALETTE.length
          ]
    const fillAlpha = roiFillAlpha(ownStyle)
    const annotationStyle: AnnotationStyle = {
      color,
      opacity: fillAlpha ?? DEFAULT_ANNOTATION_OPACITY,
      contourOnly: fillAlpha === 0,
    }
    this.annotationStyles[uid] = annotationStyle
    if (
      key !== undefined &&
      ownStyle === undefined &&
      findingStyle === undefined
    ) {
      this.findingStyles[key] = annotationStyleToRoiStyle(annotationStyle, {
        radius,
        strokeWidth,
      })
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
    /** Chip edits leave Preferences control for this ROI */
    this.preferenceStyledUids.delete(uid)
  }

  /**
   * Push live Preferences draw style onto ROIs that still follow preferences.
   * Returns the UIDs that were updated (caller should `setROIStyle`).
   */
  applyPreferenceDefaults(defaultStyle: RoiStyle): string[] {
    const uids = [...this.preferenceStyledUids]
    const fillAlpha = roiFillAlpha(defaultStyle)
    const stroke = defaultStyle.stroke?.color
    for (const uid of uids) {
      this.stylesByUid[uid] = defaultStyle
      const ann = this.annotationStyles[uid]
      if (ann !== undefined && stroke !== undefined && stroke.length >= 3) {
        this.annotationStyles[uid] = {
          ...ann,
          color: [stroke[0], stroke[1], stroke[2]],
          opacity: fillAlpha ?? ann.opacity,
          contourOnly: fillAlpha === 0,
        }
      }
    }
    return uids
  }

  forget(uid: string): void {
    delete this.stylesByUid[uid]
    delete this.annotationStyles[uid]
    this.preferenceStyledUids.delete(uid)
  }

  /** Copy of the annotation-list styles, keyed by ROI UID */
  copyAnnotationStyles(): Record<string, AnnotationStyle> {
    return { ...this.annotationStyles }
  }
}
