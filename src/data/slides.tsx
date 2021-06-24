import * as dmv from 'dicom-microscopy-viewer'

import { SeriesState } from '../utils/types'

/**
 * Slide state
 * @params frameofReferenceUID - array of series states
 * @params containerIdentifier - array of series states
 * @params areImagesMonochrome - type of images
 * @params isMultiplexedSamples - is multi channel datasets
 * @params key - key series connected to the slide
 * @params seriesUIDsList - array of series UIDs connected to the slide
 * @params keyOpticalPathIdentifier - key optical path indentifier
 * @params opticalPathIdentifiersList - array of all optical path identifiers
 * @params description - slide description, i.e., 
 *                       Multiplexed-Samples, Monochrome Slide, RGB Slide
 * @params volumeMetadata - array of volume metadata
 * @params labelMetadata - array of label metadata
 * @params overviewMetadata - array of overview metadata
 */
class Slide {
  frameofReferenceUID: string = ''
  containerIdentifier: string = ''
  areImagesMonochrome: boolean = false
  isMultiplexedSamples: boolean = false
  key: string = ''
  seriesUIDsList: string[] = []
  keyOpticalPathIdentifier: string = ''
  opticalPathIdentifiersList: string[] = []
  description: string = ''
  volumeMetadata: object[] = []
  labelMetadata: object[] = []
  overviewMetadata: object[] = []
}

/**
 * Transforms series states array into a slide states array
 * A series state has 3 array of metadata (volume, label
 * and overview) already donwloaded.
 *
 * First we group in slides by FrameofReferenceUID and ContainerIdentifier:
 * i.e. putting togheter images (overview, label, volume) instances from N series.
 *
 * Secondly we indentify the slides as:
 *   A) If the number of opticalPathIdentifier > 1 and SamplesPerPixel === 1
 *      and PhotometricInterpretation === MONOCHROME2, then the observation is a
 *      multiplexed samples with N "channels";
 *   B) If the number of opticalPathIdentifier === 1 and SamplesPerPixel === 1
 *      and PhotometricInterpretation === MONOCHROME2, then the observation is a
 *      simple single monochorme image sample;
 *   C) If the number of opticalPathIdentifier === 1 and SamplesPerPixel !== 1
 *      and PhotometricInterpretation === RGB or YBR_*,
 *      then the observation is a RGB single image sample.
 *
 * @params seriesArray - array of series states
 * @params initiallySelectedSeriesInstanceUID - to visualize
 *         at first loading data coming from a specific series.
 * @returns slides - array of slide states
 */
function createSlides (
  seriesArray: SeriesState[],
  initiallySelectedSeriesInstanceUID: string = ''
): Slide[] {
  const slides: Slide[] = []
  for (let i = 0; i < seriesArray.length; ++i) {
    const series = seriesArray[i]
    if (series.volumeMetadata.length === 0) {
      console.warn('Series has zero volume instance. ' +
                   'The series will be discarded.')
      continue
    }
    const firstVolumeSeriesIstance =
      dmv.metadata.formatMetadata(series.volumeMetadata[0]) as dmv.metadata.VLWholeSlideMicroscopyImage
    const seriesFrameofReferenceUID = firstVolumeSeriesIstance.FrameOfReferenceUID
    const slideIndex = slides.findIndex((slide) =>
      slide.frameofReferenceUID === seriesFrameofReferenceUID)
    if (slideIndex === -1) {
      // create new slide
      const slide: Slide = {
        key: series.Series.SeriesInstanceUID,
        frameofReferenceUID: '',
        containerIdentifier: '',
        volumeMetadata: [],
        labelMetadata: [],
        overviewMetadata: [],
        seriesUIDsList: [series.Series.SeriesInstanceUID],
        keyOpticalPathIdentifier: '',
        opticalPathIdentifiersList: [],
        areImagesMonochrome: false,
        isMultiplexedSamples: false,
        description: ''
      }
      parseVolumeMetadataFromListToSlide(series.volumeMetadata, slide)
      parseLabelMetadataFromListToSlide(series.labelMetadata, slide)
      parseOverviewMetadataFromListToSlide(series.overviewMetadata, slide)
      if (slide.opticalPathIdentifiersList.length > 1) {
        slide.description = 'Multiplexed-Samples'
        slide.isMultiplexedSamples = true
      } else if (slide.areImagesMonochrome) {
        slide.description = 'Monochrome Slide'
      } else {
        slide.description = 'RGB Slide'
      }
      slides.push(slide)
    } else {
      // add info to already created slide
      const slide = slides[slideIndex]
      const volumeInstanceReference =
        parseVolumeMetadataFromListToSlide(series.volumeMetadata, slide)
      parseLabelMetadataFromListToSlide(series.labelMetadata, slide)
      parseOverviewMetadataFromListToSlide(series.overviewMetadata, slide)
      // store series uid
      slide.seriesUIDsList.push(series.Series.SeriesInstanceUID)
      if (initiallySelectedSeriesInstanceUID === series.Series.SeriesInstanceUID) {
        slide.key = initiallySelectedSeriesInstanceUID
        if (volumeInstanceReference !== null && volumeInstanceReference !== undefined) {
          slide.keyOpticalPathIdentifier =
            volumeInstanceReference.OpticalPathSequence[0].OpticalPathIdentifier
        }
      }
      if (slide.opticalPathIdentifiersList.length > 1) {
        slide.description = 'Multiplexed-Samples'
        slide.isMultiplexedSamples = true
      } else if (slide.areImagesMonochrome) {
        slide.description = 'Monochrome Slide'
      } else {
        slide.description = 'RGB Slide'
      }
    }
  }
  return slides
}

