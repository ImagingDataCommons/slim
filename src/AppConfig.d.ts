import * as dcmjs from 'dcmjs'

export type DicomWebManagerErrorHandler = (
  error: dwc.api.DICOMwebClientError,
  serverSettings: ServerSettings
) => void

export interface DICOMwebClientRequestHookMetadata {
  url: string
  method: string
}

export interface RetryRequestSettings {
  retries?: number
  factor?: number
  minTimeout?: number
  maxTimeout?: number
  randomize?: boolean
  retryableStatusCodes: number[]
}

export interface EvaluationSetting {
  name: dcmjs.sr.coding.CodeOptions
  values: dcmjs.sr.coding.CodeOptions[]
}

export interface MeasurementSetting {
  name: dcmjs.sr.coding.CodeOptions
  unit: dcmjs.sr.coding.CodeOptions
}

export interface AnnotationSettings {
  finding: dcmjs.sr.coding.CodeOptions
  findingCategory?: dcmjs.sr.coding.CodeOptions
  evaluations?: EvaluationSetting[]
  measurements?: MeasurementSetting[]
  geometryTypes?: string[]
  style?: {
    stroke: {
      color: number[]
      width: number
    }
    fill: {
      color: number[]
    }
    radius?: number
  }
}

export interface ErrorMessageSettings {
  status: number
  message: string
}

export interface ServerSettings {
  id: string
  url?: string
  path?: string
  write: boolean
  read?: boolean
  qidoPathPrefix?: string
  wadoPathPrefix?: string
  stowPathPrefix?: string
  retry?: RetryRequestSettings
  errorMessages?: ErrorMessageSettings[]
  storageClasses?: string[]
  upgradeInsecureRequests?: boolean
}

export interface OidcSettings {
  authority: string
  clientId: string
  scope: string
  grantType?: string
  authorizationEndpoint?: string
  endSessionEndpoint?: string
}

export default interface AppConfig {
  /**
   * Currently, only one server is supported. However, support for multiple
   * servers is planned and the "server" parameter therefore expects an array.
   * Authentication and authorization for any of the servers is expected to go
   * through the same identity provider and authorization server using the OIDC
   * and OAuth 2.0 protocols (see "oidc" parameter).
   */
  servers: ServerSettings[]
  path: string
  annotations: AnnotationSettings[]
  organization?: string
  gcpBaseUrl?: string
  oidc?: OidcSettings
  disableWorklist?: boolean
  disableAnnotationTools?: boolean
  enableServerSelection?: boolean
  mode?: string
  preload?: boolean
  messages?: {
    disabled?: boolean | string[]
    top?: number
    duration?: number
  }
}
