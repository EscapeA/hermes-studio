import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import YAML from 'js-yaml'

const fixture = vi.hoisted(() => ({ home: '', enabled: true }))
vi.mock('../../packages/server/src/modules/studio/public/config', () => ({ config: { get appHome() { return fixture.home }, port: 18648 } }))
vi.mock('../../packages/server/src/modules/studio/repositories/users-store', () => ({
  findUserById: (id: number | string) => fixture.enabled ? { id: Number(id), status: 'active' } : null,
  getDefaultProfileForUser: () => 'default',
  listUsers: () => [{ id: 1, status: 'active', profiles: ['default', 'work'] }, { id: 2, status: 'active', profiles: ['default'] }],
}))

import { providerAccountHome, providerCredentialDir, configureProviderSources, importAccountProviders, providerProfileDir, withProviderAccount } from '../../packages/server/src/modules/studio/public/provider-account'
vi.mock('../../packages/server/src/modules/studio/public/app-config', () => ({ readAppConfig: async () => ({}), providerDisplayLabel: (_config: any, _profile: string, _provider: string, label: string) => label, invalidateAppConfigCache: () => {} }))
import { updateSupplementalConfig, supplementalConfigForDisplay } from '../../packages/server/src/modules/studio/services/providers/supplemental-routing'
import { readConfigYamlForProfile, updateConfigYamlForProfile, readAppConfig, writeAppConfig } from '../../packages/server/src/modules/studio/public/provider-config'
import { configureAuthorizedProviderRuntime } from '../../packages/server/src/modules/studio/public/authorized-provider-runtime'
import { resolveEkkoProviderRuntimeConfig } from '../../packages/server/src/modules/ekko/services/provider-runtime'
import { getProviderEditorDetail, updateProviderEditorDetail } from '../../packages/server/src/modules/hermes/services/providers/provider-editor'
import { resolveBridgeRunModelConfig } from '../../packages/server/src/modules/studio/services/chat-run/model-config'
import { legacyProviderCredentials } from '../../packages/server/src/modules/studio/middleware/legacy-provider-credentials'
import { LEGACY_PROVIDER_CREDENTIAL } from '../../packages/server/src/modules/studio/contracts/legacy-provider-credential'

let source: string
beforeEach(async () => {
  fixture.home = await mkdtemp(join(tmpdir(), 'studio-provider-store-'))
  fixture.enabled = true
  source = join(fixture.home, 'legacy')
  for (const profile of ['default', 'work']) {
    const dir = join(source, profile)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'config.yaml'), YAML.dump({
      model: { provider: 'deepseek', default: 'family/model', temperature: 0.7 },
      agent: { max_turns: 32 }, mcp_servers: { kept: { command: 'node' } },
      custom_providers: [{ name: 'relay', base_url: 'https://relay.invalid/v1', key_env: 'RELAY_KEY' }],
    }))
    await writeFile(join(dir, '.env'), 'DEEPSEEK_API_KEY=legacy-key\nRELAY_KEY=relay-key\nTOOL_SECRET=keep-tool-secret\n')
    await writeFile(join(dir, 'auth.json'), JSON.stringify({ providers: { 'openai-codex': { tokens: { access_token: 'private-token' } } }, unrelated: 'kept' }))
  }
  configureProviderSources({ profileDir: profile => join(source, profile), profiles: userId => userId === 1 ? ['work', 'default'] : ['default'], environmentKeys: ['DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL'], environmentMap: { deepseek: { api_key_env: 'DEEPSEEK_API_KEY', base_url_env: 'DEEPSEEK_BASE_URL' } } })
})
afterEach(async () => { await rm(fixture.home, { recursive: true, force: true }) })

