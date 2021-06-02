import * as dmv from 'dicom-microscopy-viewer'

import {SeriesState, Acquisition} from './types'

/**
 * Transforms series states list into a acquisition states list
 * A series state has 3 array of metadata (volume, label 
 * and overview) already donwloaded for a series.
 *
 * For monochorme images we collect all the instaces over multiple series
 * and we allocate only one acquisition (i.e. we assume there is only one 
 * multiSamples data acquistion per study). Here we are also assuming
 * that all the monochorme images are part of Multiplexed-Samples 
 * acquisition which can be wrong.
 *
 * For RGB images we allocate 1 slides for each searies 
 * (i.e. we assume 1:1 correspondence).
 *
 * The right criterions would be to group by Frame of Reference UID, assuming
 * that all the series of a Multiplexed-Samples acquisition have the same value
 * for the Frame of Reference UID.
 * 
 * @params seriesList - array of series states
 * @returns acquisitionList, an array of acquisitions states.
 */
export const fromSeriesListToAcquisitionList = (
  seriesList : SeriesState[],
  initiallySelectedSeriesInstanceUID: string = ''
): Acquisition[] => {
  const acquisitionList: Acquisition[] = []

  // RGB images
  for (let i = 0; i < seriesList.length; ++i) {
    const volumeMetadataList = seriesList[i].volumeMetadata
    if (volumeMetadataList.length === 0) {
      continue
    }
    const metadata = volumeMetadataList[0]
    const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
    if (instance.SamplesPerPixel === 1) {
      // this is not acolor image, but a monochorme sample.
      continue
    }
    const acquisition: Acquisition = {
      key: seriesList[i].Series.SeriesInstanceUID,
      volumeMetadata: seriesList[i].volumeMetadata,
      labelMetadata: seriesList[i].labelMetadata,
      overviewMetadata: seriesList[i].overviewMetadata,
      multiSamplesSeriesUIDs: [],
      multiSamplesKeyOpticalPathIdentifier: '',
      isMultiSample: false,
      description: seriesList[i].Series.SeriesDescription
    };
    
    acquisitionList.push(acquisition)  
  }

  // Monochorme images
  let multiSampleKey = ''
  let keyOpticalPathIdentifier = ''
  const volumeMetadata: object[] = []
  const labelMetadata: object[] = []
  const overviewMetadata: object[] = []
  const multiSamplesSeriesUIDs: string[] = []
  
  for (let i = 0; i < seriesList.length; ++i) {
    const volumeMetadataList = seriesList[i].volumeMetadata
    let volumeMetadataMonochorme = false
    for (let j = 0; j < volumeMetadataList.length; ++j) {
      const metadata = volumeMetadataList[j]
      const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
      if (instance.SamplesPerPixel !== 1) {
        // this is not a monochorme sample, but a color image.
        continue
      }

      volumeMetadataMonochorme = true
      volumeMetadata.push(metadata)
      if (multiSamplesSeriesUIDs.findIndex(uid => uid === seriesList[i].Series.SeriesInstanceUID) === -1) {
        multiSamplesSeriesUIDs.push(seriesList[i].Series.SeriesInstanceUID)
      }
      if (initiallySelectedSeriesInstanceUID === seriesList[i].Series.SeriesInstanceUID) {
        multiSampleKey = initiallySelectedSeriesInstanceUID
        keyOpticalPathIdentifier = instance.OpticalPathSequence[0].OpticalPathIdentifier
      }
      if (multiSampleKey === '') {
        multiSampleKey = seriesList[i].Series.SeriesInstanceUID
      }
    }
    
    // Assumption, if volume Metadata monochorme then 
    // the label and overview images of this series are also
    // in the Multiplexed-Samples acquisition
    if (volumeMetadataMonochorme) {
      const labelMetadataList = seriesList[i].labelMetadata
      for (let j = 0; j < labelMetadataList.length; ++j) {
        const metadata = labelMetadataList[j]
  
        labelMetadata.push(metadata)
        if (multiSamplesSeriesUIDs.findIndex(uid => uid === seriesList[i].Series.SeriesInstanceUID) === -1) {
          multiSamplesSeriesUIDs.push(seriesList[i].Series.SeriesInstanceUID)
        }
      }
      const overviewMetadataList = seriesList[i].overviewMetadata
      for (let j = 0; j < overviewMetadataList.length; ++j) {
        const metadata = overviewMetadataList[j]
  
        overviewMetadata.push(metadata)
        if (multiSamplesSeriesUIDs.findIndex(uid => uid === seriesList[i].Series.SeriesInstanceUID) === -1) {
          multiSamplesSeriesUIDs.push(seriesList[i].Series.SeriesInstanceUID)
        }
      }
    }
  }

  if (volumeMetadata.length > 0) {
    const acquisition: Acquisition = {
      key: multiSampleKey, 
      volumeMetadata: volumeMetadata,
      labelMetadata: labelMetadata,
      overviewMetadata: overviewMetadata,
      isMultiSample: true,
      multiSamplesSeriesUIDs: multiSamplesSeriesUIDs,
      multiSamplesKeyOpticalPathIdentifier: keyOpticalPathIdentifier,
      description: 'Multiplexed-Samples'
    };
    
    acquisitionList.push(acquisition)  
  }

  return acquisitionList
}
