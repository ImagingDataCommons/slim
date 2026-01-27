import dcmjs from 'dcmjs'
import createStudyMetadata from '../utils/createStudyMetadata'
import pubSubServiceInterface from '../utils/pubSubServiceInterface'

export const EVENTS = {
  STUDY_ADDED: 'event::dicomMetadataStore:studyAdded',
  INSTANCES_ADDED: 'event::dicomMetadataStore:instancesAdded',
  SERIES_ADDED: 'event::dicomMetadataStore:seriesAdded',
  SERIES_UPDATED: 'event::dicomMetadataStore:seriesUpdated',
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
  [key: string]: unknown // For dynamic metadata properties
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
  ModalitiesInStudy: string[]
  NumberOfStudyRelatedSeries?: number
  isLoaded: boolean
  series: Series[]
  addInstanceToSeries: (instance: Instance) => void
  addInstancesToSeries: (instances: Instance[]) => void
  setSeriesMetadata: (
    SeriesInstanceUID: string,
    metadata: Record<string, unknown>,
  ) => void
}

interface Model {
  studies: Study[]
}

const _model: Model = {
  studies: [],
}

function _getStudyInstanceUIDs(): string[] {
  return _model.studies.map((aStudy) => aStudy.StudyInstanceUID)
}

function _getStudy(StudyInstanceUID: string): Study | undefined {
  return _model.studies.find(
    (aStudy) => aStudy.StudyInstanceUID === StudyInstanceUID,
  )
}

function _getSeries(
  StudyInstanceUID: string,
  SeriesInstanceUID: string,
): Series | undefined {
  const study = _getStudy(StudyInstanceUID)

  if (study == null) {
    return
  }

  return study.series.find(
    (aSeries) => aSeries.SeriesInstanceUID === SeriesInstanceUID,
  )
}

function _getInstance(
  StudyInstanceUID: string,
  SeriesInstanceUID: string,
  SOPInstanceUID: string,
): Instance | undefined {
  const series = _getSeries(StudyInstanceUID, SeriesInstanceUID)

  if (series == null) {
    return
  }

  return series.getInstance(SOPInstanceUID)
}

