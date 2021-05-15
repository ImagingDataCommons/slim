import * as dwc from 'dicomweb-client'

import { ServerSettings } from './AppConfig'
import { joinUrl } from './utils/url'


export default class DicomWebManager {
  private readonly datastores: {
    isStoragePermitted: boolean
    client: dwc.api.DICOMwebClient
  }[]

  constructor(baseUri: string, settings: ServerSettings[]) {
    this.datastores = []
    settings.forEach(serverSettings => {
      if (serverSettings === undefined) {
        throw Error('At least one server needs to be configured.')
      }

      const clientSettings: dwc.api.DICOMwebClientOptions = { url: '' }
      if (serverSettings.url !== undefined) {
        clientSettings.url = serverSettings.url
      } else if (serverSettings.path !== undefined) {
        clientSettings.url = joinUrl(serverSettings.path, baseUri)
      } else {
        throw new Error(
          'Either path or full URL needs to be configured for server.'
        )
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
    return this.datastores[0].client.headers
  }

  storeInstances = (
    options: dwc.api.StoreInstancesOptions
  ): Promise<string> => {
    if (this.datastores[0].isStoragePermitted) {
      return this.datastores[0].client.storeInstances(options)
    } else {
      return Promise.reject('None of the configured servers permits storage.')
    }
  }

  searchForStudies = (
    options: dwc.api.SearchForStudiesOptions
  ): Promise<dwc.api.Study[]> => {
    return this.datastores[0].client.searchForStudies(options)
  }

  searchForSeries = (
    options: dwc.api.SearchForSeriesOptions
  ): Promise<dwc.api.Series[]> => {
    return this.datastores[0].client.searchForSeries(options)
  }

  searchForInstances = (
    options: dwc.api.SearchForInstancesOptions
  ): Promise<dwc.api.Instance[]> => {
    return this.datastores[0].client.searchForInstances(options)
  }

  retrieveStudyMetadata = (
    options: dwc.api.RetrieveStudyMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    return this.datastores[0].client.retrieveStudyMetadata(options)
  }

  retrieveSeriesMetadata = (
    options: dwc.api.RetrieveSeriesMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    return this.datastores[0].client.retrieveSeriesMetadata(options)
  }

  retrieveInstanceMetadata = (
    options: dwc.api.RetrieveInstanceMetadataOptions
  ): Promise<dwc.api.Metadata[]> => {
    return this.datastores[0].client.retrieveInstanceMetadata(options)
  }

  retrieveInstance = (
    options: dwc.api.RetrieveInstanceOptions
  ): Promise<dwc.api.Dataset> => {
    return this.datastores[0].client.retrieveInstance(options)
  }

  retrieveInstanceFrames = (
    options: dwc.api.RetrieveInstanceFramesOptions
  ): Promise<dwc.api.Pixeldata[]> => {
    return this.datastores[0].client.retrieveInstanceFrames(options)
  }

  retrieveInstanceRendered = (
    options: dwc.api.RetrieveInstanceRenderedOptions
  ): Promise<dwc.api.Pixeldata> => {
    return this.datastores[0].client.retrieveInstanceRendered(options)
  }

  retrieveInstanceFramesRendered = (
    options: dwc.api.RetrieveInstanceFramesRenderedOptions
  ): Promise<dwc.api.Pixeldata> => {
    return this.datastores[0].client.retrieveInstanceFramesRendered(options)
  }

  retrieveBulkData = (
    options: dwc.api.RetrieveBulkDataOptions
  ): Promise<dwc.api.Bulkdata> => {
    return this.datastores[0].client.retrieveBulkData(options)
  }
}

