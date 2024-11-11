import * as dwc from 'dicomweb-client'
import * as dcmjs from 'dcmjs'
import * as dmv from 'dicom-microscopy-viewer'

import { ServerSettings, DicomWebManagerErrorHandler } from './AppConfig'
import { joinUrl } from './utils/url'
import getXHRRetryHook from './utils/xhrRetryHook'
import { CustomError, errorTypes } from './utils/CustomError'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from './services/NotificationMiddleware'
import DicomMetadataStore, { Instance } from './services/DICOMMetadataStore'

const { naturalizeDataset } = dcmjs.data.DicomMetaDictionary

interface Store {
  id: string
  read: boolean
  write: boolean
  client: dwc.api.DICOMwebClient
}

export default class DicomWebManager implements dwc.api.DICOMwebClient {
  private readonly stores: Store[] = []

  private readonly handleError: DicomWebManagerErrorHandler

  constructor ({ baseUri, settings, onError }: {
    baseUri: string
    settings: ServerSettings[]
    onError?: DicomWebManagerErrorHandler
  }) {
    if (onError != null) {
      this.handleError = onError
    } else {
      this.handleError = (error, serverSettings) => {
        console.error(error, serverSettings)
      }
    }

    settings.forEach(serverSettings => {
      if (serverSettings === undefined) {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.COMMUNICATION,
            'At least one server needs to be configured.'
          )
        )
      }

      let serviceUrl
      if (serverSettings.url !== undefined) {
        serviceUrl = serverSettings.url
      } else if (serverSettings.path !== undefined) {
        serviceUrl = joinUrl(serverSettings.path, baseUri)
      } else {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.COMMUNICATION,
            'Either path or full URL needs to be configured for server.'
          )
        )
      }

      const hasHttpsUrl = (url?: string): boolean => url?.startsWith('https') ?? false

      const clientSettings: dwc.api.DICOMwebClientOptions = {
        url: serviceUrl
      }

      const shouldUpgradeInsecure = serverSettings.upgradeInsecureRequests === true && [
        serviceUrl,
        serverSettings.qidoPathPrefix,
        serverSettings.wadoPathPrefix,
        serverSettings.stowPathPrefix
      ].some(hasHttpsUrl)

      if (serverSettings.qidoPathPrefix !== undefined) {
        clientSettings.qidoURLPrefix = serverSettings.qidoPathPrefix
      }
      if (serverSettings.wadoPathPrefix !== undefined) {
        clientSettings.wadoURLPrefix = serverSettings.wadoPathPrefix
      }
      if (serverSettings.stowPathPrefix !== undefined) {
        clientSettings.stowURLPrefix = serverSettings.stowPathPrefix
      }

      if (shouldUpgradeInsecure) {
        clientSettings.headers = {
          ...clientSettings.headers,
          'Content-Security-Policy': 'upgrade-insecure-requests'
        }
      }

      if (serverSettings.retry !== undefined) {
        clientSettings.requestHooks = [getXHRRetryHook(serverSettings.retry)]
      }

      clientSettings.errorInterceptor = (error: dwc.api.DICOMwebClientError) => {
        this.handleError(error, serverSettings)
      }

      this.stores.push({
        id: serverSettings.id,
        write: serverSettings.write ?? false,
        read: serverSettings.read ?? true,
        client: new dwc.api.DICOMwebClient(clientSettings)
      })
    })

    if (this.stores.length > 1) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.COMMUNICATION,
          'Only one store is supported for now.'
        )
      )
    }
  }

  get baseURL (): string {
    return this.stores[0].client.baseURL
  }

  updateHeaders = (fields: { [name: string]: string }): void => {
    for (const f in fields) {
      this.stores[0].client.headers[f] = fields[f]
    }
  }

  get headers (): { [name: string]: string } {
    return this.stores[0].client.headers
  }

  storeInstances = async (
    options: dwc.api.StoreInstancesOptions
  ): Promise<void> => {
    if (this.stores[0].write) {
      return await this.stores[0].client.storeInstances(options)
    } else {
      return await Promise.reject(
        new Error('Store is not writable.')
      )
    }
  }

  searchForStudies = async (
    options: dwc.api.SearchForStudiesOptions
  ): Promise<dwc.api.Study[]> => {
    return await this.stores[0].client.searchForStudies(options)
  }

  searchForSeries = async (
    options: dwc.api.SearchForSeriesOptions
  ): Promise<dwc.api.Series[]> => {
    return await this.stores[0].client.searchForSeries(options)
  }

  searchForInstances = async (
    options: dwc.api.SearchForInstancesOptions
  ): Promise<dwc.api.Instance[]> => {
    return await this.stores[0].client.searchForInstances(options)
  }

  retrieveStudyMetadata = async (
    options: dwc.api.RetrieveStudyMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    const studySummaryMetadata = await this.stores[0].client.retrieveStudyMetadata(options)
    const naturalized = naturalizeDataset(studySummaryMetadata)
    DicomMetadataStore.addStudy(naturalized)
    return studySummaryMetadata
  }

  retrieveSeriesMetadata = async (
    options: dwc.api.RetrieveSeriesMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    const seriesSummaryMetadata = await this.stores[0].client.retrieveSeriesMetadata(options)
    console.debug('seriesSummaryMetadata:', seriesSummaryMetadata)
    const naturalized = seriesSummaryMetadata.map(naturalizeDataset)
    console.debug('naturalized:', naturalized)
    DicomMetadataStore.addSeriesMetadata(naturalized, true)
    return seriesSummaryMetadata
  }

  retrieveInstanceMetadata = async (
    options: dwc.api.RetrieveInstanceMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    return await this.stores[0].client.retrieveInstanceMetadata(options)
  }

  retrieveInstance = async (
    options: dwc.api.RetrieveInstanceOptions
  ): Promise<dwc.api.Dataset> => {
    const instance = await this.stores[0].client.retrieveInstance(options)
    const data = dcmjs.data.DicomMessage.readFile(instance)
    const { dataset } = dmv.metadata.formatMetadata(data.dict)
    DicomMetadataStore.addInstances([dataset as Instance])
    return instance
  }

  retrieveInstanceFrames = async (
    options: dwc.api.RetrieveInstanceFramesOptions
  ): Promise<dwc.api.Pixeldata[]> => {
    return await this.stores[0].client.retrieveInstanceFrames(options)
  }

  retrieveInstanceRendered = async (
    options: dwc.api.RetrieveInstanceRenderedOptions
  ): Promise<dwc.api.Pixeldata> => {
    return await this.stores[0].client.retrieveInstanceRendered(options)
  }

  retrieveInstanceFramesRendered = async (
    options: dwc.api.RetrieveInstanceFramesRenderedOptions
  ): Promise<dwc.api.Pixeldata> => {
    return await this.stores[0].client.retrieveInstanceFramesRendered(options)
  }

  retrieveBulkData = async (
    options: dwc.api.RetrieveBulkDataOptions
  ): Promise<dwc.api.Bulkdata[]> => {
    return await this.stores[0].client.retrieveBulkData(options)
  }
}
