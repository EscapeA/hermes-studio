import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'

/**
 * Passkey (WebAuthn) backend tests.
 *
 * These cover the parts that do not need a real authenticator: RP configuration
 * validation (the misconfiguration that produces the useless "unknown error" on
 * phones), credential storage scoping, and the one-shot challenge lifecycle.
 * The full ceremony is exercised separately with a Chrome virtual authenticator.
 */

let db: DatabaseSync
let webauthn: typeof import('../../packages/server/src/modules/studio/public/webauthn')
let store: typeof import('../../packages/server/src/modules/studio/repositories/webauthn-store')

const SETTINGS_DDL = `CREATE TABLE studio_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`

const CREDENTIALS_DDL = `CREATE TABLE webauthn_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  credential_id_hex TEXT NOT NULL UNIQUE,
  credential TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
)`

const USERS_DDL = `CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  avatar TEXT NOT NULL DEFAULT ''
)`

beforeEach(async () => {
  vi.resetModules()
  db = new DatabaseSync(':memory:')
  db.exec(SETTINGS_DDL)
  db.exec(CREDENTIALS_DDL)
  db.exec(USERS_DDL)
  db.prepare('INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (1, ?, ?, ?, 1, 1)')
    .run('aries', 'scrypt:aa:bb', 'super_admin')
  vi.doMock('../../packages/server/src/modules/studio/infrastructure/database/index', () => ({ getDb: () => db }))
  vi.doMock('../../packages/server/src/modules/studio/public/profile-config', () => ({ listProfileNamesFromDisk: () => [] }))
  webauthn = await import('../../packages/server/src/modules/studio/public/webauthn')
  store = await import('../../packages/server/src/modules/studio/repositories/webauthn-store')
})

afterEach(() => {
  db.close()
  vi.restoreAllMocks()
})

function seedCredential(userId: number, hex: string, id = `id-${hex}`) {
  return store.insertCredential({
    userId,
    credentialIdHex: hex,
    credentialJson: JSON.stringify({ id, publicKey: 'AAAA', counter: 0 }),
    name: 'test',
  })
}

// --- RP configuration -----------------------------------------------------

it('reports passkeys as unconfigured until an RP ID and origin are set', () => {
  expect(webauthn.publicStatus()).toEqual({ enabled: false, hasCredentials: false })
  expect(() => webauthn.readRpConfig()).not.toThrow()
  expect(webauthn.isConfigured()).toBe(false)
})

it('accepts a bare RP ID with a matching origin and applies it immediately', () => {
  const config = webauthn.writeRpConfig({
    rpID: 'hermes-studio.example.com',
    rpName: 'Ekko Studio',
    origins: 'https://hermes-studio.example.com',
  })
  expect(config.rpID).toBe('hermes-studio.example.com')
  expect(config.origins).toEqual(['https://hermes-studio.example.com'])
  // No cache between write and read: the next login must see the new value.
  expect(webauthn.readRpConfig().rpID).toBe('hermes-studio.example.com')
  expect(webauthn.publicStatus().enabled).toBe(true)
})

it('normalises origins and allows several of them', () => {
  const config = webauthn.writeRpConfig({
    rpID: 'example.com',
    origins: 'https://example.com/, https://app.example.com \n https://example.com',
  })
  expect(config.origins).toEqual(['https://example.com', 'https://app.example.com'])
})

it('rejects an RP ID carrying a scheme, port or path', () => {
  for (const rpID of ['https://example.com', 'example.com:443', 'example.com/app', 'exa mple.com']) {
    expect(() => webauthn.writeRpConfig({ rpID, origins: 'https://example.com' }))
      .toThrow(webauthn.WebAuthnConfigError)
  }
})

it('rejects an origin that the RP ID does not cover', () => {
  // A browser would refuse this ceremony anyway; failing at config time turns a
  // silent "unknown error" into an actionable message.
  expect(() => webauthn.writeRpConfig({
    rpID: 'hermes-studio.example.com',
    origins: 'https://other.example.net',
  })).toThrow(webauthn.WebAuthnConfigError)
})