it('keeps stored credentials and model defaults when an old client echoes the readiness marker during an edit', async () => {
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    const home = providerAccountHome()
    const credentials = await readFile(join(home, '.env'), 'utf8')
    const model = (await readConfigYamlForProfile('work')).model
    const detail = await getProviderEditorDetail('work', 'deepseek')
    const ctx = { method: 'PATCH', path: '/api/hermes/config/providers/deepseek/editor',
      request: { body: { api_key: LEGACY_PROVIDER_CREDENTIAL, credential_action: 'replace', label: 'Renamed DeepSeek' } } } as any
    await legacyProviderCredentials(ctx, async () => {
      const result = await updateProviderEditorDetail('work', 'deepseek', ctx.request.body, detail.revision)
      expect(result.detail.credential_configured).toBe(true)
      expect(result.changed).not.toContain('api_key_replaced')
    })
    expect(await readFile(join(home, '.env'), 'utf8')).toBe(credentials)
    expect((await readConfigYamlForProfile('work')).model).toEqual(model)
    expect((await resolveEkkoProviderRuntimeConfig({ profile: 'work', provider: 'deepseek' })).apiKey).toBe('legacy-key')
  })
})

it('imports every accessible Profile once, keeps only provider state and preserves private backups', async () => {
  await withProviderAccount(1, async () => {
    await Promise.all([importAccountProviders(), importAccountProviders()])
    const dir = providerProfileDir('work')
    const cfg = YAML.load(await readFile(join(dir, 'config.yaml'), 'utf8')) as any
    expect(cfg.model.default).toBe('family/model')
    expect(cfg.agent).toBeUndefined()
    expect(await readFile(join(providerAccountHome(), '.env'), 'utf8')).toContain('RELAY_KEY=relay-key')
    expect(await readFile(join(providerAccountHome(), '.env'), 'utf8')).not.toContain('TOOL_SECRET')
    expect(JSON.parse(await readFile(join(dir, 'source-backup.json'), 'utf8')).config).toContain('mcp_servers')
    expect((await stat(join(providerAccountHome(), 'auth.json'))).mode & 0o777).toBe(0o600)
    await writeFile(join(providerAccountHome(), '.env'), 'DEEPSEEK_API_KEY=studio-edited\n')
    await importAccountProviders()
    expect(await readFile(join(providerAccountHome(), '.env'), 'utf8')).toBe('DEEPSEEK_API_KEY=studio-edited\n')
  })
})

it('isolates two users sharing a Profile and rejects inaccessible Profiles', async () => {
  let firstDir = ''
  await withProviderAccount(1, async () => { await importAccountProviders(); firstDir = providerAccountHome(); await writeFile(join(firstDir, '.env'), 'edited-by-one') })
  await withProviderAccount(2, async () => {
    await importAccountProviders()
    expect(providerAccountHome()).not.toBe(firstDir)
    expect(await readFile(join(providerAccountHome(), '.env'), 'utf8')).toContain('legacy-key')
    expect(() => providerProfileDir('work')).toThrow('not accessible')
  })
})

it('rejects duplicate names and display labels atomically, including concurrent creation', async () => {
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    const home = providerAccountHome()
    const before = await readFile(join(home, 'config.yaml'), 'utf8')
    await expect(updateConfigYamlForProfile('work', config => {
      config.custom_providers = [{ name: '  DEEPSEEK  ', base_url: 'https://other.invalid', api_key: 'other-key' }]
      return config
    })).rejects.toMatchObject({ status: 409 })
    expect(await readFile(join(home, 'config.yaml'), 'utf8')).toBe(before)
    await expect(writeAppConfig({ providerLabels: { work: { deepseek: 'relay' } } })).rejects.toMatchObject({ status: 409 })
    const detail = await getProviderEditorDetail('work', 'deepseek')
    await expect(updateProviderEditorDetail('work', 'deepseek', { label: ' RELAY ' }, detail.revision)).rejects.toMatchObject({ status: 409 })
    const results = await Promise.allSettled(['one', 'two'].map(id => updateConfigYamlForProfile('default', config => {
      config.providers[id] = { name: 'Same Name', base_url: 'https://fixture.invalid' }
      return config
    })))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  })
})

it('retains inline primary credentials during migration', async () => {
  await writeFile(join(source, 'default/config.yaml'), YAML.dump({ model: {
    provider: 'anthropic', default: 'claude-sonnet', base_url: 'https://fixture.services.ai.azure.com/anthropic', api_key: 'inline-fixture-key',
  } }))
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    expect(await resolveEkkoProviderRuntimeConfig({ profile: 'default', provider: 'anthropic' })).toMatchObject({
      apiKey: 'inline-fixture-key', baseUrl: 'https://fixture.services.ai.azure.com/anthropic',
    })
    expect((await readConfigYamlForProfile('default')).model.api_key).toBeUndefined()
  })
})