/**
 * Parses volume instances into a slide.
 *
 * @params volumeMetadataList - array of volume instances
 * @params slide
 * @returns volumeInstanceReference - first volume instance of the list
 */
function parseVolumeMetadataFromListToSlide (
  volumeMetadataList: object[],
  slide: Slide
): any {
  let volumeInstanceReference
  for (let j = 0; j < volumeMetadataList.length; ++j) {
    const metadata = volumeMetadataList[j]
    const instance =
      dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
    if (j === 0) {
      slide.frameofReferenceUID = instance.FrameOfReferenceUID
    } else if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
      console.warn('FrameOfReferenceUID of volume instance' +
                   instance.SOPInstanceUID +
                   ' does not correspond to slide FrameOfReferenceUID. ' +
                   'The instance will be discarded.')
      continue
    }
    if (j === 0) {
      slide.containerIdentifier = instance.ContainerIdentifier
    } else if (slide.containerIdentifier !== instance.ContainerIdentifier) {
      console.warn('ContainerIdentifier of volume instance' +
                   instance.SOPInstanceUID +
                   ' does not correspond to slide ContainerIdentifier. ' +
                   'The instance will be discarded.')
      continue
    }
    const instanceOpticalPathIdentifier =
      instance.OpticalPathSequence[0].OpticalPathIdentifier
    const instanceIsMonochorme = instance.SamplesPerPixel === 1 &&
      instance.PhotometricInterpretation === 'MONOCHROME2'
    if (slide.keyOpticalPathIdentifier === '' && instanceIsMonochorme) {
      slide.areImagesMonochrome = true
      slide.keyOpticalPathIdentifier = instanceOpticalPathIdentifier
    } else if (instanceIsMonochorme !== slide.areImagesMonochrome) {
      console.warn('Volume instance' +
                   instance.SOPInstanceUID +
                   ' of the slide has different image type. ' +
                   'The instance will be discarded.')
      continue
    }
    if (volumeInstanceReference === undefined) {
      volumeInstanceReference = instance
    }
    if (slide.opticalPathIdentifiersList.findIndex(
      (opi) => opi === instanceOpticalPathIdentifier) === -1
    ) {
      slide.opticalPathIdentifiersList.push(instanceOpticalPathIdentifier)
    }
    slide.volumeMetadata.push(metadata)
  }
  return volumeInstanceReference
}

/**
 * Parses label instances into a slide.
 *
 * @params labelMetadataList - array of label instances
 * @params slide
 */
function parseLabelMetadataFromListToSlide (
  labelMetadataList: object[],
  slide: Slide
): void {
  for (let j = 0; j < labelMetadataList.length; ++j) {
    const metadata = labelMetadataList[j]
    const instance =
      dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
    if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
      console.warn('FrameOfReferenceUID of label instance' +
                   instance.SOPInstanceUID +
                   ' does not correspond to slide FrameOfReferenceUID. ' +
                   'The instance will be discarded.')
      continue
    }
    if (slide.containerIdentifier !== instance.ContainerIdentifier) {
      console.warn('ContainerIdentifier of label instance' +
                   instance.SOPInstanceUID +
                   ' does not correspond to slide ContainerIdentifier. ' +
                   'The instance will be discarded.')
      continue
    }
    slide.labelMetadata.push(metadata)
  }
}

/**
 * Parses overview instances into a slide.
 *
 * @params overviewMetadataList - array of overview instances
 * @params slide
 */
function parseOverviewMetadataFromListToSlide (
  overviewMetadataList: object[],
  slide: Slide
): void {
  for (let j = 0; j < overviewMetadataList.length; ++j) {
    const metadata = overviewMetadataList[j]
    const instance =
      dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
    if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
      console.warn('FrameOfReferenceUID of overview instance' +
                   instance.SOPInstanceUID +
                   ' does not correspond to slide FrameOfReferenceUID. ' +
                   'The instance will be discarded.')
      continue
    }
    if (slide.containerIdentifier !== instance.ContainerIdentifier) {
      console.warn('ContainerIdentifier of overview instance' +
                   instance.SOPInstanceUID +
                   ' does not correspond to slide ContainerIdentifier. ' +
                   'The instance will be discarded.')
      continue
    }
    slide.overviewMetadata.push(metadata)
  }
}

export { Slide, createSlides }
