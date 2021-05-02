import * as dcmjs from 'dcmjs'


export interface AnnotationConfig {
  finding: dcmjs.sr.coding.CodeOptions
  color: number[]
}

export interface ServerConfig {
  id: string
  url?: string
  path?: string
  write: boolean
  qidoPathPrefix?: string
  wadoPathPrefix?: string
  stowPathPrefix?: string
}

export interface OidcConfig {
  authority: string
  clientId: string
  redirectUri: string
  scope: string
  postLogoutRedirectUri?: string
}

export default interface AppConfig {
  servers: ServerConfig[]
  path: string
  annotations: AnnotationConfig[]
  organization?: string
  oidc?: OidcConfig
}