it('preserves separate credentials for differently named Providers that use the same environment key', async () => {
  const path = join(source, 'work/config.yaml')
  const config = YAML.load(await readFile(path, 'utf8')) as any
  config.custom_providers = [{ name: 'relay-two', base_url: 'https://second.invalid/v1', key_env: 'RELAY_KEY' }]
  await writeFile(path, YAML.dump(config))
  await writeFile(join(source, 'work/.env'), 'DEEPSEEK_API_KEY=legacy-key\nRELAY_KEY=second-key\n')
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    expect((await resolveEkkoProviderRuntimeConfig({ profile: 'work', provider: 'custom:relay' })).apiKey).toBe('relay-key')
    expect((await resolveEkkoProviderRuntimeConfig({ profile: 'default', provider: 'custom:relay-two' })).apiKey).toBe('second-key')
  })
})

it('keeps an inline credential editable when the imported entry also names an environment key', async () => {
  const path = join(source, 'default/config.yaml')
  const config = YAML.load(await readFile(path, 'utf8')) as any
  config.custom_providers[0].api_key = 'inline-key'
  await writeFile(path, YAML.dump(config))
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    expect((await readConfigYamlForProfile('default')).providers['custom:relay'].key_env).toBeUndefined()
    const detail = await getProviderEditorDetail('default', 'custom:relay')
    await updateProviderEditorDetail('default', 'custom:relay', { credential_action: 'replace', api_key: 'replacement-key' }, detail.revision)
    expect((await resolveEkkoProviderRuntimeConfig({ profile: 'default', provider: 'custom:relay' })).apiKey).toBe('replacement-key')
  })
})

it('does not change a source Profile or persist a poisoned snapshot when import validation fails', async () => {
  const path = join(source, 'default/config.yaml')
  await writeFile(path, 'model: [broken')
  await withProviderAccount(1, async () => {
    await expect(importAccountProviders()).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe('model: [broken')
    await writeFile(path, 'model: {provider: deepseek, default: repaired}\n')
    await importAccountProviders()
    expect(await readFile(join(providerProfileDir('default'), 'config.yaml'), 'utf8')).toContain('repaired')
  })
})

