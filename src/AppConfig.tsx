import * as dcmjs from 'dcmjs'

export interface AnnotationSettings {
  finding: dcmjs.sr.coding.CodeOptions
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

export interface OidcSettings {
  authority: string
  clientId: string
  redirectUri: string
  scope: string
  postLogoutRedirectUri?: string
}

export default interface AppConfig {
  servers: ServerSettings[]
  path: string
  annotations: AnnotationSettings[]
  organization?: string
  oidc?: OidcSettings
}
