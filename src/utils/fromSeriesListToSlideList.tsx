import * as dmv from 'dicom-microscopy-viewer'

/**
 * Transforms series states list into a slide states list
 * A series state has 3 array of metadata (volume, label 
 * and overview) already donwloaded for a series.
 *
 * For monochorme images we collect all the instaces over multiple series
 * and we allocate only one slide (i.e. we assume there is only one 
 * multichannel data acquistion per study).
 *
 * For RGB images we allocate 1 slides for each searies 
 * (i.e. we assume 1:1 correspondence).
 *
 * @params seriesList - array of series states
 * @returns slideList, an array of slides states.
 */
export const fromSeriesListToSlideList = (
  seriesList : dmv.metadata.SeriesState[],
  initiallySelectedSeriesInstanceUID: string = ''
): dmv.metadata.SlideState[] => {
  const slideList: dmv.metadata.SlideState[] = []

  // RGB images
  for (let i = 0; i < seriesList.length; ++i) {
    const volumeMetadataList = seriesList[i].VolumeMetadata
    if (volumeMetadataList.length === 0) {
      continue
    }
    const metadata = volumeMetadataList[0]
    const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
    if (instance.SamplesPerPixel === 1) {
      // this is not acolor image, but a monochorme channel.
      continue
    }
    const slideState: dmv.metadata.SlideState = {
      Key: seriesList[i].Series.SeriesInstanceUID,
      VolumeMetadata: seriesList[i].VolumeMetadata,
      LabelMetadata: seriesList[i].LabelMetadata,
      OverviewMetadata: seriesList[i].OverviewMetadata,
      MultiChannelsSeriesUIDs: [],
      IsMultiChannel: false,
      Description: seriesList[i].Series.SeriesDescription
    };
    
    slideList.push(slideState)  
  }

  // Monochorme images
  let multiChannelKey = ''
  const volumeMetadata: object[] = []
  const labelMetadata: object[] = []
  const overviewMetadata: object[] = []
  const multiChannelsSeriesUIDs: string[] = []
  
  for (let i = 0; i < seriesList.length; ++i) {
    const volumeMetadataList = seriesList[i].VolumeMetadata
    for (let j = 0; j < volumeMetadataList.length; ++j) {
      const metadata = volumeMetadataList[j]
      const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
      if (instance.SamplesPerPixel !== 1) {
        // this is not a monochorme channel, but a color image.
        continue
      }
      volumeMetadata.push(metadata)
      if (multiChannelsSeriesUIDs.findIndex(uid => uid === seriesList[i].Series.SeriesInstanceUID) === -1) {
        multiChannelsSeriesUIDs.push(seriesList[i].Series.SeriesInstanceUID)
      }
      if (slideList.length === 0 && 
        initiallySelectedSeriesInstanceUID !== '' &&
        initiallySelectedSeriesInstanceUID === seriesList[i].Series.SeriesInstanceUID) {
        multiChannelKey = initiallySelectedSeriesInstanceUID
      }
      if (multiChannelKey === '') {
        multiChannelKey = seriesList[i].Series.SeriesInstanceUID
      }
    }
    const labelMetadataList = seriesList[i].LabelMetadata
    for (let j = 0; j < labelMetadataList.length; ++j) {
      const metadata = labelMetadataList[j]
      const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
      if (instance.SamplesPerPixel !== 1) {
        // this is not a monochorme channel, but a color image.
        continue
      }
      labelMetadata.push(metadata)
      if (multiChannelsSeriesUIDs.findIndex(uid => uid === seriesList[i].Series.SeriesInstanceUID) === -1) {
        multiChannelsSeriesUIDs.push(seriesList[i].Series.SeriesInstanceUID)
      }
    }
    const overviewMetadataList = seriesList[i].OverviewMetadata
    for (let j = 0; j < overviewMetadataList.length; ++j) {
      const metadata = overviewMetadataList[j]
      const instance = dmv.metadata.formatMetadata(metadata) as dmv.metadata.VLWholeSlideMicroscopyImage
      if (instance.SamplesPerPixel !== 1) {
        // this is not a monochorme channel, but a color image.
        continue
      }
      overviewMetadata.push(metadata)
      if (multiChannelsSeriesUIDs.findIndex(uid => uid === seriesList[i].Series.SeriesInstanceUID) === -1) {
        multiChannelsSeriesUIDs.push(seriesList[i].Series.SeriesInstanceUID)
      }
    }
  }

  if (volumeMetadata.length > 0) {
    const slideState: dmv.metadata.SlideState = {
      Key: multiChannelKey, 
      VolumeMetadata: volumeMetadata,
      LabelMetadata: labelMetadata,
      OverviewMetadata: overviewMetadata,
      IsMultiChannel: true,
      MultiChannelsSeriesUIDs: multiChannelsSeriesUIDs,
      Description: 'multi-channels'
    };
    
    slideList.push(slideState)  
  }

  return slideList
}
