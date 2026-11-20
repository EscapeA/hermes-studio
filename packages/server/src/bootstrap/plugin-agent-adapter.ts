import { withProviderAccount } from '../modules/studio/public/provider-account'
import { configureBuiltinAgents } from '../modules/studio/services/agents/registry'
import { getCodingAgentDefinition, getCodingAgentDefinitions, getCodingAgentStatus, getCodingAgentModels, getPluginAgentManagedMcpServerConfigs, deleteCodingAgent } from '../modules/coding-agents/services'
import { checkAgentUpdateAndPublish, installAgentAndPublish, getAgentUpdateManager } from '../modules/coding-agents/services/update-manager'
import { resolveEkkoProviderRuntimeConfig } from '../modules/ekko/services/provider-runtime'
import { getModelRuntimeCapabilities } from '../modules/studio/public/provider-runtime'
import { PluginError } from '../modules/studio/services/plugins/errors'
import catalog from '../../../../config/agents.json'
import { normalizeTokenUsage, normalizeUsageCost, recordSessionUsage } from '../modules/studio/public/usage'

const metadata = (id: string) => catalog.agents.find(agent => agent.id === id)

configureBuiltinAgents({
  mcpServers: getPluginAgentManagedMcpServerConfigs,
  list: () => getCodingAgentDefinitions().map(agent => ({ id: agent.id, name: agent.name, vendor: agent.provider, description: '', icon: metadata(agent.id)?.icon || '', origin: 'builtin',
    modes: (metadata(agent.id)?.modes || ['scoped', 'global']) as Array<'scoped' | 'global'>, surfaces: ['chat', 'group-chat', 'workflow', 'api'],
    actions: { settings: Boolean(metadata(agent.id)?.config.settings || metadata(agent.id)?.config.mcp), checkUpdate: Boolean(metadata(agent.id)?.installation.updates), upgrade: Boolean(metadata(agent.id)?.installation.updates), remove: Boolean(metadata(agent.id)?.installation.remove), autoUpdate: Boolean(agent.packageName) } })),
  status: async id => { const agent = getCodingAgentDefinition(id); if (!agent) throw new Error('Unknown Agent'); return getCodingAgentStatus(agent) },
  settings: id => ({ name: 'codingAgent.config', params: { agentId: id, section: metadata(id)?.config.settings || metadata(id)?.config.memory ? 'settings' : 'mcp' } }),
  models: async (id, refresh) => (await getCodingAgentModels({ agent: id, refresh })).agents[0],
  checkUpdate: async id => {
    const result = await checkAgentUpdateAndPublish(id)
    if (!result.success) throw new Error(result.message || 'Agent update check failed')
    return { currentVersion: result.tool.version, latestVersion: result.latestVersion, updateAvailable: result.updateAvailable }
  },
  upgrade: async (id, input) => {
    if (!input?.version || typeof input.expectedVersion !== 'string') throw new PluginError('Target and expected versions are required')
    const agent = getCodingAgentDefinition(id)!
    const status = await getCodingAgentStatus(agent)
    if (status.version !== input.expectedVersion) throw new PluginError('Agent version changed; check updates again', 'AGENT_VERSION', 409)
    const result = await installAgentAndPublish(id, { version: input.version })
    if (!result.success) throw new Error(result.message || 'Agent upgrade failed')
    return { installedVersion: result.tool.version, message: result.message }
  },
  remove: async (id, input) => {
    const agent = getCodingAgentDefinition(id)!
    const status = await getCodingAgentStatus(agent)
    if (!input || typeof input.expectedVersion !== 'string' || status.version !== input.expectedVersion) throw new PluginError('Agent version changed; refresh before removing', 'AGENT_VERSION', 409)
    const result = await deleteCodingAgent(id)
    if (!result.success) throw new PluginError(result.message || 'Agent removal failed')
    return { removed: true }
  },
  updatePolicy: async id => (await getAgentUpdateManager()).snapshot()[id],
  setUpdatePolicy: async (id, enabled) => {
    const manager = await getAgentUpdateManager()
    try { await manager.set(id, enabled) }
    catch (error) { throw new PluginError(error instanceof Error ? error.message : 'Invalid update policy', 'AGENT_UPDATE_POLICY', 400) }
    return manager.snapshot()[id]
  },
  scopedModel: async input => withProviderAccount(input.identity.userId, async () => {
    const runtime = await resolveEkkoProviderRuntimeConfig({ profile: input.identity.profile, provider: input.provider, model: input.model, apiMode: input.apiMode })
    input.signal.throwIfAborted()
    const protocol = input.protocols.includes(input.apiMode) ? input.apiMode : input.protocols[0]
    const capabilities = getModelRuntimeCapabilities({ profile: input.identity.profile, provider: input.provider, model: input.model })
    const dispose = () => { input.signal.removeEventListener('abort', dispose) }
    input.signal.addEventListener('abort', dispose, { once: true })
    if (input.signal.aborted) { dispose(); input.signal.throwIfAborted() }
    return { model: { provider: input.provider, model: input.model, apiMode: protocol as 'chat_completions', baseUrl: runtime.baseUrl || '', token: runtime.apiKey || '',
      reasoningEffort: input.reasoningEffort, contextWindow: capabilities.contextWindow || null, outputLimit: capabilities.outputLimit || null }, dispose }
  }, input.identity.profile),
})
