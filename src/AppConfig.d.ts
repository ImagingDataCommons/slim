import * as dcmjs from 'dcmjs'

interface EvaluationSetting {
  name: dcmjs.sr.coding.CodeOptions
  values: dcmjs.sr.coding.CodeOptions[]
}

interface MeasurementSetting {
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

export interface ServerSettings {
  id: string
  url?: string
  path?: string
  write: boolean
  qidoPathPrefix?: string
  wadoPathPrefix?: string
  stowPathPrefix?: string
}

export interface RendererSettings {
  retrieveRendered: boolean
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
  renderer: RendererSettings
  annotations: AnnotationSettings[]
  organization?: string
  oidc?: OidcSettings
  disableWorklist?: boolean
  disableAnnotationTools?: boolean
}
