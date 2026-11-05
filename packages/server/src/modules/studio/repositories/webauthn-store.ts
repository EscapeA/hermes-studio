import { createHash } from 'crypto'
import { getDb } from '../infrastructure/database'
import { WEBAUTHN_CREDENTIALS_TABLE } from '../infrastructure/database/schemas'

/** Stored WebAuthn credential row. */
export interface WebAuthnCredentialRecord {
  id: number
  user_id: number
  credential_id_hex: string
  credential: string
  name: string
  created_at: number
  last_used_at: number | null
}

/** Credential shape exposed to clients — never includes the public key blob. */
export interface WebAuthnCredentialView {
  id: number
  name: string
  created_at: number
  last_used_at: number | null
}

export function credentialIdHex(id: Uint8Array | Buffer | string): string {
  const bytes = typeof id === 'string' ? Buffer.from(id, 'base64url') : Buffer.from(id)
  return createHash('sha256').update(bytes).digest('hex')
}

export function listCredentialRecords(userId: number): WebAuthnCredentialRecord[] {
  const db = getDb()
  if (!db) return []
  return db.prepare(
    `SELECT * FROM ${WEBAUTHN_CREDENTIALS_TABLE} WHERE user_id = ? ORDER BY created_at DESC`,
  ).all(userId) as unknown as WebAuthnCredentialRecord[]
}

export function listCredentialViews(userId: number): WebAuthnCredentialView[] {
  return listCredentialRecords(userId).map(record => ({
    id: record.id,
    name: record.name,
    created_at: record.created_at,
    last_used_at: record.last_used_at,
  }))
}

export function insertCredential(input: {
  userId: number
  credentialIdHex: string
  credentialJson: string
  name: string
  at?: number
}): WebAuthnCredentialRecord {
  const db = getDb()
  if (!db) throw new Error('Database is not available')
  const at = input.at ?? Date.now()
  const result = db.prepare(
    `INSERT INTO ${WEBAUTHN_CREDENTIALS_TABLE}
       (user_id, credential_id_hex, credential, name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(input.userId, input.credentialIdHex, input.credentialJson, input.name, at)
  return {
    id: Number(result.lastInsertRowid),
    user_id: input.userId,
    credential_id_hex: input.credentialIdHex,
    credential: input.credentialJson,
    name: input.name,
    created_at: at,
    last_used_at: null,
  }
}

/** Persist a bumped signature counter and the last-used timestamp. */
export function touchCredential(credentialIdHexValue: string, credentialJson: string, at = Date.now()): void {
  const db = getDb()
  if (!db) return
  db.prepare(
    `UPDATE ${WEBAUTHN_CREDENTIALS_TABLE} SET credential = ?, last_used_at = ?
     WHERE credential_id_hex = ?`,
  ).run(credentialJson, at, credentialIdHexValue)
}

/** Delete one credential only when it belongs to the caller (IDOR guard). */
export function deleteCredential(userId: number, id: number): boolean {
  const db = getDb()
  if (!db) return false
  const result = db.prepare(
    `DELETE FROM ${WEBAUTHN_CREDENTIALS_TABLE} WHERE id = ? AND user_id = ?`,
  ).run(id, userId)
  return result.changes > 0
}

export function countUserCredentials(userId: number): number {
  const db = getDb()
  if (!db) return 0
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM ${WEBAUTHN_CREDENTIALS_TABLE} WHERE user_id = ?`,
  ).get(userId) as { count?: number } | undefined
  return Number(row?.count || 0)
}

/** Whether anybody on this instance has bound a passkey (login-page gate). */
export function hasAnyCredential(): boolean {
  const db = getDb()
  if (!db) return false
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM ${WEBAUTHN_CREDENTIALS_TABLE}`,
  ).get() as { count?: number } | undefined
  return Number(row?.count || 0) > 0
}
