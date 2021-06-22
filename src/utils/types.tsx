import * as dmv from 'dicom-microscopy-viewer'

export interface SeriesState {
  Series: dmv.metadata.Series
  volumeMetadata: object[]
  labelMetadata: object[]
  overviewMetadata: object[]
}