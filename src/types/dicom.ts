export interface DicomImage {
  SeriesDate: string
  SeriesTime: string
  SeriesNumber: number
  SeriesDescription: string
  Modality: string
  // Add other DICOM image properties as needed
}

export interface DisplaySet {
  displaySetInstanceUID: number
  SeriesDate: string
  SeriesTime: string
  SeriesNumber: number
  SeriesDescription: string
  Modality: string
  images: DicomImage[]
}