it('rejects a non-URL origin', () => {
  expect(() => webauthn.writeRpConfig({ rpID: 'example.com', origins: 'not-a-url' }))
    .toThrow(webauthn.WebAuthnConfigError)
})

it('surfaces a configuration error instead of throwing when reading status', () => {
  db.prepare('INSERT INTO studio_settings VALUES (?, ?, ?)').run('webauthn.rpId', 'example.com', 1)
  db.prepare('INSERT INTO studio_settings VALUES (?, ?, ?)').run('webauthn.origins', 'garbage', 1)
  const described = webauthn.describeRpConfig()
  expect(described.configured).toBe(false)
  expect(described.error).toBeTruthy()
})

// --- Credential storage ---------------------------------------------------

it('computes the stored id digest from the raw credential id', () => {
  // SHA-256 of the base64url-decoded credential id keeps the unique index short.
  const a = store.credentialIdHex('AAAA')
  const b = store.credentialIdHex('AAAB')
  expect(a).toHaveLength(64)
  expect(a).not.toBe(b)
})

it('scopes credential deletion to the owner', () => {
  const record = seedCredential(1, 'a'.repeat(64))
  expect(store.deleteCredential(2, record.id)).toBe(false)
  expect(store.countUserCredentials(1)).toBe(1)
  expect(store.deleteCredential(1, record.id)).toBe(true)
  expect(store.countUserCredentials(1)).toBe(0)
})

it('lists only the requesting account credentials without leaking keys', () => {
  seedCredential(1, 'b'.repeat(64))
  seedCredential(2, 'c'.repeat(64))
  const own = webauthn.listCredentialViews(1)
  expect(own).toHaveLength(1)
  expect(Object.keys(own[0]).sort()).toEqual(['created_at', 'id', 'last_used_at', 'name'])
  expect(webauthn.hasAnyCredential()).toBe(true)
})

it('rejects a duplicate credential id', () => {
  seedCredential(1, 'd'.repeat(64))
  expect(() => seedCredential(1, 'd'.repeat(64))).toThrow()
})

// --- Challenge lifecycle --------------------------------------------------

it('refuses to begin a login when no passkey exists yet', async () => {
  webauthn.writeRpConfig({ rpID: 'example.com', origins: 'https://example.com' })
  await expect(webauthn.beginLogin()).rejects.toThrow(/No passkey is registered/)
})

it('issues distinct one-shot challenges and rejects replays', async () => {
  webauthn.writeRpConfig({ rpID: 'example.com', origins: 'https://example.com' })
  seedCredential(1, 'e'.repeat(64))

  const first = await webauthn.beginLogin()
  const second = await webauthn.beginLogin()
  expect(first.sessionToken).not.toBe(second.sessionToken)
  expect((first.options as { challenge: string }).challenge)
    .not.toBe((second.options as { challenge: string }).challenge)

  // Consuming an unknown token must fail rather than fall through to success.
  await expect(webauthn.finishLogin({ sessionToken: 'nope', response: {} as never }))
    .rejects.toThrow(webauthn.WebAuthnSessionError)
})

it('rejects an expired registration session', async () => {
  webauthn.writeRpConfig({ rpID: 'example.com', origins: 'https://example.com' })
  const begin = await webauthn.beginRegistration(1)
  expect(begin.sessionToken).toHaveLength(64)
  webauthn.clearSessions()
  await expect(webauthn.finishRegistration({
    userId: 1,
    sessionToken: begin.sessionToken,
    response: {} as never,
  })).rejects.toThrow(webauthn.WebAuthnSessionError)
})

it('rejects a registration session belonging to another user', async () => {
  webauthn.writeRpConfig({ rpID: 'example.com', origins: 'https://example.com' })
  const begin = await webauthn.beginRegistration(1)
  await expect(webauthn.finishRegistration({
    userId: 2,
    sessionToken: begin.sessionToken,
    response: {} as never,
  })).rejects.toThrow(webauthn.WebAuthnSessionError)
})

it('requires RP configuration before starting a registration', async () => {
  await expect(webauthn.beginRegistration(1)).rejects.toThrow(webauthn.WebAuthnConfigError)
})
