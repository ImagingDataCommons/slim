import * as dcmjs from 'dcmjs'

export type DicomWebManagerErrorHandler = (
  error: dwc.api.DICOMwebClientError, serverSettings: ServerSettings
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
  evaluations?: EvaluationSetting[]
  measurements?: MeasurementSetting[]
  style: {
    stroke: {
      color: number[]
      width: number
    }
    fill: {
      color: number[]
    }
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
}

export interface OidcSettings {
  authority: string
  clientId: string
  scope: string
  grantType?: string
}

export default interface AppConfig {
  servers: ServerSettings[]
  path: string
  annotations: AnnotationSettings[]
  organization?: string
  oidc?: OidcSettings
  disableWorklist?: boolean
  disableAnnotationTools?: boolean
}
