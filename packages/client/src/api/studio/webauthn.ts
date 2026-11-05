import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser'
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser'
import { deploymentUrl } from '@/utils/deployment-url'
import { request } from '../client'
import type { LoginResponse } from './auth'

/**
 * Passkey (WebAuthn) client.
 *
 * All base64url ↔ ArrayBuffer conversion is handled by @simplewebauthn/browser so
 * this module never hand-rolls encoding. Every ceremony is gated on a secure
 * context: over plain http:// a WebAuthn call throws SecurityError with no
 * actionable message, so we refuse earlier with something readable.
 */

export interface WebAuthnStatus {
  enabled: boolean
  hasCredentials: boolean
}

export interface WebAuthnCredentialView {
  id: number
  name: string
  created_at: number
  last_used_at: number | null
}

export interface WebAuthnRpConfig {
  configured: boolean
  rpID: string
  rpName: string
  origins: string[]
  credentialsBound: boolean
  error?: string
}

interface BeginResponse<T> {
  sessionToken: string
  options: T
}

/** WebAuthn only works on https:// or http://localhost. */
export function isSecureContextForWebAuthn(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && browserSupportsWebAuthn()
}

export function canAttemptWebAuthn(): boolean {
  return isWebAuthnSupported() && isSecureContextForWebAuthn()
}

export async function hasPlatformAuthenticator(): Promise<boolean> {
  if (!canAttemptWebAuthn()) return false
  try {
    return await platformAuthenticatorIsAvailable()
  } catch {
    return false
  }
}

/**
 * Translate browser WebAuthn errors into something a user can act on.
 *
 * The important case is `UnknownError` ("an unknown error occurred while talking
 * to the credential manager"): on Android/mobile it almost always means the RP ID
 * or origin does not match the address bar, and the raw message never says so.
 */
export function classifyCredentialError(error: unknown): Error {
  const name = error instanceof DOMException ? error.name : ''
  const message = String((error as Error)?.message || error || '')
  // @simplewebauthn wraps the DOM exception, so the name is not always preserved;
  // the message text is the reliable signal. NotAllowedError covers both a user
  // cancellation and a timeout ("The operation either timed out or was not
  // allowed"), which are indistinguishable by design, so they share one message.
  if (/NotAllowedError/.test(name) || /timed out|not allowed/i.test(message)) {
    return new Error('PASSKEY_CANCELLED')
  }
  if (/SecurityError/.test(name) || /insecure|secure context/i.test(message)) {
    return new Error('PASSKEY_INSECURE_CONTEXT')
  }
  // The library substitutes its own wording for UnknownError — "The authenticator
  // was unable to process the specified options, or could not create a new
  // assertion signature" — which never mentions the credential manager. Both
  // forms mean the same thing on a real phone: the RP ID / origin does not match
  // the address bar, so the authenticator refuses.
  if (
    /UnknownError/.test(name)
    || /unknown error|credential manager/i.test(message)
    || /unable to process the specified options/i.test(message)
    || /could not create a new assertion signature/i.test(message)
  ) {
    return new Error('PASSKEY_RP_MISMATCH')
  }
  if (/InvalidStateError/.test(name) || /already registered/i.test(message)) {
    return new Error('PASSKEY_ALREADY_REGISTERED')
  }
  if (/NotSupportedError/.test(name)) {
    return new Error('PASSKEY_UNSUPPORTED')
  }
  return new Error(message || 'PASSKEY_FAILED')
}

export async function fetchWebAuthnStatus(): Promise<WebAuthnStatus> {
  const res = await fetch(deploymentUrl('/api/auth/webauthn/status'))
  if (!res.ok) return { enabled: false, hasCredentials: false }
  return res.json() as Promise<WebAuthnStatus>
}

/**
 * Sign in with a discoverable credential. No username is sent: the authenticator
 * returns the userHandle that the server embedded at registration time.
 */
export async function loginWithPasskey(): Promise<LoginResponse> {
  if (!canAttemptWebAuthn()) throw new Error('PASSKEY_UNSUPPORTED')

  let begin: BeginResponse<PublicKeyCredentialRequestOptionsJSON>
  try {
    begin = await request<BeginResponse<PublicKeyCredentialRequestOptionsJSON>>(
      '/api/auth/webauthn/login/begin',
      { method: 'POST', body: '{}' },
    )
  } catch (error) {
    // The server explains its own failures (unconfigured RP, no credential yet).
    throw new Error(String((error as Error)?.message || 'PASSKEY_FAILED'))
  }

  let assertion: AuthenticationResponseJSON
  try {
    assertion = await startAuthentication({ optionsJSON: begin.options })
  } catch (error) {
    throw classifyCredentialError(error)
  }

  return request<LoginResponse>('/api/auth/webauthn/login/finish', {
    method: 'POST',
    body: JSON.stringify({ sessionToken: begin.sessionToken, response: assertion }),
  })
}

/**
 * Bind a new authenticator to the signed-in account.
 *
 * `expectedRpID` lets us fail before the ceremony when the page is being served
 * from a host the RP ID does not cover — the one misconfiguration that produces
 * an unhelpful "unknown error" on phones.
 */
export async function registerPasskey(name: string, expectedRpID?: string): Promise<WebAuthnCredentialView> {
  if (!canAttemptWebAuthn()) throw new Error('PASSKEY_UNSUPPORTED')
  if (typeof window !== 'undefined' && expectedRpID) {
    const hostname = window.location.hostname.toLowerCase()
    const rpID = expectedRpID.toLowerCase()
    if (hostname !== rpID && !hostname.endsWith(`.${rpID}`)) {
      throw new Error('PASSKEY_RP_MISMATCH')
    }
  }

  const begin = await request<BeginResponse<PublicKeyCredentialCreationOptionsJSON>>(
    '/api/auth/webauthn/register/begin',
    { method: 'POST', body: '{}' },
  ).catch((error: unknown) => {
    // Surface the server's own explanation (RP not configured, etc.).
    throw new Error(String((error as Error)?.message || 'PASSKEY_FAILED'))
  })

  let registration: RegistrationResponseJSON
  try {
    registration = await startRegistration({ optionsJSON: begin.options })
  } catch (error) {
    throw classifyCredentialError(error)
  }

  const result = await request<{ credential: WebAuthnCredentialView }>(
    '/api/auth/webauthn/register/finish',
    {
      method: 'POST',
      body: JSON.stringify({ sessionToken: begin.sessionToken, response: registration, name }),
    },
  )
  return result.credential
}

export async function listPasskeys(): Promise<WebAuthnCredentialView[]> {
  const res = await request<{ credentials: WebAuthnCredentialView[] }>('/api/auth/webauthn/credentials')
  return res.credentials
}

export async function deletePasskey(id: number): Promise<void> {
  await request(`/api/auth/webauthn/credentials/${id}`, { method: 'DELETE' })
}

export async function fetchWebAuthnConfig(): Promise<WebAuthnRpConfig> {
  return request<WebAuthnRpConfig>('/api/auth/webauthn/config')
}

export async function updateWebAuthnConfig(input: {
  rpID: string
  rpName: string
  origins: string[]
}): Promise<WebAuthnRpConfig> {
  return request<WebAuthnRpConfig>('/api/auth/webauthn/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
