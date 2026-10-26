import type { Instance, Series, Study } from '../services/DICOMMetadataStore'
import createSeriesMetadata from './createSeriesMetadata'

function createStudyMetadata(StudyInstanceUID: string): Study {
  return {
    StudyInstanceUID,
    StudyDescription: '',
    PatientID: '',
    PatientName: '',
    StudyDate: '',
    AccessionNumber: '',
    NumInstances: 0,
    ModalitiesInStudy: [],
    isLoaded: false,
    series: [] as Series[],
    addInstanceToSeries(instance: Instance) {
      this.addInstancesToSeries([instance])
    },
    /** All `instances` must belong to the same series. */
    addInstancesToSeries(instances: Instance[]) {
      if (instances.length === 0) return
      const { SeriesInstanceUID, StudyDescription } = instances[0]

      if (
        this.StudyDescription === '' &&
        typeof StudyDescription === 'string'
      ) {
        this.StudyDescription = StudyDescription
      }

      const seriesUID = String(SeriesInstanceUID)
      let series = this.series.find((s) => s.SeriesInstanceUID === seriesUID)

      if (series == null) {
        series = createSeriesMetadata(seriesUID, instances)
        this.series.push(series)
      }

      series.addInstances(instances)
    },

    setSeriesMetadata(
      SeriesInstanceUID: string,
      seriesMetadata: Record<string, unknown>,
    ) {
      let existingSeries = this.series.find(
        (s) => s.SeriesInstanceUID === SeriesInstanceUID,
      )

      if (existingSeries != null) {
        existingSeries = Object.assign(existingSeries, seriesMetadata)
      } else {
        const series = createSeriesMetadata(SeriesInstanceUID)
        this.series.push(Object.assign(series, seriesMetadata))
      }
    },
  }
}

export default createStudyMetadata
