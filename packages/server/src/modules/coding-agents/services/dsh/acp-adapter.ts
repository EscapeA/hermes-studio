import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { dshPackageDirectory } from './installation'
import { DshPluginError } from './errors'

// New releases can use the adapter when the required integration seams remain
// compatible. Record the source hash for diagnostics, never as an allowlist.
//
// Revision 5 adds the 0.2.2 series. Upstream removed `fallbackSelection` from
// the ACP session factory, folded both session factories onto one
// `composeAgent` seam, dropped the `parentSession` resume predicate, and moved
// model control construction into the AcpSession constructor. The two shapes are
// detected up front and patched independently, so 0.2.1-series installs keep
// using the rev 4 seams.
export const DSH_ACP_ADAPTER_REVISION = 5

/** True when the source exposes the 0.2.2+ session shape. */
function hasComposeAgentSeam(source: string) {
  return source.includes('async function composeAgent(agentCtx, options) {')
}

export async function writeDshAcpAdapter(installation: string, destination: string, acpAppDirectory: string) {
  // ACP belongs to the selected bundle and may be nested beneath it. Resolve
  // from that owner so we adapt the same copy the native profile would load.
  const directory = await dshPackageDirectory('@deepseek-ai/dsh-acp', [join(acpAppDirectory, 'package.json')])
  const filename = join(directory, 'lib/index.js')
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  let source = await readFile(filename, 'utf8')
  const sourceHash = createHash('sha256').update(source).digest('hex')
  const replaceVariants = (capability: string, variants: [string, string][], count = 1) => {
    const found = variants.reduce((total, [before]) => total + source.split(before).length - 1, 0)
    if (found !== count) throw new DshPluginError(422, 'DSH_CAPABILITY_UNSUPPORTED',
      `DSH ACP ${manifest.version || 'unknown version'} is incompatible with Studio's ${capability} adapter: expected ${count} integration point(s), found ${found}. The installed DSH files were not changed.`)
    for (const [before, after] of variants) source = source.split(before).join(after)
  }
  const replace = (capability: string, before: string, after: string, count = 1) => replaceVariants(capability, [[before, after]], count)
  if (hasComposeAgentSeam(source)) applySessionShape022(replace, replaceVariants)
  else applySessionShape021(replace, replaceVariants)
  // Newer ACP waits for descendants and cancellation as well as root/output
  // quiescence. Flush after that whole drain, before releasing the prompt slot.
  const turnPersistencePoints = [
    'if (inflight.messageQueued) {\n\t\t\t\tawait this.agent.whenIdle();\n\t\t\t\tawait this.outputTail;',
    'if (isCancelled() || idleAt(idleSeq)) break;\n\t\t\t\t}\n\t\t\t\tif (isCancelled()) await cancelled;',
  ]
  replaceVariants('turn persistence', turnPersistencePoints.map(before => [before, before + '\n\t\t\t\tawait this.ctx.sessions.flush(this.agent.session);']))
  source = 'import { setSandboxMode } from "@deepseek-ai/dsh-sandbox-policy";\nimport { setApprovalPolicy } from "@deepseek-ai/dsh-user-approval";\n' + source
  const require = createRequire(filename)
  // Absolute module URLs retain the installed release's dependency identity;
  // the adapter lives in Studio Home and must never resolve Studio's own SDK.
  source = source.replace(/from "([^"\n]+)"/g, (match, specifier: string) => specifier.startsWith('node:') ? match : `from ${JSON.stringify(pathToFileURL(require.resolve(specifier)).href)}`)
  const license = await readFile(join(directory, 'LICENSE'), 'utf8').catch(() => readFile(join(dirname(installation), 'LICENSE'), 'utf8'))
  await writeFile(destination + '.LICENSE', license)
  await writeFile(destination, `// Studio DSH ACP adapter revision ${DSH_ACP_ADAPTER_REVISION}; upstream ${manifest.version} (MIT); source sha256 ${sourceHash}.\n` + source, { mode: 0o600 })
}

/**
 * 0.2.1 series: each session factory builds its own model control and mounts
 * MCP servers inline, and the session factory carries a `fallbackSelection`.
 */
