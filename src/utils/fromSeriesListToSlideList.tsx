import * as dmv from 'dicom-microscopy-viewer'

import {SeriesState, Slide} from './types'

/**
 * Transforms series states list into a slide states list
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
 * @params seriesList - array of series states
 * @returns slideList, an array of slides.
 */
export const fromSeriesListToSlideList = (
  seriesList : SeriesState[],
  initiallySelectedSeriesInstanceUID: string = ''
): Slide[] => {
  const slideList: Slide[] = []

  for (let i = 0; i < seriesList.length; ++i) {
    const series = seriesList[i]
    if (series.volumeMetadata.length === 0) {
      console.warn('Series has zero volume instance. The series will be discarded.')
      continue
    }
    const firstVolumeSeriesIstance = dmv.metadata.formatMetadata(series.volumeMetadata[0]) as dmv.metadata.VLWholeSlideMicroscopyImage
    const seriesFrameofReferenceUID = firstVolumeSeriesIstance.FrameOfReferenceUID
    const slideIndex = slideList.findIndex((slide) => slide.frameofReferenceUID === seriesFrameofReferenceUID)
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
        description: series.Series.SeriesDescription
      };
  
      const volumeMetadataList = series.volumeMetadata
      for (let j = 0; j < volumeMetadataList.length; ++j) {
        const metadata = volumeMetadataList[j]
        const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
        if (j === 0) {
          slide.frameofReferenceUID = instance.FrameOfReferenceUID
        } else if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
          console.warn('FrameOfReferenceUID of volume instance does not correspond to slide FrameOfReferenceUID. '
                       + 'The instance will be discarded.')
          continue;
        }

        if (j === 0) {
          slide.containerIdentifier = instance.ContainerIdentifier
        } else if (slide.containerIdentifier !== instance.ContainerIdentifier) {
          console.warn('ContainerIdentifier of volume instance does not correspond to slide ContainerIdentifier. '
                       + 'The instance will be discarded.')
          continue;
        }
  
        const instanceOpticalPathIdentifier = instance.OpticalPathSequence[0].OpticalPathIdentifier
        const instanceIsMonochorme = instance.SamplesPerPixel === 1 && instance.PhotometricInterpretation === 'MONOCHROME2'
        // check first volume for type of image and assing it to slide
        if (j === 0 && instanceIsMonochorme) {
          slide.areImagesMonochrome = true
          slide.keyOpticalPathIdentifier = instanceOpticalPathIdentifier
        } else if (j !== 0 && instanceIsMonochorme !== slide.areImagesMonochrome) {
          console.warn('Volume instance of the slide has different image type. '
                       + 'The instance will be discarded.')
          continue;
        }
        
        if (slide.opticalPathIdentifiersList.findIndex((opi) => opi === instanceOpticalPathIdentifier) === -1) {
          slide.opticalPathIdentifiersList.push(instanceOpticalPathIdentifier)
        }
        
        slide.volumeMetadata.push(metadata)
      }
  
      const labelMetadataList = series.labelMetadata
      for (let j = 0; j < labelMetadataList.length; ++j) {
        const metadata = labelMetadataList[j]
        const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
        if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
          console.warn('FrameOfReferenceUID of label instance does not correspond to slide FrameOfReferenceUID. '
                       + 'The instance will be discarded.')
          continue;
        }
        if (slide.containerIdentifier !== instance.ContainerIdentifier) {
          console.warn('ContainerIdentifier of label instance does not correspond to slide ContainerIdentifier. '
                       + 'The instance will be discarded.')
          continue;
        }
  
        slide.labelMetadata.push(metadata)
      }
  
      const overviewMetadataList = series.overviewMetadata
      for (let j = 0; j < overviewMetadataList.length; ++j) {
        const metadata = overviewMetadataList[j]
        const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
        if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
          console.warn('FrameOfReferenceUID of overview instance does not correspond to slide FrameOfReferenceUID. '
                       + 'The instance will be discarded.')
          continue;
        }
        if (slide.containerIdentifier !== instance.ContainerIdentifier) {
          console.warn('ContainerIdentifier of overview instance does not correspond to slide ContainerIdentifier. ' 
                       + 'The instance will be discarded.')
          continue;
        }
  
        slide.overviewMetadata.push(metadata)
      }
  
      if (slide.opticalPathIdentifiersList.length > 1) {
        slide.description = 'Multiplexed-Samples'
      }

      slideList.push(slide)  
    } else {
      // add info to already created slide
      const slide = slideList[slideIndex]

      const volumeMetadataList = series.volumeMetadata
      let volumeInstanceReference = undefined
      for (let j = 0; j < volumeMetadataList.length; ++j) {
        const metadata = volumeMetadataList[j]
        const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
        if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
          console.warn('FrameOfReferenceUID of volume instance does not correspond to slide FrameOfReferenceUID. '
                       + 'The instance will be discarded.')
          continue;
        }
        if (slide.containerIdentifier !== instance.ContainerIdentifier) {
          console.warn('ContainerIdentifier of volume instance does not correspond to slide ContainerIdentifier. ' 
                       + 'The instance will be discarded.')
          continue;
        }

        const instanceIsMonochorme = instance.SamplesPerPixel === 1 && instance.PhotometricInterpretation === 'MONOCHROME2'
        if (instanceIsMonochorme !== slide.areImagesMonochrome) {
          console.warn('Volume instance of the slide has different image type. '
                       + 'The instance will be discarded.')
          continue;
        }
        
        volumeInstanceReference = instance

        const instanceOpticalPathIdentifier = instance.OpticalPathSequence[0].OpticalPathIdentifier
        if (slide.opticalPathIdentifiersList.findIndex((opi) => opi === instanceOpticalPathIdentifier) === -1) {
          slide.opticalPathIdentifiersList.push(instanceOpticalPathIdentifier)
        }
        slide.volumeMetadata.push(metadata)
      }

      const labelMetadataList = series.labelMetadata
      for (let j = 0; j < labelMetadataList.length; ++j) {
        const metadata = labelMetadataList[j]
        const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
        if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
          console.warn('FrameOfReferenceUID of label instance does not correspond to slide FrameOfReferenceUID. '
                       + 'The instance will be discarded.')
          continue;
        }
        if (slide.containerIdentifier !== instance.ContainerIdentifier) {
          console.warn('ContainerIdentifier of label instance does not correspond to slide ContainerIdentifier. ' 
                       + 'The instance will be discarded.')
          continue;
        }

        slide.labelMetadata.push(metadata)
      }

      const overviewMetadataList = series.overviewMetadata
      for (let j = 0; j < overviewMetadataList.length; ++j) {
        const metadata = overviewMetadataList[j]
        const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
        if (slide.frameofReferenceUID !== instance.FrameOfReferenceUID) {
          console.warn('FrameOfReferenceUID of overview instance does not correspond to slide FrameOfReferenceUID. '
                       + 'The instance will be discarded.')
          continue;
        }
        if (slide.containerIdentifier !== instance.ContainerIdentifier) {
          console.warn('ContainerIdentifier of overview instance does not correspond to slide ContainerIdentifier. '
                       + 'The instance will be discarded.')
          continue;
        }

        slide.overviewMetadata.push(metadata)
      }

      // store series uid
      slide.seriesUIDs.push(series.Series.SeriesInstanceUID)
      if (initiallySelectedSeriesInstanceUID === series.Series.SeriesInstanceUID) {
        slide.key = initiallySelectedSeriesInstanceUID

        if (volumeInstanceReference) {
          slide.keyOpticalPathIdentifier = volumeInstanceReference.OpticalPathSequence[0].OpticalPathIdentifier
        }
      }

      if (slide.opticalPathIdentifiersList.length > 1) {
        slide.description = 'Multiplexed-Samples'
      }
    }
  }

  return slideList
}
