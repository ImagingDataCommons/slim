import * as dmv from 'dicom-microscopy-viewer'

import {SeriesState} from '../utils/types'

export interface Slide {
  key: string
  frameofReferenceUID: string
  containerIdentifier: string
  areImagesMonochrome: boolean
  isMultiplexedSamples: boolean
  seriesUIDs: string[]
  keyOpticalPathIdentifier: string
  opticalPathIdentifiersList: string[]
  description: string
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}
 
/**
 * Arranges all metadata to create Slides  
 */
class Slides {
  slideArray: Slide[] = [] 

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
   */
  constructor (
    seriesArray : SeriesState[],
    initiallySelectedSeriesInstanceUID: string = ''
  ) {
    for (let i = 0; i < seriesArray.length; ++i) {
      const series = seriesArray[i]
      if (series.volumeMetadata.length === 0) {
        console.warn('Series has zero volume instance. '
                     + 'The series will be discarded.')
        continue
      }

      const firstVolumeSeriesIstance = dmv.metadata.formatMetadata
        (series.volumeMetadata[0]) as dmv.metadata.VLWholeSlideMicroscopyImage
      const seriesFrameofReferenceUID = firstVolumeSeriesIstance.FrameOfReferenceUID
      const slideIndex = this.slideArray.findIndex((slide) => 
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
          seriesUIDs: [series.Series.SeriesInstanceUID],
          keyOpticalPathIdentifier: '',
          opticalPathIdentifiersList: [],
          areImagesMonochrome: false,
          isMultiplexedSamples: false,
          description: ''
        };
      
        this._parseVolumeMetadataFromListToSlide(series.volumeMetadata, slide)
        this._parseLabelMetadataFromListToSlide(series.labelMetadata, slide)
        this._parseOverviewMetadataFromListToSlide(series.overviewMetadata, slide)
        
        if (slide.opticalPathIdentifiersList.length > 1) {
          slide.description = 'Multiplexed-Samples'
          slide.isMultiplexedSamples = true
        } else if (slide.areImagesMonochrome) {
          slide.description = 'Monochrome Slide'
        } else {
          slide.description = 'RGB Slide'
        }

        this.slideArray.push(slide)  
      } else {
        // add info to already created slide
        const slide = this.slideArray[slideIndex]

        const volumeInstanceReference = 
          this._parseVolumeMetadataFromListToSlide(series.volumeMetadata, slide)
        this._parseLabelMetadataFromListToSlide(series.labelMetadata, slide)
        this._parseOverviewMetadataFromListToSlide(series.overviewMetadata, slide)
        
        // store series uid
        slide.seriesUIDs.push(series.Series.SeriesInstanceUID)
        if (initiallySelectedSeriesInstanceUID === series.Series.SeriesInstanceUID) {
          slide.key = initiallySelectedSeriesInstanceUID
          if (volumeInstanceReference) {
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
  }

  /**
   * Gets slide array
   * 
   * @returns slideArray - array of slide states
   */
  getSlideArray() {
    return this.slideArray
  }

  /**
   * Parses volume instances into a slide.
   * 
   * @params volumeMetadataList - array of volume instances
   * @params slide
   * @returns volumeInstanceReference - first volume instance of the list
   */
  _parseVolumeMetadataFromListToSlide(
    volumeMetadataList : object[], 
    slide: Slide,
  ) {
    let volumeInstanceReference = undefined
    for (let j = 0; j < volumeMetadataList.length; ++j) {
      const metadata = volumeMetadataList[j]
      const instance = dmv.metadata.formatMetadata
        (metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
      if (j === 0) {
        slide.frameofReferenceUID = instance.FrameOfReferenceUID
      } else if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
        console.warn('FrameOfReferenceUID of volume instance' 
                     + instance.SOPInstanceUID 
                     + ' does not correspond to slide FrameOfReferenceUID. '
                     + 'The instance will be discarded.')
        continue;
      }

      if (j === 0) {
        slide.containerIdentifier = instance.ContainerIdentifier
      } else if (slide.containerIdentifier !== instance.ContainerIdentifier) {
        console.warn('ContainerIdentifier of volume instance'
                     + instance.SOPInstanceUID 
                     + ' does not correspond to slide ContainerIdentifier. '
                     + 'The instance will be discarded.')
        continue;
      }

      const instanceOpticalPathIdentifier = 
        instance.OpticalPathSequence[0].OpticalPathIdentifier
      const instanceIsMonochorme = instance.SamplesPerPixel === 1 &&
        instance.PhotometricInterpretation === 'MONOCHROME2'

      if (slide.keyOpticalPathIdentifier === '' && instanceIsMonochorme) {
        slide.areImagesMonochrome = true
        slide.keyOpticalPathIdentifier = instanceOpticalPathIdentifier
      } else if (instanceIsMonochorme !== slide.areImagesMonochrome) {
        console.warn('Volume instance' 
                     + instance.SOPInstanceUID 
                     + ' of the slide has different image type. '
                     + 'The instance will be discarded.')
        continue;
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
  _parseLabelMetadataFromListToSlide(
    labelMetadataList : object[], 
    slide: Slide
  ) {
    for (let j = 0; j < labelMetadataList.length; ++j) {
      const metadata = labelMetadataList[j]
      const instance = dmv.metadata.formatMetadata
        (metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
      if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
        console.warn('FrameOfReferenceUID of label instance' 
                     + instance.SOPInstanceUID 
                     + ' does not correspond to slide FrameOfReferenceUID. '
                     + 'The instance will be discarded.')
        continue;
      }

      if (slide.containerIdentifier !== instance.ContainerIdentifier) {
        console.warn('ContainerIdentifier of label instance' 
                     + instance.SOPInstanceUID 
                     + ' does not correspond to slide ContainerIdentifier. '
                     + 'The instance will be discarded.')
        continue;
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
  _parseOverviewMetadataFromListToSlide(
    overviewMetadataList : object[], 
    slide: Slide
  ) {
    for (let j = 0; j < overviewMetadataList.length; ++j) {
      const metadata = overviewMetadataList[j]
      const instance = dmv.metadata.formatMetadata
        (metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
      if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
        console.warn('FrameOfReferenceUID of overview instance' 
                     + instance.SOPInstanceUID 
                     + ' does not correspond to slide FrameOfReferenceUID. '
                     + 'The instance will be discarded.')
        continue;
      }

      if (slide.containerIdentifier !== instance.ContainerIdentifier) {
        console.warn('ContainerIdentifier of overview instance' 
                     + instance.SOPInstanceUID 
                     + ' does not correspond to slide ContainerIdentifier. ' 
                     + 'The instance will be discarded.')
        continue;
      }

      slide.overviewMetadata.push(metadata)
    }
  }
}

export {Slides}