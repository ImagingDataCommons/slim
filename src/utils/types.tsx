import * as dmv from 'dicom-microscopy-viewer'

export interface SeriesState {
  Series: dmv.metadata.Series
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}

export interface Slide {
  key: string
  frameofReferenceUID: string
  containerIdentifier: string
  areImagesMonochrome: boolean
  seriesUIDs: string[]
  keyOpticalPathIdentifier: string
  opticalPathIdentifiersList: string[]
  description: string
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}