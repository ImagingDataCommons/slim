import dcmjs from 'dcmjs'

import pubSubServiceInterface from '../utils/pubSubServiceInterface'
import createStudyMetadata from '../utils/createStudyMetadata'

export const EVENTS = {
  STUDY_ADDED: 'event::dicomMetadataStore:studyAdded',
  INSTANCES_ADDED: 'event::dicomMetadataStore:instancesAdded',
  SERIES_ADDED: 'event::dicomMetadataStore:seriesAdded',
  SERIES_UPDATED: 'event::dicomMetadataStore:seriesUpdated'
}

export interface Instance {
  SOPInstanceUID: string
  SOPClassUID: string
  Rows: number
  Columns: number
  PatientSex: string
  Modality: string
  InstanceNumber: string
  imageId?: string
  [key: string]: any // For dynamic metadata properties
}

export interface Series {
  Modality: string
  SeriesInstanceUID: string
  SeriesNumber: number
  SeriesDate: string
  SeriesTime: string
  SeriesDescription: string
  instances: Instance[]
  addInstance: (newInstance: Instance) => void
  addInstances: (newInstances: Instance[]) => void
  getInstance: (SOPInstanceUID: string) => Instance | undefined
}

export interface Study {
  StudyInstanceUID: string
  StudyDescription: string
  PatientID: string
  PatientName: string
  StudyDate: string
  AccessionNumber: string
  NumInstances: number
  ModalitiesInStudy: any[]
  NumberOfStudyRelatedSeries?: number
  isLoaded: boolean
  series: Series[]
  addInstanceToSeries: (instance: Instance) => void
  addInstancesToSeries: (instances: Instance[]) => void
  setSeriesMetadata: (SeriesInstanceUID: string, metadata: any) => void
}

interface Model {
  studies: Study[]
}

const _model: Model = {
  studies: []
}

function _getStudyInstanceUIDs (): string[] {
  return _model.studies.map((aStudy) => aStudy.StudyInstanceUID)
}

function _getStudy (StudyInstanceUID: string): Study | undefined {
  return _model.studies.find(
    (aStudy) => aStudy.StudyInstanceUID === StudyInstanceUID
  )
}

function _getSeries (StudyInstanceUID: string, SeriesInstanceUID: string): Series | undefined {
  const study = _getStudy(StudyInstanceUID)

  if (study == null) {
    return
  }

  return study.series.find(
    (aSeries) => aSeries.SeriesInstanceUID === SeriesInstanceUID
  )
}

function _getInstance (
  StudyInstanceUID: string,
  SeriesInstanceUID: string,
  SOPInstanceUID: string
): Instance | undefined {
  const series = _getSeries(StudyInstanceUID, SeriesInstanceUID)

  if (series == null) {
    return
  }

  return series.getInstance(SOPInstanceUID)
}

function _getInstanceByImageId (imageId: string): Instance | undefined {
  for (const study of _model.studies) {
    for (const series of study.series) {
      for (const instance of series.instances) {
        if (instance.imageId === imageId) {
          return instance
        }
      }
    }
  }
}

/**
 * Update the metadata of a specific series
 * @param {*} StudyInstanceUID
 * @param {*} SeriesInstanceUID
 * @param {*} metadata metadata inform of key value pairs
 * @returns
 */
function _updateMetadataForSeries (
  StudyInstanceUID: string,
  SeriesInstanceUID: string,
  metadata: Record<string, any>
): void {
  const study = _getStudy(StudyInstanceUID)

  if (study == null) {
    return
  }

  const series = study.series.find(
    (aSeries) => aSeries.SeriesInstanceUID === SeriesInstanceUID
  )

  if (series == null) {
    return
  }

  const { instances } = series
  instances.forEach((instance) => {
    Object.keys(metadata).forEach((key) => {
      if (typeof metadata[key] === 'object') {
        instance[key] = { ...instance[key], ...metadata[key] }
      } else {
        instance[key] = metadata[key]
      }
    })
  })
}

interface BaseImplementationType {
  EVENTS: typeof EVENTS
  listeners: Record<string, any>
  addInstance: (dicomJSONDatasetOrP10ArrayBuffer: ArrayBuffer | Record<string, any>) => void
  addInstances: (instances: Instance[], madeInClient?: boolean) => void
  updateSeriesMetadata: (seriesMetadata: Record<string, any>) => void
  addSeriesMetadata: (seriesSummaryMetadata: Array<Record<string, any>>, madeInClient?: boolean) => void
  addStudy: (study: Record<string, any>) => void
  getStudyInstanceUIDs: typeof _getStudyInstanceUIDs
  getStudy: typeof _getStudy
  getSeries: typeof _getSeries
  getInstance: typeof _getInstance
  getInstanceByImageId: typeof _getInstanceByImageId
  updateMetadataForSeries: typeof _updateMetadataForSeries
  _broadcastEvent: (eventName: string, data: any) => void
}

