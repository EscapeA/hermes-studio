import { randomBytes } from 'crypto'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from '@simplewebauthn/server'
import { findUserById, type UserRecord } from './users'
import {
  getSetting,
  setSetting,
} from '../repositories/studio-settings-store'
import {
  countUserCredentials,
  credentialIdHex,
  deleteCredential,
  hasAnyCredential,
  insertCredential,
  listCredentialRecords,
  listCredentialViews,
  touchCredential,
  type WebAuthnCredentialView,
} from '../repositories/webauthn-store'

export type { WebAuthnCredentialView }
export { listCredentialViews, countUserCredentials, hasAnyCredential }

/** Delete one of the caller's own credentials. Returns false when not found. */
export function deleteCredentialView(userId: number, id: number): boolean {
  return deleteCredential(userId, id)
}

/** Settings keys backing the RP configuration. */
export const SETTING_RP_ID = 'webauthn.rpId'
export const SETTING_RP_NAME = 'webauthn.rpName'
export const SETTING_ORIGINS = 'webauthn.origins'

const SESSION_TTL_MS = 5 * 60_000
const MAX_CREDENTIAL_NAME = 64
const DEFAULT_RP_NAME = 'Ekko Studio'

export class WebAuthnConfigError extends Error {}
export class WebAuthnSessionError extends Error {}
export class WebAuthnVerificationError extends Error {}
export class WebAuthnConflictError extends Error {}

export interface RpConfig {
  rpID: string
  rpName: string
  origins: string[]
}

/** A pending begin/finish pair. Kept in memory: single use, short TTL. */
interface PendingSession {
  challenge: string
  kind: 'registration' | 'login'
  /** Registration binds the user up front; login learns it from the assertion. */
  userId?: number
  expiresAt: number
}

const sessions = new Map<string, PendingSession>()

function sweepSessions(now = Date.now()): void {
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token)
  }
}

function saveSession(session: Omit<PendingSession, 'expiresAt'>): string {
  sweepSessions()
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { ...session, expiresAt: Date.now() + SESSION_TTL_MS })
  return token
}

/** Take (and destroy) a pending session. Wrong kind or expired ⇒ null. */
function takeSession(token: string, kind: PendingSession['kind']): PendingSession | null {
  const session = sessions.get(token)
  if (!session) return null
  sessions.delete(token)
  if (session.kind !== kind || session.expiresAt <= Date.now()) return null
  return session
}

function splitOrigins(csv: string): string[] {
  const seen = new Set<string>()
  const origins: string[] = []
  for (const value of csv.split(/[\s,]+/)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    let origin: string
    try {
      origin = new URL(trimmed).origin
    } catch {
      throw new WebAuthnConfigError(`Invalid origin: ${trimmed}`)
    }
    // Duplicates are meaningless to the browser and would only make the
    // assertion check repeat itself.
    if (seen.has(origin)) continue
    seen.add(origin)
    origins.push(origin)
  }
  return origins
}

/**
 * Read the RP configuration. Deliberately uncached: an administrator can change
 * it from the settings page and the next login attempt must pick it up.
 */
export function readRpConfig(): RpConfig {
  const rpID = (getSetting(SETTING_RP_ID) ?? '').trim()
  const rpName = (getSetting(SETTING_RP_NAME) ?? '').trim() || DEFAULT_RP_NAME
  const origins = splitOrigins(getSetting(SETTING_ORIGINS) ?? '')
  return { rpID, rpName, origins }
}

export function isConfigured(): boolean {
  try {
    const { rpID, origins } = readRpConfig()
    return Boolean(rpID) && origins.length > 0
  } catch {
    return false
  }
}

function requireRpConfig(): RpConfig {
  let config: RpConfig
  try {
    config = readRpConfig()
  } catch (error) {
    throw new WebAuthnConfigError(String((error as Error).message || error))
  }
  if (!config.rpID) throw new WebAuthnConfigError('WebAuthn RP ID is not configured')
  if (!config.origins.length) throw new WebAuthnConfigError('WebAuthn origins are not configured')
  return config
}

/** Current RP configuration for the settings page, with validation errors surfaced. */
export function describeRpConfig(): {
  configured: boolean
  rpID: string
  rpName: string
  origins: string[]
  credentialsBound: boolean
  error?: string
} {
  try {
    const config = readRpConfig()
    return {
      configured: Boolean(config.rpID) && config.origins.length > 0,
      rpID: config.rpID,
      rpName: config.rpName,
      origins: config.origins,
      credentialsBound: hasAnyCredential(),
    }
  } catch (error) {
    return {
      configured: false,
      rpID: getSetting(SETTING_RP_ID) ?? '',
      rpName: getSetting(SETTING_RP_NAME) ?? '',
      origins: [],
      credentialsBound: hasAnyCredential(),
      error: String((error as Error).message || error),
    }
  }
}

