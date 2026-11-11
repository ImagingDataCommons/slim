import type { JSX } from 'react'

import { SlideViewerView } from '../features/viewer/components/SlideViewerView'
import { useSlideViewerModel } from '../features/viewer/hooks/useSlideViewerModel'
import type { RouteComponentProps } from '../utils/router'
import type { SlideViewerProps } from './SlideViewer/types'

export type SlideViewerComponentProps = Omit<
  SlideViewerProps,
  keyof RouteComponentProps
>

/**
 * Interactive viewer of one digital slide (a DICOM Series of Slide
 * Microscopy images) with its annotations, segmentations, parametric maps
 * and presentation states.
 */
function SlideViewer(props: SlideViewerComponentProps): JSX.Element {
  return <SlideViewerView {...useSlideViewerModel(props)} />
}

export default SlideViewer
