import * as dwc from 'dicomweb-client'

import { ServerSettings, DicomWebManagerErrorHandler } from './AppConfig'
import { joinUrl } from './utils/url'
import getXHRRetryHook from './utils/xhrRetryHook'

export default class DicomWebManager {
  private readonly readClient: dwc.api.DICOMwebClient

  private readonly writeClient?: dwc.api.DICOMwebClient

  private readonly handleError: DicomWebManagerErrorHandler

  constructor ({ baseUri, settings, onError }: {
    baseUri: string
    settings: ServerSettings[]
    onError?: DicomWebManagerErrorHandler
  }) {
    this.handleError = () => {}
    if (onError != null) {
      this.handleError = onError
    }

    const datastores: {
      read?: boolean
      write: boolean
      client: dwc.api.DICOMwebClient
    }[] = []
    settings.forEach(serverSettings => {
      if (serverSettings === undefined) {
        throw Error('At least one server needs to be configured.')
      }

      let serviceUrl
      if (serverSettings.url !== undefined) {
        serviceUrl = serverSettings.url
      } else if (serverSettings.path !== undefined) {
        serviceUrl = joinUrl(serverSettings.path, baseUri)
      } else {
        throw new Error(
          'Either path or full URL needs to be configured for server.'
        )
      }
      const clientSettings: dwc.api.DICOMwebClientOptions = {
        url: serviceUrl
      }
      if (serverSettings.qidoPathPrefix !== undefined) {
        clientSettings.qidoURLPrefix = serverSettings.qidoPathPrefix
      }
      if (serverSettings.wadoPathPrefix !== undefined) {
        clientSettings.wadoURLPrefix = serverSettings.wadoPathPrefix
      }
      if (serverSettings.stowPathPrefix !== undefined) {
        clientSettings.stowURLPrefix = serverSettings.stowPathPrefix
      }
      if (serverSettings.retry !== undefined) {
        clientSettings.requestHooks = [getXHRRetryHook(serverSettings.retry)]
      }
      if (serverSettings.errorMessages !== undefined) {
        clientSettings.errorInterceptor = (error: dwc.api.DICOMwebClientError) => {
          this.handleError(error, serverSettings)
        }
      }
      datastores.push({
        write: serverSettings.write,
        read: serverSettings.read,
        client: new dwc.api.DICOMwebClient(clientSettings)
      })
    })

    if (datastores.length === 1) {
      /**
       * If only one store is configured, we use it for reading and
       * (if permitted) also for writing
       */
      const store = datastores[0]
      if (store.read === false) {
        throw new Error('No readable store found. Check server settings.')
      }
      this.readClient = store.client
      if (store.write) {
        this.writeClient = store.client
      }
    } else {
      const writableStores = datastores.filter(store => store.write)
      if (writableStores.length > 0) {
        this.writeClient = writableStores[0].client
        if (writableStores.length > 1) {
          console.warn(
            'more than one store configured for writing, using ' +
            this.writeClient.baseURL
          )
        }
      }
      /**
       * If more than one store is configured, it must be explicitly specified
       * which store should be used for reading.
       */
      const readableStores = datastores.filter(store => store.read)
      if (readableStores.length === 0) {
        throw new Error('No readable store found. Check server settings.')
      } else {
        this.readClient = readableStores[0].client
        if (readableStores.length > 1) {
          console.warn(
            'more than one store configured for reading, using ' +
            this.readClient.baseURL
          )
        }
      }
      this.readClient = readableStores[0].client
    }
  }

  get baseURL (): string {
    return this.readClient.baseURL
  }

  updateHeaders = (fields: { [name: string]: string }): void => {
    for (const f in fields) {
      this.readClient.headers[f] = fields[f]
      if (this.writeClient) {
        this.writeClient.headers[f] = fields[f]
      }
    }
  }

  get headers (): { [name: string]: string } {
    return this.readClient.headers
  }

  storeInstances = async (
    options: dwc.api.StoreInstancesOptions
  ): Promise<string> => {
    if (this.writeClient) {
      return await this.writeClient.storeInstances(options)
    } else {
      return await Promise.reject(
        new Error('None of the configured servers permits storage of instances.')
      )
    }
  }

  searchForStudies = async (
    options: dwc.api.SearchForStudiesOptions
  ): Promise<dwc.api.Study[]> => {
    return await this.readClient.searchForStudies(options)
  }

  searchForSeries = async (
    options: dwc.api.SearchForSeriesOptions
  ): Promise<dwc.api.Series[]> => {
    return await this.readClient.searchForSeries(options)
  }

  searchForInstances = async (
    options: dwc.api.SearchForInstancesOptions
  ): Promise<dwc.api.Instance[]> => {
    return await this.readClient.searchForInstances(options)
  }

  retrieveStudyMetadata = async (
    options: dwc.api.RetrieveStudyMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    return await this.readClient.retrieveStudyMetadata(options)
  }

  retrieveSeriesMetadata = async (
    options: dwc.api.RetrieveSeriesMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    return await this.readClient.retrieveSeriesMetadata(options)
  }

  retrieveInstanceMetadata = async (
    options: dwc.api.RetrieveInstanceMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    return await this.readClient.retrieveInstanceMetadata(options)
  }

  retrieveInstance = async (
    options: dwc.api.RetrieveInstanceOptions
  ): Promise<dwc.api.Dataset> => {
    return await this.readClient.retrieveInstance(options)
  }

  retrieveInstanceFrames = async (
    options: dwc.api.RetrieveInstanceFramesOptions
  ): Promise<dwc.api.Pixeldata[]> => {
    return await this.readClient.retrieveInstanceFrames(options)
  }

  retrieveInstanceRendered = async (
    options: dwc.api.RetrieveInstanceRenderedOptions
  ): Promise<dwc.api.Pixeldata> => {
    return await this.readClient.retrieveInstanceRendered(options)
  }

  retrieveInstanceFramesRendered = async (
    options: dwc.api.RetrieveInstanceFramesRenderedOptions
  ): Promise<dwc.api.Pixeldata> => {
    return await this.readClient.retrieveInstanceFramesRendered(options)
  }

  retrieveBulkData = async (
    options: dwc.api.RetrieveBulkDataOptions
  ): Promise<dwc.api.Bulkdata> => {
    return await this.readClient.retrieveBulkData(options)
  }
}
