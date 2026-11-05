import { getDb } from '../infrastructure/database'
import { STUDIO_SETTINGS_TABLE } from '../infrastructure/database/schemas'

/**
 * Instance-scoped key/value settings.
 *
 * These are administrator-editable values that must take effect without a
 * restart (logins depend on them), so every read goes straight to SQLite
 * instead of being cached in module state.
 */
export function getSetting(key: string): string | null {
  const db = getDb()
  if (!db) return null
  const row = db.prepare(`SELECT value FROM ${STUDIO_SETTINGS_TABLE} WHERE key = ?`).get(key) as { value?: string } | undefined
  return row?.value ?? null
}

export function getSettingString(key: string, fallback = ''): string {
  return getSetting(key) ?? fallback
}

export function setSetting(key: string, value: string, at = Date.now()): void {
  const db = getDb()
  if (!db) return
  db.prepare(
    `INSERT INTO ${STUDIO_SETTINGS_TABLE} (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, at)
}

export function deleteSetting(key: string): void {
  const db = getDb()
  if (!db) return
  db.prepare(`DELETE FROM ${STUDIO_SETTINGS_TABLE} WHERE key = ?`).run(key)
}
