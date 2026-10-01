import type { AuthManager } from '../auth'
import type { AuthorizationPolicy } from '../DicomWebManager'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import {
  type AuthorizationDecision,
  isSecureOrigin,
  readAuthorizationDecision,
  writeAuthorizationDecision,
} from '../utils/authPolicy'
import { CustomError, errorTypes } from '../utils/CustomError'
import { createSingleFlight } from '../utils/singleFlight'

/**
 * - `refuse-insecure`: the connection would expose the token in transit
 * - `withhold`: the user declined before
 * - `ask`: unknown origin, the user must consent
 * - `grant`: configured or previously approved origin
 */
export type DisclosureStep = 'refuse-insecure' | 'withhold' | 'ask' | 'grant'

export function decideDisclosure({
  isSecure,
  remembered,
  isConfigured,
}: {
  isSecure: boolean
  remembered: AuthorizationDecision | undefined
  isConfigured: boolean
}): DisclosureStep {
  if (!isSecure) {
    return 'refuse-insecure'
  }
  if (remembered === 'denied') {
    return 'withhold'
  }
  if (remembered !== 'granted' && !isConfigured) {
    return 'ask'
  }
  return 'grant'
}

export interface TokenDisclosureOptions {
  auth: AuthManager | undefined
  /**
   * Origins that came from the deployed configuration file. Putting a server
   * there is the operator stating they trust it, so a 401 from one of these
   * escalates without troubling the user. Servers introduced at runtime — the
   * "Select server" dialog, the `?gcp=` parameter — are not on this list and
   * require explicit consent before the token is sent.
   */
  configuredOrigins: ReadonlySet<string>
  /** Issuer of the tokens `auth` hands out */
  oidcAuthority: string | undefined
  /** Ask the user whether the token may be sent to `origin` */
  confirm: (origin: string, authority: string | undefined) => Promise<boolean>
  /** Receives every token that was cleared for disclosure */
  onAuthorization: (authorization: string) => void
}

/**
 * Policy handed to every DicomWebManager: it decides which origins may
 * receive the user's access token.
 *
 * Slim sends no token until a server answers 401/403. At that point an origin
 * from the configuration file is credentialed silently, while any other
 * origin needs the user to say yes — otherwise a server could obtain a live
 * cloud credential just by claiming to want one.
 */
export function createTokenDisclosurePolicy({
  auth,
  configuredOrigins,
  oidcAuthority,
  confirm,
  onAuthorization,
}: TokenDisclosureOptions): AuthorizationPolicy {
  /**
   * Collapses consent negotiations by origin, so simultaneous challenges from
   * different managers share a single prompt.
   */
  const disclosureGate = createSingleFlight<string | undefined>()

  /**
   * Decide whether the access token may be disclosed to an origin, prompting
   * the user when the origin is not part of the deployed configuration, and
   * return the token if so.
   *
   * Always call this through `requestAuthorization`, which collapses
   * concurrent callers onto one negotiation — this function itself will open
   * a dialog every time it is invoked.
   *
   * @param origin - Origin of the server that asked for credentials
   * @returns The token to send, or undefined if it must be withheld
   */
  const negotiateDisclosure = async (
    origin: string,
  ): Promise<string | undefined> => {
    try {
      if (auth == null) {
        return undefined
      }
      const step = decideDisclosure({
        isSecure: isSecureOrigin(origin),
        remembered: readAuthorizationDecision(origin),
        isConfigured: configuredOrigins.has(origin),
      })
      if (step === 'refuse-insecure') {
        /**
         * Refuse rather than warn. A bearer token sent over plain HTTP is
         * readable by anything on the path, and no consent dialog makes that
         * safe. An operator who has a reason to do it anyway can still say so
         * explicitly with `sendAuthorization: true`, which never reaches here.
         */
        console.warn(
          `refusing to send access token to ${origin} over an insecure ` +
            'connection; set sendAuthorization on the server configuration ' +
            'to override',
        )
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.AUTH,
          new CustomError(
            errorTypes.AUTHENTICATION,
            `Not sending your access token to ${origin}: the connection is ` +
              'not secure.',
          ),
        )
        return undefined
      }
      if (step === 'withhold') {
        return undefined
      }
      if (step === 'ask') {
        const approved = await confirm(origin, oidcAuthority)
        writeAuthorizationDecision(origin, approved ? 'granted' : 'denied')
        console.info(
          `${approved ? 'approved' : 'declined'} disclosure of access token ` +
            `to ${origin} (user decision)`,
        )
        if (!approved) {
          return undefined
        }
      } else {
        writeAuthorizationDecision(origin, 'granted')
        console.info(
          `approved disclosure of access token to ${origin} ` +
            '(origin present in the deployed configuration)',
        )
      }

      const authorization = await auth.getAuthorization()
      if (authorization == null) {
        return undefined
      }
      /**
       * The grant is recorded per origin, but each storage class has its own
       * manager. Push the token across all of them so stores on this origin in
       * a sibling manager are credentialed now, rather than each having to be
       * refused once before it asks. Every manager re-applies its own per-store
       * filtering, so this cannot widen disclosure beyond the recorded grants.
       */
      onAuthorization(authorization)
      return authorization
    } catch (error) {
      /**
       * Never let a failed negotiation reject: callers are inside a DICOMweb
       * error path already, and a rejection here would replace the underlying
       * server error with a less useful one.
       */
      console.error('could not negotiate token disclosure', error)
      return undefined
    }
  }

  return {
    isPreAuthorized: (origin: string): boolean =>
      readAuthorizationDecision(origin) === 'granted',

    /**
     * Collapsed per origin across the whole app. Each DicomWebManager already
     * dedupes its own concurrent challenges, but a storage class gets its own
     * manager, so a single page load can challenge one server from several of
     * them at once. Without this the user is asked once per manager.
     */
    requestAuthorization: async (origin: string): Promise<string | undefined> =>
      await disclosureGate(
        origin,
        async () => await negotiateDisclosure(origin),
      ),
  }
}