function _getInstanceByImageId(imageId: string): Instance | undefined {
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
function _updateMetadataForSeries(
  StudyInstanceUID: string,
  SeriesInstanceUID: string,
  metadata: Record<string, unknown>,
): void {
  const study = _getStudy(StudyInstanceUID)

  if (study == null) {
    return
  }

  const series = study.series.find(
    (aSeries) => aSeries.SeriesInstanceUID === SeriesInstanceUID,
  )

  if (series == null) {
    return
  }

  const { instances } = series
  instances.forEach((instance) => {
    Object.keys(metadata).forEach((key) => {
      if (typeof metadata[key] === 'object' && metadata[key] !== null) {
        const existing = instance[key]
        instance[key] = {
          ...(typeof existing === 'object' && existing !== null
            ? existing
            : {}),
          ...(metadata[key] as object),
        }
      } else {
        instance[key] = metadata[key]
      }
    })
  })
}

interface BaseImplementationType {
  EVENTS: typeof EVENTS
  listeners: Record<string, unknown>
  addInstance: (
    dicomJSONDatasetOrP10ArrayBuffer: ArrayBuffer | Record<string, unknown>,
  ) => void
  addInstances: (instances: Instance[], madeInClient?: boolean) => void
  updateSeriesMetadata: (seriesMetadata: Record<string, unknown>) => void
  addSeriesMetadata: (
    seriesSummaryMetadata: Array<Record<string, unknown>>,
    madeInClient?: boolean,
  ) => void
  addStudy: (study: Record<string, unknown>) => void
  getStudyInstanceUIDs: typeof _getStudyInstanceUIDs
  getStudy: typeof _getStudy
  getSeries: typeof _getSeries
  getInstance: typeof _getInstance
  getInstanceByImageId: typeof _getInstanceByImageId
  updateMetadataForSeries: typeof _updateMetadataForSeries
  _broadcastEvent: (eventName: string, data: unknown) => void
}

const BaseImplementation: BaseImplementationType = {
  EVENTS,
  listeners: {},
  addInstance(dicomJSONDatasetOrP10ArrayBuffer) {
    let dicomJSONDataset: Record<string, unknown>

    // If Arraybuffer, parse to DICOMJSON before naturalizing.
    if (dicomJSONDatasetOrP10ArrayBuffer instanceof ArrayBuffer) {
      const dicomData = dcmjs.data.DicomMessage.readFile(
        dicomJSONDatasetOrP10ArrayBuffer,
      )

      dicomJSONDataset = dicomData.dict as Record<string, unknown>
    } else {
      dicomJSONDataset = dicomJSONDatasetOrP10ArrayBuffer
    }

    let naturalizedDataset: Instance

    if (!('SeriesInstanceUID' in dicomJSONDataset)) {
      naturalizedDataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
        dicomJSONDataset,
      ) as Instance
    } else {
      naturalizedDataset = dicomJSONDataset as unknown as Instance
    }

    const { StudyInstanceUID } = naturalizedDataset

    let study = _model.studies.find(
      (study) => study.StudyInstanceUID === StudyInstanceUID,
    )

    if (study == null) {
      _model.studies.push(createStudyMetadata(String(StudyInstanceUID)))
      study = _model.studies[_model.studies.length - 1]
    }

    study.addInstanceToSeries(naturalizedDataset)
  },
  addInstances(instances, madeInClient = false) {
    const { StudyInstanceUID, SeriesInstanceUID } = instances[0]

    let study = _model.studies.find(
      (study) => study.StudyInstanceUID === StudyInstanceUID,
    )

    if (study == null) {
      _model.studies.push(createStudyMetadata(String(StudyInstanceUID)))
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
      madeInClient,
    })
  },
  updateSeriesMetadata(seriesMetadata) {
    const { StudyInstanceUID, SeriesInstanceUID } = seriesMetadata
    const studyUID = String(StudyInstanceUID)
    const seriesUID = String(SeriesInstanceUID)
    const series = _getSeries(studyUID, seriesUID)
    if (series == null) {
      return
    }

    const study = _getStudy(studyUID)
    if (study != null) {
      study.setSeriesMetadata(seriesUID, seriesMetadata)
    }
  },
  addSeriesMetadata(seriesSummaryMetadata, madeInClient = false) {
    if (
      seriesSummaryMetadata === undefined ||
      seriesSummaryMetadata.length === 0 ||
      seriesSummaryMetadata[0] === undefined
    ) {
      return
    }

    const { StudyInstanceUID } = seriesSummaryMetadata[0]
    const studyUID = String(StudyInstanceUID)
    let study = _getStudy(studyUID)
    if (study == null) {
      study = createStudyMetadata(studyUID)
      // Will typically be undefined with a compliant DICOMweb server, reset later
      study.StudyDescription = String(
        seriesSummaryMetadata[0].StudyDescription ?? '',
      )
      seriesSummaryMetadata?.forEach((item) => {
        if (
          study !== undefined &&
          !study.ModalitiesInStudy?.includes(String(item.Modality ?? ''))
        ) {
          study.ModalitiesInStudy?.push(String(item.Modality ?? ''))
        }
      })
      study.NumberOfStudyRelatedSeries = seriesSummaryMetadata.length
      _model.studies.push(study)
    }

    seriesSummaryMetadata.forEach((series) => {
      const { SeriesInstanceUID } = series
      study?.setSeriesMetadata(String(SeriesInstanceUID), series)
    })

    this._broadcastEvent(EVENTS.SERIES_ADDED, {
      StudyInstanceUID: studyUID,
      seriesSummaryMetadata,
      madeInClient,
    })
  },
  addStudy(study) {
    const { StudyInstanceUID } = study

    const existingStudy = _model.studies.find(
      (study) => study.StudyInstanceUID === StudyInstanceUID,
    )

    if (existingStudy == null) {
      const newStudy = createStudyMetadata(String(StudyInstanceUID))

      newStudy.PatientID = String(study.PatientID ?? '')
      newStudy.PatientName = String(study.PatientName ?? '')
      newStudy.StudyDate = String(study.StudyDate ?? '')
      newStudy.ModalitiesInStudy = Array.isArray(study.ModalitiesInStudy)
        ? (study.ModalitiesInStudy as unknown[]).map(String)
        : []
      newStudy.StudyDescription = String(study.StudyDescription ?? '')
      newStudy.AccessionNumber = String(study.AccessionNumber ?? '')
      newStudy.NumInstances = Number(study.NumInstances) ?? 0

      _model.studies.push(newStudy)
    }
  },
  getStudyInstanceUIDs: _getStudyInstanceUIDs,
  getStudy: _getStudy,
  getSeries: _getSeries,
  getInstance: _getInstance,
  getInstanceByImageId: _getInstanceByImageId,
  updateMetadataForSeries: _updateMetadataForSeries,
  _broadcastEvent(_eventName: string, _data: unknown): void {},
}

interface DicomMetadataStoreType extends BaseImplementationType {
  subscribe: (
    event: string,
    callback: (data: unknown) => void,
  ) => { unsubscribe: () => void }
  unsubscribe: (event: string, callback: (data: unknown) => void) => void
}

const DicomMetadataStore = Object.assign(
  {},
  BaseImplementation,
  pubSubServiceInterface,
) as unknown as DicomMetadataStoreType

export { DicomMetadataStore }
export default DicomMetadataStore
