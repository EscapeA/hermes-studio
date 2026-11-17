/**
 * Regression: collectRefreshCandidates() walks every Provider before any single
 * Provider is refreshed, and it used to resolve custom-Provider OAuth
 * credentials without a guard. A Provider entry whose credentials cannot be
 * resolved (real case: a `nous` entry carrying only the anonymous `anon_token`,
 * which is not an OAuth credential) threw out of the collection step and made
 * every other Provider's "refresh models" action answer 500.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  home: '',
  readConfig: vi.fn(),
  readApp: vi.fn(),
  resolveAccountAuth: vi.fn(),
  copilotToken: vi.fn(),
  fetchModels: vi.fn(),
}))

vi.mock('../../packages/server/src/modules/hermes/services/profiles/profile', () => ({
  getProfileDir: (profile: string) => `${mocks.home}/${profile}`,
  getActiveProfileName: () => 'default',
  listProfileNamesFromDisk: () => ['default'],
}))
vi.mock('../../packages/server/src/modules/studio/public/provider-account', () => ({
  providerAccountId: () => 1,
  providerAccountHome: () => mocks.home,
  providerCredentialDir: () => mocks.home,
  providerScopeKey: (profile: string) => `account:${profile}`,
  withProviderAccount: (_id: unknown, operation: () => unknown) => operation(),
  importAccountProviders: async () => {},
  listUsers: () => [],
}))
vi.mock('../../packages/server/src/modules/studio/public/users', () => ({ listUsers: () => [] }))
vi.mock('../../packages/server/src/modules/studio/public/authorized-provider-runtime', () => ({
  resolveAuthorizedProviderRuntimeCredentials: mocks.resolveAccountAuth,
}))
vi.mock('../../packages/server/src/modules/studio/public/provider-config', async () => {
  const actual = await vi.importActual<any>('../../packages/server/src/modules/hermes/services/profiles/config')
  return {
    ...actual,
    readConfigYamlForProfile: mocks.readConfig,
    readAppConfig: mocks.readApp,
  }
})
vi.mock('../../packages/server/src/modules/studio/public/app-config', () => ({
  readAppConfig: mocks.readApp,
}))
vi.mock('../../packages/server/src/modules/hermes/services/providers/copilot-models', () => ({
  fetchCopilotModelsWithOAuthToken: async () => [],
  resolveCopilotOAuthToken: mocks.copilotToken,
}))
vi.mock('../../packages/server/src/modules/studio/public/provider-catalog', () => ({
  fetchProviderModels: mocks.fetchModels,
}))
vi.mock('../../packages/server/src/modules/studio/public/logging', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { resolveProviderCatalogRefreshTarget } from '../../packages/server/src/modules/hermes/services/providers/model-catalog-cache'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.home = '/tmp/studio-refresh-guard-fixture'
  mocks.readApp.mockResolvedValue({ copilotEnabled: false })
  mocks.copilotToken.mockResolvedValue(null)
  mocks.fetchModels.mockResolvedValue([])
  mocks.resolveAccountAuth.mockReset()
})
afterEach(() => { vi.clearAllMocks() })

const providers = {
  'custom:octopus': {
    name: 'octopus',
    base_url: 'https://octopus.invalid/v1',
    api_key: 'fixture-octopus-key',
    catalog_provider: 'custom:octopus',
    runtime_provider: 'custom:octopus',
    model: 'agent',
    models: { 'deepseek-flash': {} },
  },
  nous: {
    name: 'Nous Portal',
    base_url: 'https://inference-api.nousresearch.com/v1',
    models: {},
    catalog_provider: 'nous',
    runtime_provider: 'nous',
    auth_provider: 'nous',
  },
}

it('resolves a healthy Provider even when another Provider cannot resolve credentials', async () => {
  mocks.readConfig.mockResolvedValue({ providers })
  mocks.resolveAccountAuth.mockRejectedValue(new Error('No nous OAuth credentials were found in the Hermes credential store'))

  const target = await resolveProviderCatalogRefreshTarget('default', 'custom:octopus')

  expect(target).toMatchObject({
    provider: 'custom:octopus',
    base_url: 'https://octopus.invalid/v1',
    api_key: 'fixture-octopus-key',
    credential_kind: 'api_key',
  })
})

it('skips only the credential-less Provider instead of failing resolution entirely', async () => {
  mocks.readConfig.mockResolvedValue({ providers })
  mocks.resolveAccountAuth.mockRejectedValue(new Error('No nous OAuth credentials were found in the Hermes credential store'))

  await expect(resolveProviderCatalogRefreshTarget('default', 'nous')).resolves.toBeNull()
})