it('shares Provider edits and credentials across Profiles of one account while retaining their model selections', async () => {
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    const first = await readConfigYamlForProfile('default')
    const second = await readConfigYamlForProfile('work')
    expect(first.providers).toEqual(second.providers)
    expect(Object.values(first.providers).filter((provider: any) => provider.runtime_provider === 'deepseek')).toHaveLength(1)
    await updateConfigYamlForProfile('work', config => {
      config.providers.deepseek.base_url = 'https://edited.invalid/v1'
      config.model = { provider: 'deepseek', default: 'work-model' }
      return config
    })
    expect((await readConfigYamlForProfile('default')).providers.deepseek.base_url).toBe('https://edited.invalid/v1')
    expect((await readConfigYamlForProfile('default')).model.default).toBe('family/model')
    expect((await readConfigYamlForProfile('work')).model.default).toBe('work-model')
    await expect(readFile(join(providerProfileDir('work'), '.env'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

it('keeps the default Provider when endpoints or credentials conflict', async () => {
  await writeFile(join(source, 'work/.env'), 'DEEPSEEK_API_KEY=work-key\nDEEPSEEK_BASE_URL=https://work.invalid/v1\nRELAY_KEY=relay-key\n')
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    const first = await readConfigYamlForProfile('default')
    const second = await readConfigYamlForProfile('work')
    const entries = Object.entries(first.providers).filter(([, entry]: any) => entry.runtime_provider === 'deepseek') as Array<[string, any]>
    expect(entries).toHaveLength(1)
    expect(entries[0][0]).toBe('deepseek')
    expect(entries[0][1].name).toBe('DeepSeek')
    expect(second.providers).toEqual(first.providers)
    expect(second.model.provider).toBe('deepseek')
    const resolved = await resolveEkkoProviderRuntimeConfig({ profile: 'work', provider: 'deepseek', model: 'family/model' })
    expect(resolved.apiKey).toBe('legacy-key')
    expect(resolved.baseUrl).not.toBe('https://work.invalid/v1')
    expect(await readFile(join(providerAccountHome(), 'profile-import-backups.json'), 'utf8')).toContain('work-key')
  })
})

it('keeps only the first OAuth grant and backs up the discarded grant', async () => {
  await writeFile(join(source, 'work/auth.json'), JSON.stringify({ providers: { 'openai-codex': { tokens: { access_token: 'work-oauth' } } } }))
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    const config = await readConfigYamlForProfile('work')
    const entries = Object.entries(config.providers).filter(([, entry]: any) => entry.auth_provider === 'openai-codex') as Array<[string, any]>
    expect(entries).toHaveLength(1)
    for (const [, entry] of entries) {
      expect(entry.api_mode).toBe('codex_responses')
      expect(Object.keys(entry.models || {})).toEqual([])
    }
    expect(entries[0][1].auth_scope).toBeUndefined()
    expect(await readFile(join(providerAccountHome(), 'profile-import-backups.json'), 'utf8')).toContain('work-oauth')
    configureAuthorizedProviderRuntime({
      isAuthorizedRuntimeProvider: provider => provider === 'openai-codex',
      resolveAuthorizedProviderRuntimeCredentials: async input => {
        expect(input.provider).toBe('openai-codex')
        const auth = JSON.parse(await readFile(join(providerCredentialDir(input.credentialScope), 'auth.json'), 'utf8'))
        return { provider: input.provider, apiKey: auth.providers['openai-codex'].tokens.access_token, baseUrl: 'https://chatgpt.com/backend-api/codex', apiMode: 'codex_responses' }
      },
    })
    expect((await resolveEkkoProviderRuntimeConfig({ profile: 'default', provider: 'openai-codex' })).apiKey).toBe('private-token')
    expect((await resolveEkkoProviderRuntimeConfig({ profile: 'work', provider: 'openai-codex' })).apiKey).toBe('private-token')
  })
})

it('shares labels and preferred models when users edit them from another Profile', async () => {
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    await writeAppConfig({ providerLabels: { work: { deepseek: 'Shared label' } }, providerPreferredModels: { work: { deepseek: 'family/model' } } })
    const view = await readAppConfig()
    expect(view.providerLabels?.default?.deepseek).toBe('Shared label')
    expect(view.providerPreferredModels?.default?.deepseek).toBe('family/model')
    await writeAppConfig({ providerLabels: { ...view.providerLabels, default: { deepseek: 'Renamed globally' } } })
    expect((await readAppConfig()).providerLabels?.work?.deepseek).toBe('Renamed globally')
    expect(JSON.parse(await readFile(join(providerAccountHome(), 'display.json'), 'utf8')).providerLabels).toEqual({ account: { deepseek: 'Renamed globally' } })
  })
})

it('edits merged Provider identities and preferences from any Profile without creating a second copy', async () => {
  await writeFile(join(source, 'work/.env'), 'DEEPSEEK_API_KEY=work-key\n')
  await withProviderAccount(1, async () => {
    await importAccountProviders()
    const config = await readConfigYamlForProfile('default')
    expect(Object.keys(config.providers).filter(id => id.includes('deepseek'))).toEqual(['deepseek'])
    const id = 'deepseek'
    const before = await getProviderEditorDetail('work', id)
    expect(before.credential_configured).toBe(true)
    await updateProviderEditorDetail('work', id, { label: 'Shared provider', preferred_model: 'new/model', credential_action: 'replace', api_key: 'edited-account-key' }, before.revision)
    const after = await getProviderEditorDetail('default', id)
    expect(after).toMatchObject({ label: 'Shared provider', preferred_model: 'new/model', credential_configured: true })
    expect((await resolveEkkoProviderRuntimeConfig({ profile: 'default', provider: id })).apiKey).toBe('edited-account-key')
    const primary = await getProviderEditorDetail('work', 'deepseek')
    await updateProviderEditorDetail('work', 'deepseek', { base_url: 'https://edited.invalid/v1' }, primary.revision)
    expect((await resolveEkkoProviderRuntimeConfig({ profile: 'default', provider: 'deepseek' })).baseUrl).toBe('https://edited.invalid/v1')
  })
})