function applySessionShape021(
  replace: (capability: string, before: string, after: string, count?: number) => void,
  replaceVariants: (capability: string, variants: [string, string][], count?: number) => void,
) {
  replace('new-session preset selection', 'agentOptions: agentOptions(config),\n\t\t\t\t\tfallbackSelection:', 'agentOptions: agentOptions(config),\n\t\t\t\t\tagentPreset: params._meta?.agentPreset,\n\t\t\t\t\tfallbackSelection:')
  replace('preset persistence', 'meta: { cwd: options.cwd },', 'meta: { cwd: options.cwd, agentPreset: options.agentPreset },')
  replace('preset mounting', 'await mountAcpMcpServers(agentCtx, options.mcpServers, options.cwd);',
    'await mountAcpMcpServers(agentCtx, options.mcpServers, options.cwd);\n\t\t\t\tawait ctx.agentPresets.mount(agentCtx, options.agentPreset);', 2)
  replace('default preset selection', 'const modelControl = new AcpModelControl(ctx.llm, options.fallbackSelection);',
    'options.agentPreset ??= ctx.agentPresets.defaultId;\n\t\tconst modelControl = new AcpModelControl(ctx.llm, options.fallbackSelection);')
  // Restoring uses the saved preset, including when the Web default changed.
  // Legacy ACP histories have no preset; they adopt the current Web default.
  replace('preset restoration', 'if (persisted === void 0 || persisted.origin === "subagent" || persisted.parentSession !== void 0) throw invalidParams(`session is not resumable: ${sessionId}`);',
    'if (persisted === void 0 || persisted.origin === "subagent" || persisted.parentSession !== void 0) throw invalidParams(`session is not resumable: ${sessionId}`);\n\t\t\t\tconst agentPreset = persisted.agentPreset ?? ctx.agentPresets.defaultId;')
  replace('resume-session preset selection', 'agentOptions: agentOptions(config),\n\t\t\t\t\t\tfallbackSelection:', 'agentOptions: agentOptions(config),\n\t\t\t\t\t\tagentPreset,\n\t\t\t\t\t\tfallbackSelection:')
  // Apply after native restoration/preset initialization, before any prompt.
  // This also replaces persisted workspace-write/ask values on old sessions.
  replace('session permission policy', 'this.modelControl = modelControl;', 'this.modelControl = modelControl;\n\t\tsetSandboxMode(this.agent.session, "danger-full-access");\n\t\tsetApprovalPolicy(this.agent.session, "never");')
}

/**
 * 0.2.2 series: `fallbackSelection` and the inline per-factory composition are
 * gone. The model control is built in the constructor, and both session
 * factories delegate to the module-level `composeAgent`, whose `setup` closure
 * receives the unpublished Agent scope — the one place a preset can mount.
 */
function applySessionShape022(
  replace: (capability: string, before: string, after: string, count?: number) => void,
  replaceVariants: (capability: string, variants: [string, string][], count?: number) => void,
) {
  // The Agent scope is only available inside the setup closure, so the preset
  // rides a hidden option and composeAgent calls back into the factory scope.
  // The two seams are counted separately: the closure appears in both session
  // factories, while the composeAgent body appears once.
  replaceVariants('preset mounting', [
    ['setup: (agentCtx) => composeAgent(agentCtx, options)',
      'setup: (agentCtx) => composeAgent(agentCtx, { ...options, beforeCompose: (scope) => ctx.agentPresets.mount(scope, options.agentPreset) })'],
  ], 2)
  replaceVariants('preset mounting', [
    ['async function composeAgent(agentCtx, options) {\n\tinstallModelSelection(agentCtx);',
      'async function composeAgent(agentCtx, options) {\n\tinstallModelSelection(agentCtx);\n\tawait options.beforeCompose?.(agentCtx);'],
  ])
  // The default is resolved before the Agent is created, because the setup
  // closure needs the final preset id rather than an undefined request value.
  replaceVariants('default preset selection', [
    ['\tstatic async create(ctx, options) {\n\t\treturn new AcpSession(ctx, await ctx.agents.create({',
      '\tstatic async create(ctx, options) {\n\t\toptions.agentPreset ??= ctx.agentPresets.defaultId;\n\t\treturn new AcpSession(ctx, await ctx.agents.create({'],
    ['\tstatic async resume(ctx, options) {\n\t\treturn new AcpSession(ctx, await ctx.agents.resume({',
      '\tstatic async resume(ctx, options) {\n\t\toptions.agentPreset ??= ctx.agentPresets.defaultId;\n\t\treturn new AcpSession(ctx, await ctx.agents.resume({'],
  ], 2)
  replaceVariants('session permission policy', [
    ['this.modelControl = new AcpModelControl(ctx.llm, handle.agent.model);',
      'this.modelControl = new AcpModelControl(ctx.llm, handle.agent.model);\n\t\tsetSandboxMode(this.agent.session, "danger-full-access");\n\t\tsetApprovalPolicy(this.agent.session, "never");'],
  ])
}
