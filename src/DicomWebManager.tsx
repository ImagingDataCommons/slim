import * as dwc from 'dicomweb-client'

import { ServerSettings } from './AppConfig'
import { joinUrl } from './utils/url'
import getXHRRetryHook from './utils/xhrRetryHook'

export default class DicomWebManager {
  private readonly datastores: Array<{
    isStoragePermitted: boolean
    client: dwc.api.DICOMwebClient
  }>

  private onError: Function

  constructor ({ baseUri, settings, onError }: {
    baseUri: string
    settings: ServerSettings[]
    onError?: Function
  }) {
    const noop = () => {};
    this.onError = onError || noop;
    this.datastores = []
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
      if (serverSettings.retryOptions !== undefined) {
        clientSettings.requestHooks = [getXHRRetryHook(serverSettings.retryOptions)]
      }
      if (serverSettings.errorMessages !== undefined) {
        clientSettings.errorInterceptor = (error: dwc.api.DICOMwebClientError) => {
          this.onError(error, serverSettings);
        }
      }
      this.datastores.push({
        isStoragePermitted: serverSettings.write,
        client: new dwc.api.DICOMwebClient(clientSettings)
      })
    })
  }

  updateHeaders = (fields: { [name: string]: string }): void => {
    this.datastores.forEach(store => {
      for (const f in fields) {
        store.client.headers[f] = fields[f]
      }
    })
  }

  get headers (): { [name: string]: string } {
    const store = this.datastores[0]
    return store.client.headers
  }

  storeInstances = async (
    options: dwc.api.StoreInstancesOptions
  ): Promise<string> => {
    const store = this.datastores[0]
    if (store.isStoragePermitted) {
      return await store.client.storeInstances(options)
    } else {
      return await Promise.reject(
        new Error('None of the configured servers permits storage of instances.')
      )
    }
  }

  searchForStudies = async (
    options: dwc.api.SearchForStudiesOptions
  ): Promise<dwc.api.Study[]> => {
    const store = this.datastores[0]
    return await store.client.searchForStudies(options)
  }

  searchForSeries = async (
    options: dwc.api.SearchForSeriesOptions
  ): Promise<dwc.api.Series[]> => {
    const store = this.datastores[0]
    return await store.client.searchForSeries(options)
  }

  searchForInstances = async (
    options: dwc.api.SearchForInstancesOptions
  ): Promise<dwc.api.Instance[]> => {
    const store = this.datastores[0]
    return await store.client.searchForInstances(options)
  }

  retrieveStudyMetadata = async (
    options: dwc.api.RetrieveStudyMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    const store = this.datastores[0]
    return await store.client.retrieveStudyMetadata(options)
  }

  retrieveSeriesMetadata = async (
    options: dwc.api.RetrieveSeriesMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    const store = this.datastores[0]
    return await store.client.retrieveSeriesMetadata(options)
  }

  retrieveInstanceMetadata = async (
    options: dwc.api.RetrieveInstanceMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    const store = this.datastores[0]
    return await store.client.retrieveInstanceMetadata(options)
  }

  retrieveInstance = async (
    options: dwc.api.RetrieveInstanceOptions
  ): Promise<dwc.api.Dataset> => {
    const store = this.datastores[0]
    return await store.client.retrieveInstance(options)
  }

  retrieveInstanceFrames = async (
    options: dwc.api.RetrieveInstanceFramesOptions
  ): Promise<dwc.api.Pixeldata[]> => {
    const store = this.datastores[0]
    return await store.client.retrieveInstanceFrames(options)
  }

  retrieveInstanceRendered = async (
    options: dwc.api.RetrieveInstanceRenderedOptions
  ): Promise<dwc.api.Pixeldata> => {
    const store = this.datastores[0]
    return await store.client.retrieveInstanceRendered(options)
  }

  retrieveInstanceFramesRendered = async (
    options: dwc.api.RetrieveInstanceFramesRenderedOptions
  ): Promise<dwc.api.Pixeldata> => {
    const store = this.datastores[0]
    return await store.client.retrieveInstanceFramesRendered(options)
  }

  retrieveBulkData = async (
    options: dwc.api.RetrieveBulkDataOptions
  ): Promise<dwc.api.Bulkdata> => {
    const store = this.datastores[0]
    return await store.client.retrieveBulkData(options)
  }
}