const BaseImplementation: BaseImplementationType = {
  EVENTS,
  listeners: {},
  addInstance (dicomJSONDatasetOrP10ArrayBuffer) {
    let dicomJSONDataset

    // If Arraybuffer, parse to DICOMJSON before naturalizing.
    if (dicomJSONDatasetOrP10ArrayBuffer instanceof ArrayBuffer) {
      const dicomData = dcmjs.data.DicomMessage.readFile(
        dicomJSONDatasetOrP10ArrayBuffer
      )

      dicomJSONDataset = dicomData.dict
    } else {
      dicomJSONDataset = dicomJSONDatasetOrP10ArrayBuffer
    }

    let naturalizedDataset: Instance

    if (!('SeriesInstanceUID' in dicomJSONDataset)) {
      naturalizedDataset =
        dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomJSONDataset) as Instance
    } else {
      naturalizedDataset = dicomJSONDataset as unknown as Instance
    }

    const { StudyInstanceUID } = naturalizedDataset

    let study = _model.studies.find(
      (study) => study.StudyInstanceUID === StudyInstanceUID
    )

    if (study == null) {
      _model.studies.push(createStudyMetadata(StudyInstanceUID))
      study = _model.studies[_model.studies.length - 1]
    }

    study.addInstanceToSeries(naturalizedDataset)
  },
  addInstances (instances, madeInClient = false) {
    const { StudyInstanceUID, SeriesInstanceUID } = instances[0]

    let study = _model.studies.find(
      (study) => study.StudyInstanceUID === StudyInstanceUID
    )

    if (study == null) {
      _model.studies.push(createStudyMetadata(StudyInstanceUID))
      study = _model.studies[_model.studies.length - 1]
    }

    study.addInstancesToSeries(instances)

    // Broadcast an event even if we used cached data.
    // This is because the mode needs to listen to instances that are added to build up its active displaySets.
    // It will see there are cached displaySets and end early if this Series has already been fired in this
    // Mode session for some reason.
    this._broadcastEvent(EVENTS.INSTANCES_ADDED, {
      StudyInstanceUID,
      SeriesInstanceUID,
      madeInClient
    })
  },
  updateSeriesMetadata (seriesMetadata) {
    const { StudyInstanceUID, SeriesInstanceUID } = seriesMetadata
    const series = _getSeries(StudyInstanceUID, SeriesInstanceUID)
    if (series == null) {
      return
    }

    const study = _getStudy(StudyInstanceUID)
    if (study != null) {
      study.setSeriesMetadata(SeriesInstanceUID, seriesMetadata)
    }
  },
  addSeriesMetadata (seriesSummaryMetadata, madeInClient = false) {
    if (
      seriesSummaryMetadata === undefined ||
      seriesSummaryMetadata.length === 0 ||
      seriesSummaryMetadata[0] === undefined
    ) {
      return
    }

    const { StudyInstanceUID } = seriesSummaryMetadata[0]
    let study = _getStudy(StudyInstanceUID)
    if (study == null) {
      study = createStudyMetadata(StudyInstanceUID)
      // Will typically be undefined with a compliant DICOMweb server, reset later
      study.StudyDescription = seriesSummaryMetadata[0].StudyDescription
      seriesSummaryMetadata?.forEach((item) => {
        if (study !== undefined && !study.ModalitiesInStudy?.includes(item.Modality)) {
          study.ModalitiesInStudy?.push(item.Modality)
        }
      })
      study.NumberOfStudyRelatedSeries = seriesSummaryMetadata.length
      _model.studies.push(study)
    }

    seriesSummaryMetadata.forEach((series) => {
      const { SeriesInstanceUID } = series
      study?.setSeriesMetadata(SeriesInstanceUID, series)
    })

    this._broadcastEvent(EVENTS.SERIES_ADDED, {
      StudyInstanceUID,
      seriesSummaryMetadata,
      madeInClient
    })
  },
  addStudy (study) {
    const { StudyInstanceUID } = study

    const existingStudy = _model.studies.find(
      (study) => study.StudyInstanceUID === StudyInstanceUID
    )

    if (existingStudy == null) {
      const newStudy = createStudyMetadata(StudyInstanceUID)

      newStudy.PatientID = study.PatientID
      newStudy.PatientName = study.PatientName
      newStudy.StudyDate = study.StudyDate
      newStudy.ModalitiesInStudy = study.ModalitiesInStudy
      newStudy.StudyDescription = study.StudyDescription
      newStudy.AccessionNumber = study.AccessionNumber
      newStudy.NumInstances = study.NumInstances // todo: Correct naming?

      _model.studies.push(newStudy)
    }
  },
  getStudyInstanceUIDs: _getStudyInstanceUIDs,
  getStudy: _getStudy,
  getSeries: _getSeries,
  getInstance: _getInstance,
  getInstanceByImageId: _getInstanceByImageId,
  updateMetadataForSeries: _updateMetadataForSeries,
  _broadcastEvent (eventName: string, data: any): void {
  }
}

interface DicomMetadataStoreType extends BaseImplementationType {
  subscribe: (event: string, callback: (data: any) => void) => { unsubscribe: () => any }
  unsubscribe: (event: string, callback: (data: any) => void) => void
}

const DicomMetadataStore = Object.assign(
  {},
  BaseImplementation,
  pubSubServiceInterface
) as unknown as DicomMetadataStoreType

export { DicomMetadataStore }
export default DicomMetadataStore
