import DicomMetadataStore from '../../../services/DICOMMetadataStore'
import { formatSeriesLabel } from '../utils/seriesLabel'

/** Series description from the metadata store, else a truncated UID */
export function describeStudySeries(
  studyInstanceUID: string,
  seriesInstanceUID: string,
): string {
  const study = DicomMetadataStore.getStudy(studyInstanceUID)
  const series = study?.series?.find(
    (s) => s.SeriesInstanceUID === seriesInstanceUID,
  )
  return formatSeriesLabel(seriesInstanceUID, series?.SeriesDescription)
}
