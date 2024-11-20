import createSeriesMetadata from './createSeriesMetadata'

import { Study, Series, Instance } from '../services/DICOMMetadataStore'

function createStudyMetadata (StudyInstanceUID: string): Study {
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
    /**
     * @param {object} instance
     */
    addInstanceToSeries: function (instance: Instance) {
      this.addInstancesToSeries([instance])
    },
    /**
     * @param {object[]} instances
     * @param {string} instances[].SeriesInstanceUID
     * @param {string} instances[].StudyDescription
     */
    addInstancesToSeries: function (instances: Instance[]) {
      const { SeriesInstanceUID } = instances[0]

      if (this.StudyDescription !== '' && this.StudyDescription !== undefined) {
        this.StudyDescription = instances[0].StudyDescription
      }

      let series = this.series.find(
        (s) => s.SeriesInstanceUID === SeriesInstanceUID
      )

      if (series == null) {
        series = createSeriesMetadata(SeriesInstanceUID, instances)
        this.series.push(series)
      }

      series.addInstances(instances)
    },

    setSeriesMetadata: function (
      SeriesInstanceUID: string,
      seriesMetadata: any
    ) {
      let existingSeries = this.series.find(
        (s) => s.SeriesInstanceUID === SeriesInstanceUID
      )

      if (existingSeries != null) {
        existingSeries = Object.assign(existingSeries, seriesMetadata)
      } else {
        const series = createSeriesMetadata(SeriesInstanceUID)
        this.series.push(Object.assign(series, seriesMetadata))
      }
    }
  }
}

export default createStudyMetadata
