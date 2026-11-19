// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'

export type DicomWebManagerErrorHandler = (
  error: dwc.api.DICOMwebClientError,
  serverSettings: ServerSettings,
) => void

export interface DICOMwebClientRequestHookMetadata {
  url: string
  method: string
  /** Combined request headers from dicomweb-client (needed to re-apply after retry open()). */
  headers?: Record<string, string>
}

export interface RetryRequestSettings {
  retries?: number
  factor?: number
  minTimeout?: number
  maxTimeout?: number
  randomize?: boolean
  retryableStatusCodes?: number[]
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
  /**
   * Whether the OIDC access token is attached as an "Authorization" header to
   * requests sent to this server.
   *
   * Leave unset (the default) to let Slim decide at runtime: requests start
   * anonymous, and the token is sent only if the server answers 401/403. This
   * needs no redeployment when servers change, keeps requests CORS-simple —
   * "Authorization" is not a safelisted request header, so sending it forces an
   * OPTIONS preflight that many public DICOMweb endpoints answer incorrectly —
   * and means an open server never sees the token at all.
   *
   * Set explicitly to override that negotiation:
   * - `false` never sends the token, even if the server asks for it.
   * - `true` sends it from the first request, skipping the anonymous attempt.
   *   Use this for a server that responds 200 with fewer results instead of 401
   *   when unauthenticated, which runtime detection cannot distinguish from an
   *   open server.
   */
  sendAuthorization?: boolean
}

export interface OidcSettings {
  authority: string
  clientId: string
  scope: string
  grantType?: string
  authorizationEndpoint?: string
  endSessionEndpoint?: string
}

export interface VivChannelSelection {
  c: number
  t?: number
  z?: number
}

export interface VivSettings {
  selections?: VivChannelSelection[]
  channelsVisible?: boolean[]
  contrastLimits?: Array<[number, number]>
  colors?: Array<[number, number, number]>
  initialViewState?: {
    target: [number, number, number]
    zoom?: number
  }
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
  logger?: {
    level?: 'DEBUG' | 'LOG' | 'WARN' | 'ERROR' | 'NONE'
    enableInProduction?: boolean
    enableInDevelopment?: boolean
  }
  enableMemoryMonitoring?: boolean
  /**
   * When true, the slide viewport uses Viv + Deck.gl (src/viv)
   * instead of the default OpenLayers-based SlideViewer. Limited feature set.
   */
  useViv?: boolean
  /** Optional display overrides for the Viv viewer path (channels, contrast, etc.). */
  vivSettings?: VivSettings
}