/**
 * Persist new RP configuration.
 *
 * `rpID` must be a bare hostname (no scheme, no port, no path) because browsers
 * compare it verbatim against the page's effective domain. Origins must be full
 * origins so the assertion's clientData.origin check has something exact to match.
 */
export function writeRpConfig(input: { rpID: string; rpName?: string; origins: string | string[] }): RpConfig {
  const rpID = String(input.rpID || '').trim().toLowerCase()
  if (!rpID) throw new WebAuthnConfigError('RP ID is required')
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(rpID)) throw new WebAuthnConfigError('RP ID must not include a scheme')
  if (/[/\\\s]/.test(rpID)) throw new WebAuthnConfigError('RP ID must not include a path')
  if (rpID.includes(':')) throw new WebAuthnConfigError('RP ID must not include a port')
  if (!/^[a-z0-9.-]+$/.test(rpID)) throw new WebAuthnConfigError('RP ID contains invalid characters')

  const rawOrigins = Array.isArray(input.origins) ? input.origins.join(',') : String(input.origins || '')
  const origins = splitOrigins(rawOrigins)
  if (!origins.length) throw new WebAuthnConfigError('At least one origin is required')
  for (const origin of origins) {
    const hostname = new URL(origin).hostname.toLowerCase()
    // Browsers reject a ceremony whose page domain is not the RP ID or a subdomain.
    if (hostname !== rpID && !hostname.endsWith(`.${rpID}`)) {
      throw new WebAuthnConfigError(`Origin ${origin} is not within RP ID ${rpID}`)
    }
  }

  const rpName = String(input.rpName || '').trim() || DEFAULT_RP_NAME
  setSetting(SETTING_RP_ID, rpID)
  setSetting(SETTING_RP_NAME, rpName)
  setSetting(SETTING_ORIGINS, origins.join(','))
  return { rpID, rpName, origins }
}

// --- Credential (de)serialisation -----------------------------------------

/** On-disk JSON shape. Stored as strings so it survives SQLite text round-trips. */
interface StoredCredentialJson {
  id: string
  publicKey: string
  counter: number
  transports?: string[]
}

function toStoredJson(credential: WebAuthnCredential): StoredCredentialJson {
  return {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports as string[] | undefined,
  }
}

function fromStoredJson(raw: string): WebAuthnCredential | null {
  try {
    const parsed = JSON.parse(raw) as StoredCredentialJson
    if (!parsed?.id || typeof parsed.publicKey !== 'string') return null
    return {
      id: parsed.id,
      publicKey: new Uint8Array(Buffer.from(parsed.publicKey, 'base64url')),
      counter: Number(parsed.counter) || 0,
      transports: parsed.transports as WebAuthnCredential['transports'],
    }
  } catch {
    return null
  }
}

function userHandleFor(userId: number): Uint8Array<ArrayBuffer> {
  // Stable and reversible: the decimal user id. Login resolves the account from
  // the discoverable credential's userHandle without asking for a username.
  // Bytes are copied into a fresh ArrayBuffer so the element type is
  // Uint8Array<ArrayBuffer>, which is what @simplewebauthn's Uint8Array_ needs.
  const bytes = Buffer.from(String(userId), 'utf8')
  const buffer = new ArrayBuffer(bytes.length)
  const view = new Uint8Array(buffer)
  view.set(bytes)
  return view
}

function userIdFromHandle(handle: Uint8Array | undefined): number | null {
  if (!handle) return null
  const parsed = Number(Buffer.from(handle).toString('utf8'))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

// --- Registration ----------------------------------------------------------

export async function beginRegistration(userId: number): Promise<{ sessionToken: string; options: unknown }> {
  const config = requireRpConfig()
  const user = findUserById(userId)
  if (!user) throw new WebAuthnVerificationError('User not found')

  const existing = listCredentialRecords(userId)
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: user.username,
    userDisplayName: user.username,
    userID: userHandleFor(userId),
    attestationType: 'none',
    // excludeCredentials needs the RAW credential id, not our SHA-256 column:
    // the browser compares it against the authenticator's own credential ids.
    excludeCredentials: existing
      .map(record => fromStoredJson(record.credential))
      .filter((credential): credential is WebAuthnCredential => credential !== null)
      .map(credential => ({ id: credential.id, transports: credential.transports })),
    authenticatorSelection: {
      // Resident (discoverable) key is what makes this a Passkey: the authenticator
      // stores the credential and the user signs in without typing a username.
      residentKey: 'required',
      userVerification: 'preferred',
    },
  })

  const sessionToken = saveSession({ challenge: options.challenge, kind: 'registration', userId })
  return { sessionToken, options }
}

