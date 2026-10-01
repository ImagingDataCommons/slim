import { showConfirmDialog } from '../components/ConfirmDialog'

/**
 * Ask the user before disclosing their access token to a server that is not
 * part of the deployed configuration.
 *
 * Names the identity provider that issued the token, since "your access
 * token" alone does not tell the user what is actually at stake — the answer
 * differs a great deal between a hospital SSO and a personal Google account.
 *
 * @param origin - Origin of the server that asked for credentials
 * @param authority - Issuer of the token, from the OIDC configuration
 * @returns Whether the user agreed to disclose the token
 */
export async function confirmAuthorizationDisclosure(
  origin: string,
  authority?: string,
): Promise<boolean> {
  return await showConfirmDialog({
    title: 'Send your access token to this server?',
    description: (
      <div className="space-y-3 text-sm">
        <p>
          <strong className="font-semibold">{origin}</strong> refused an
          anonymous request and is asking you to sign in.
        </p>
        <p>
          Slim can forward the access token issued to you by{' '}
          <strong className="font-semibold">
            {authority ?? 'your identity provider'}
          </strong>{' '}
          so this server can identify you. Anyone holding that token can act as
          you against that provider for as long as it remains valid.
        </p>
        <p>Only allow this if you trust {origin}.</p>
      </div>
    ),
    confirmLabel: 'Send token',
    cancelLabel: "Don't send",
  })
}
