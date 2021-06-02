import * as dmv from 'dicom-microscopy-viewer'

export interface SeriesState {
  Series: dmv.metadata.Series
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}

export interface Acquisition {
  key: string
  isMultiSample: boolean
  multiSamplesSeriesUIDs: string[]
  description: string
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}