export async function finishRegistration(input: {
  userId: number
  sessionToken: string
  response: RegistrationResponseJSON
  name?: string
}): Promise<WebAuthnCredentialView> {
  const session = takeSession(input.sessionToken, 'registration')
  if (!session || session.userId !== input.userId) {
    throw new WebAuthnSessionError('Registration session expired, please try again')
  }
  const config = requireRpConfig()

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: session.challenge,
      expectedOrigin: config.origins,
      expectedRPID: config.rpID,
      requireUserVerification: false,
    })
  } catch (error) {
    throw new WebAuthnVerificationError(`Registration failed: ${String((error as Error).message || error)}`)
  }
  if (!verification.verified || !verification.registrationInfo) {
    throw new WebAuthnVerificationError('Registration could not be verified')
  }

  const stored = toStoredJson(verification.registrationInfo.credential)
  const hex = credentialIdHex(verification.registrationInfo.credential.id)
  const name = String(input.name || '').trim().slice(0, MAX_CREDENTIAL_NAME)

  try {
    const record = insertCredential({
      userId: input.userId,
      credentialIdHex: hex,
      credentialJson: JSON.stringify(stored),
      name,
    })
    return { id: record.id, name: record.name, created_at: record.created_at, last_used_at: null }
  } catch (error) {
    if (/unique/i.test(String((error as Error).message || error))) {
      throw new WebAuthnConflictError('This authenticator is already registered')
    }
    throw error
  }
}

// --- Login -----------------------------------------------------------------

export async function beginLogin(): Promise<{ sessionToken: string; options: unknown }> {
  const config = requireRpConfig()
  if (!hasAnyCredential()) throw new WebAuthnVerificationError('No passkey is registered yet')

  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    // Discoverable credentials: no allowCredentials, the authenticator picks one
    // from its own store and returns the userHandle we embedded at registration.
    userVerification: 'preferred',
  })

  const sessionToken = saveSession({ challenge: options.challenge, kind: 'login' })
  return { sessionToken, options }
}

export async function finishLogin(input: {
  sessionToken: string
  response: AuthenticationResponseJSON
}): Promise<UserRecord> {
  const session = takeSession(input.sessionToken, 'login')
  if (!session) throw new WebAuthnSessionError('Login session expired, please try again')
  const config = requireRpConfig()

  const userId = userIdFromHandle(
    input.response.response.userHandle
      ? new Uint8Array(Buffer.from(input.response.response.userHandle, 'base64url'))
      : undefined,
  )
  if (!userId) throw new WebAuthnVerificationError('The authenticator did not identify a user')

  const user = findUserById(userId)
  if (!user) throw new WebAuthnVerificationError('User not found')
  if (user.status !== 'active') throw new WebAuthnVerificationError('This account is disabled')

  // Match the returned credential id against this user's stored credentials.
  const hex = credentialIdHex(input.response.id)
  const record = listCredentialRecords(userId).find(candidate => candidate.credential_id_hex === hex)
  if (!record) throw new WebAuthnVerificationError('This passkey is not registered for this account')
  const credential = fromStoredJson(record.credential)
  if (!credential) throw new WebAuthnVerificationError('Stored passkey data is unreadable')

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: session.challenge,
      expectedOrigin: config.origins,
      expectedRPID: config.rpID,
      credential,
      requireUserVerification: false,
    })
  } catch (error) {
    throw new WebAuthnVerificationError(`Passkey verification failed: ${String((error as Error).message || error)}`)
  }
  if (!verification.verified) throw new WebAuthnVerificationError('Passkey verification failed')

  // Persist the bumped counter so cloned authenticators become detectable.
  const updated: WebAuthnCredential = {
    ...credential,
    counter: verification.authenticationInfo.newCounter,
  }
  touchCredential(record.credential_id_hex, JSON.stringify(toStoredJson(updated)))
  return user
}

// --- Public status ---------------------------------------------------------

export function publicStatus(): { enabled: boolean; hasCredentials: boolean } {
  return { enabled: isConfigured(), hasCredentials: hasAnyCredential() }
}

/** Test hook: drop all pending challenges. */
export function clearSessions(): void {
  sessions.clear()
}
