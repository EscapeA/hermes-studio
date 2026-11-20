# hermes-studio LLM 网关实现审查报告

- 审查对象：`hermes-studio` 的 Model Gateway 三层实现（L1 对外 Model API / L2 路由投影 / L3 协议代理）
- 代码基线：`9c7e6d26e`（网关存在的最后提交）
- 该网关已由 `7946c24ac`「feat(studio): remove the LLM model gateway entirely」整体移除，分支 `feat/remove-model-gateway`
- 审查方式：源码通读 + 在仓内写临时 vitest 用例实跑验证（用例已删除，仓库无改动）

> **时态说明**：本文描述的所有 P0/P1 缺陷，均属于基线上**曾经存在、现已随 `7946c24ac` 一并移除**的代码。
> 保留本文是为了记录这一层协议转换的设计陷阱，防止将来重新引入中转或复用 `protocol/adapters/` 时重犯。
> 文中使用现在时是为了描述当时的实现逻辑，不代表当前 HEAD 仍存在该问题；
> 当前 HEAD 的实际状态见文末「死代码与整洁性」一节的核实结果。

## 结论先行

上一轮对 STALL 的归因（「网关把 chat_completions 转成 Responses 协议后，模型行为变了，更倾向主动收尾」）**不成立**。
真实机制是更直接的一类 bug：

> **网关在协议转换时，主动丢弃了上游的「截断 / 失败 / 中断」信号，把三者统一伪装成 `response.completed` + `status: 'completed'` 的正常结束。**

因此 state.db 里统计到的 `finish_reason='stop'` **是网关伪造的产物，不是上游真实值**。
把它当作「模型正常收尾」的证据，等于用 bug 的输出证明 bug 不存在。

---

## P0：截断与失败被伪装成成功（实跑验证）

### P0-1 上游 `finish_reason` 被完全丢弃，`length` 变成 `stop`

`packages/server/src/modules/coding-agents/protocol/adapters/responses-stream.ts`

`openAiChatSseToResponsesEvents` 解析 Chat Completions SSE 时，只取 `delta`、`tool_calls`、`usage`，
**从不读取 `choice.finish_reason`**（全文件无 `finish_reason` 字样，仅第 241 行 `dataLine === '[DONE]'` 的跳过）。
流的收尾无条件写死（第 444–457 行）：

```ts
yield {
  type: 'response.completed',
  data: { type: 'response.completed', response: {
    id, object: 'response', status: 'completed', model: target.model, output,
    ...(usage ? { usage: openAiChatUsageToResponsesUsage(usage) } : {}),
  } },
}
```

实测（上游 `finish_reason: "length"`，正文被砍在半句）：

```
G finish_reason sequence seen by client: ["stop"]
```

完整链路是：上游 `length` → 网关 `response.completed` → `responsesToChatCompletionSse`
按 `calls.size ? 'tool_calls' : 'stop'` 重新赋值 → 客户端拿到 `stop`。

**影响**：模型输出触到 `max_output_tokens` 上限被硬截断，网关报告「正常结束」。
Hermes / Codex / OpenCode 等下游都会把它当作一轮完整答复，于是"说完一句就停"。
这正好解释了 55 条 STALL 为什么正文都完整、都有句号、都 `finish_reason='stop'` —— 它们是**被截断的、但被标注为完整的**输出。

上游为 `MAX_TOKENS` / `content_filter` / `SAFETY` 时同样被吞。

### P0-2 流中断（无 `[DONE]`）也报成功

上游在 `data: [DONE]` 前断开，`for await` 正常结束（不是 error），代码路径与 P0-1 完全相同：

```
B last event: {"type":"response.completed", ... "text":"truncated tex" ...}
H client tail: ["data: [DONE]\n\n"]
```

客户端无法区分「完整答复」与「网络/上游断流」。这是最危险的一类：**数据缺失但被声明为成功**。

### P0-3 上游错误帧被静默丢弃

上游发 `data: {"error":{"message":"upstream overloaded"}}` 时，代码只找 `data.choices[0]`，
无 choice 就 `continue`（第 246–247 行），错误帧直接蒸发；随后 `[DONE]` 触发 completed。

```
C types: response.created,...,response.completed
I client contains error? false
```

**影响**：上游 5xx / 限流 / 内容审核拒绝，全部变成「成功但内容不全」。
用户看到的是一次莫名其妙结束的回答，日志里没有任何错误。

### P0-4 完全空响应也报成功

`output: []` 且 `status: 'completed'`：

```
D last event: {..., "status":"completed", "output":[]}
```

这正是上一轮讨论的「空响应」场景 —— 网关确实不检查空内容（这点猜测成立），但后果比"放行"更糟：
它把空响应**认证为一次成功调用**，并计入 usage。

### P0-5 Anthropic 侧同样：`stop_reason: max_tokens` 被丢弃

`anthropicMessagesSseToResponsesEvents` 读取 `message_start` / `content_block_*` / `message_delta` 的 usage，
但**不读 `message_delta.delta.stop_reason`**（全文件无 `stop_reason` 字样）。
收尾同样写死 `status: 'completed'`（第 748–761 行）：

```
E last: {"type":"response.completed", ... "status":"completed", ... "text":"cut off he"}
```

Anthropic 原生的 `end_turn` / `max_tokens` / `stop_sequence` / `tool_use` 四态区分被压平成一态。

### P0 小结与修法

四个入口（Chat / Responses / Anthropic / Gemini 桥接）共用这套转换，缺陷是系统性的。

正确做法（Responses 语义）：

| 上游信号 | 应产出 |
|---|---|
| `finish_reason: stop` | `response.completed`，`status: completed` |
| `finish_reason: length` / `max_tokens` / `MAX_TOKENS` | `response.incomplete`，`status: incomplete`，`incomplete_details.reason = "max_output_tokens"` |
| `finish_reason: content_filter` / `SAFETY` | `response.incomplete`，`reason = "content_filter"` |
| 流结束但从未见过终止信号 | `response.failed`，`error.code = "stream_truncated"` |
| `data: {"error": ...}` | `error` 事件 / `response.failed`，透传 message |

参考：仓库里 `packages/server/src/modules/studio/services/model-api/output.ts` 曾有一个 `ResponsesOutput.finish()`
（第 126–131 行）**做对了这件事** —— 它按 `finishReason` 映射 `completed` / `incomplete` / `failed`。
但该文件在网关期是**死代码**（全仓无引用），实际生效的是 `responses-stream.ts` 的错误版本。
这属于「正确实现存在但没接线」，是最容易修的形态。

---

## P1：架构与资源问题

### P1-1 `unifiedCatalog` 只取第一个 Profile，与文档不符

`packages/server/src/modules/studio/services/model-api/service.ts` 第 46 行：

```ts
const names = [profiles[0] || providerRequestProfile() || 'default']
```

而调用方 `controllers/model-api.ts` 的 `profilesForRequest()` 精心构造了**全部**可访问 Profile 的排序数组
（`default` 优先，super_admin 返回全部），并注释「The API is account-wide」。
`docs/model-api.md` 也承诺「The API always aggregates the caller's accessible Provider configurations」。

**实际行为**：只有 `profiles[0]`（通常是 `default`）的模型可见。其他 Profile 里配置的 Provider 全部 404。
多 Profile 账户下，这是功能缺失而非性能取舍，且文档与实现互相矛盾。

修法：`const names = [...new Set(profiles.filter(Boolean))]`，或明确把该限制写进文档并去掉调用侧的排序逻辑。

### P1-2 `teeAsyncIterable` 的未消费分支无界缓冲

`packages/server/src/modules/coding-agents/protocol/stream-tee.ts`

`pull()` 每次 `iterator.next()` 后同时 push 进 `buffers[0]` 和 `buffers[1]`。
两个分支各自独立消费，**没有任何背压**：慢的一侧数组无限增长。

实测：消费 branch0 共 20000 个 1KB chunk，branch1 全程未读，无任何限流或丢弃。

在 `claude-code/proxy.ts` 的用法里，branch1 是 observer（`void (async () => {...})()`，完全不等）：

```ts
const [clientStream, observerStream] = teeAsyncIterable(stream)
observeResponsesEvents(target, openAiChatSseToResponsesEvents(observerStream, target), startedAt)
return anthropicEventStream(openAiChatSseToAnthropicEvents(clientStream, target))
```

observer 若因解析异常提前退出（异常只 `loggerLikeWarn` 吞掉），branch1 从此无人消费，
而 `pull()` 仍在推进 —— **每个后续 chunk 都被永久留在 buffers[1] 里**。
一条长回复 + 一次 observer 崩溃 = 该请求剩余全部数据常驻内存。

修法：给 branch 加高水位（如 256 chunk / 4MB），超限时让慢侧跳过或断开 observer；
或在 observer 异常时显式 `buffers[1].length = 0` 并标记 done。

### P1-3 `gatewayModelStream` 的 32MB 限制作用在未分帧缓冲区上

`packages/server/src/modules/studio/services/model-api/gateway.ts` 第 34 行：

```ts
if (buffer.length > 32 * 1024 * 1024) throw new Error('Provider SSE event exceeds the gateway limit')
```

检查的是 `buffer`（尚未遇到 `\r?\n\r?\n` 的累积内容），而不是单个已分帧事件。
上游若持续输出不含帧分隔符的内容（长 tool arguments delta、无空行的畸形 SSE），
缓冲区会一路涨到 32MB 才抛错。

且抛错发生在 HTTP header 已发出之后，Koa 无法改状态码：客户端只看到「流突然结束」，
`finally { cleanup() }` 里的 `stream.destroy()` 会再制造一次半截响应。

修法：限制单帧长度而非累积长度（在 `rewrite()` 内对 `frame.length` 判定），
超限时发一条 `data: {"error":...}` 再正常结束，而不是 throw。

### P1-4 预算准入是 TOCTOU，重启后可能永久锁死 key

`packages/server/src/modules/studio/services/model-api/budget.ts`

```ts
/** Admission uses settled lifetime spend; already running calls can overshoot. */
```

代码自己承认了这一点。更麻烦的是 `unpricedRequests` 豁免依赖**进程内存**：

```ts
const activeRequests = new Set<string>()
...
if (key.unpricedRequests && unpricedModelApiRequests(userId, keyId).some(row => !activeRequests.has(row.run_id)))
```

而 `beginModelApiKeyUsage` 在发请求前就写入 `model_api_pending = 1`、`cost_usd = NULL` 的行
（`repositories/model-api-keys-store.ts`，注释「A crash or failed settlement leaves an unknown-cost request」）。

**进程重启后 `activeRequests` 清空**，所有遗留的 pending 行都成为"无法豁免的未知成本"。
受限 key 从此每次请求都返回 `429 quota_cost_unknown`，且没有清理路径 ——
只能「revoke the key」或「explicitly remove its limit」。
对一个正常重启的服务来说，这是稳定性陷阱。

修法：pending 行加时间戳，超过 N 分钟（如 2× 最长请求时长）视为已结算；
或在启动时扫一遍 pending 行并把它们标记为 `cost_source='unknown_settled'`，不阻塞新请求。

### P1-5 `record()` 在客户端主动断开时写入 0 token 行

`gateway.ts` 第 90–101 行的 `record()` 只在收到 `response.completed` / `failed` / `incomplete` 时才标记 `recorded = true`；
但 `cleanup()` 是**无条件**调用 `record()` 的：

```ts
const cleanup = () => {
  if (cleaned) return
  cleaned = true
  try { record() } finally { stream.destroy(); release(); target.dispose() }
}
ctx.body = Readable.from((async function* () { try { yield* gatewayModelStream(stream, modelId) } finally { cleanup() } })())
;(ctx.body as Readable).once('close', cleanup)
```

用户点「停止」→ 无 completed 事件 → `record()` 仍执行 → `normalizeTokenUsage({})` 得到全 0 且 `isEstimated: true`：

```
K normalizeTokenUsage({}) => {"inputTokens":0,"outputTokens":0,...,"isEstimated":true}
```

**影响**：外部用量页出现 0 token 记录，且 `unpriced_requests` 计数上涨（cost 为 NULL），
进一步加剧 P1-4 的锁死风险。这与记忆中「Octopus 里 output_tokens=0 但 response_content 完整」是同一类现象的两个截面。

修法：`record()` 在 `!recorded`（未收到终态）时应写一条显式 `aborted` 标记，而不是落成 normal usage 行；
或直接不写行，只释放 budget。

### P1-6 `synchronizeHermesProvider` 每个请求都跑，且会删除用户凭证配置

两个问题叠加：

**(a) 热路径**：`middleware/provider-account.ts` 在 **每一个** 已认证请求上无条件调用

```ts
for (const profile of providerProfiles()) await synchronizeHermesProvider(profile)
```

`synchronizeHermesProvider` 内部要 `readConfigYamlForProfile` + `readSupplementalEdits` +
读 `catalog.json` + 读 `providerSourceDir(profile)/config.yaml` + 计算 sha256。
虽然有 stamp 早退，但**每次请求至少 4 次文件 IO + 一次哈希**，且 `catalog.json` 一变就全量重写。

**(b) 破坏性写入**：`services/providers/hermes-projection.ts` 第 90–93 行，在 `keepLegacy === false` 时：

```ts
delete auth.providers
delete auth.credential_pool
delete original.custom_providers
[envPath]: env                    // 过滤掉所有导入的 env key
[anthropicPath]: '{}\n'           // 清空 Anthropic OAuth
```

**影响**：这是「UI 显示 `custom:octopus`，实际流量走网关」的直接成因（第 62、85 行强制 `provider: 'ekkostudio'` / `api_mode: 'codex_responses'`），
也是用户改配置「无效」的原因 —— 改完下一个请求就被投影覆盖回去。
`docs/remove-model-gateway.md` 里「删掉后 3 秒内被回写」的实测记录正是这个机制。

**风险**：`delete auth.credential_pool` 会永久删除用户的 OAuth 凭证池。
一旦投影逻辑误判（例如 `catalog.json` 瞬时读失败、stamp 计算异常），用户的 Anthropic / Copilot 登录态会被静默清空。
这不是幂等操作。

修法：`synchronizeHermesProvider` 应只在配置变更事件时触发（监听 config 写入），而不是每请求；
破坏性删除应有显式用户确认或至少留可恢复备份。

---

## P2：正确性问题

### P2-1 Gemini 桥接的 120s 硬超时会把长思考请求掐断

`claude-code`/`codex` proxy 的 `antigravityProxyGenerate`：

```ts
const timeout = setTimeout(() => abort.abort(), 120_000)
```

对 reasoning 模型（thinking 常超过 2 分钟）会中途 abort，且 abort 后返回 502 JSON，
在流式请求里表现为「突然断掉」。超时值应跟随模型能力（`codingAgentOutputLimit` / context policy）而不是常数。

### P2-2 `antigravityProxyGenerate` 内有不可达分支

```ts
if (String(ctx.params.operation).includes('streamGenerateContent')) { ...; return }
const response = ...
const payload = responsesToGemini(response)
if (String(ctx.params.operation).includes('streamGenerateContent')) {   // 永远 false
  ctx.set('Content-Type', 'text/event-stream; charset=utf-8')
  ctx.body = Readable.from([`data: ${JSON.stringify(payload)}\n\n`])
} else ctx.body = payload
```

流式分支已经在上面 return 了，这里第二次判断恒不成立。属于重构残留，会误导后续维护者。

### P2-3 `responsesToChatCompletionSse` 的 throw 无法传给客户端

```ts
} else if (event.type === 'response.failed' || event.type === 'error') throw new Error(...)
...
if (!completed) throw new Error('Provider stream ended without a final response')
```

这两处 throw 发生在 SSE 生成器内部，此时 header 已发出。客户端收到的是 `Premature close`，
没有任何结构化错误。应改为 `yield data: {"error":...}\n\n` 后正常结束。

顺带：最后一行 `if (!completed) throw` 是**唯一**在网关里对「流没正常结束」做判断的地方 ——
但它只在 Chat→Responses→Chat 这条往返路径上生效，直连 Responses 的路径完全没有这个保护（见 P0-2）。

### P2-4 `probeSseEncryptedContentError` 的前导帧判定过窄

```ts
function isIgnorableSsePreludeFrame(rawFrame: string): boolean {
  const frame = parseSseFrame(rawFrame)
  return !frame || frame.event === 'ping'
}
```

只把 `ping` 和空帧当作「可忽略前导」。若上游先发 `event: message_start`（Anthropic 标准首帧），
会被判为 `hasBusinessFrame = true` 提前结束 probe，导致加密内容错误检测失效。

### P2-5 `expandedResponseTools` 丢弃 `custom` 类型工具

`adapters/responses.ts` 里 `expandedResponseTools` 只处理 `type: 'function'` / `'tool_search'` / `'namespace'`，
`custom` 类型（grammar 约束工具）直接落到末尾被丢弃。
但 `chat-completions.ts` 的 `chatCompletionsToResponses` 是**会**产出 `{ type: 'custom', ... }` 的。
即：Chat → Responses 方向支持 custom tool，Responses → 上游 方向不支持。
`custom_tool_call` / `custom_tool_call_output` 在 `responsesInputToChatMessages` 里也没有对应分支（只认 `function_call*`）。
Codex 的 apply_patch / grammar 工具走这条路会丢工具定义。

### P2-6 `providerRouteNamespace` 在热路径上做加锁读改写

`services/providers/model-routes.ts` 每次调用都 `safeFileStore.updateTexts([routes.json])`，
即 acquire 锁 → 读文件 → JSON.parse → 判定 → 可能写回 → 释放锁。

`unifiedCatalog` 里它是**两层嵌套循环内**调用的：

```ts
for (const group of groups) {
  ...
  for (const model of group.models) {
    const id = qualifiedId(await providerRouteNamespace(names[index], group.provider), model)
```

`providerRouteNamespace(profile, provider)` 只依赖 provider 不依赖 model，却被放在 model 循环内，
**每个模型一次加锁文件操作**。一个 50 Provider × 20 model 的账户 = 1000 次锁竞争 + 文件读。
且这段代码在 `/models` 列表请求上每次全跑。

修法：把 `providerRouteNamespace` 提到 group 循环外并缓存（provider → namespace 的 Map）。

---

## P3：死代码与整洁性

| 位置 | 问题 |
|---|---|
| `services/model-api/input.ts`（125 行） | `validateResponsesBody` / `responsesModelRequest` 全仓无引用 |
| `services/model-api/output.ts`（134 行） | `ResponsesOutput` 全仓无引用（**但它才是正确实现**，见 P0 小结） |
| `services/model-api/gateway.ts` 第 90–101 行 | `record()` 的 `event.type` 白名单与 `streamed` 分支组合后，非流式路径下的 `record()` 无 event，必然写 0 行 |
| `protocol/adapters/responses-stream.ts` 全文件 | 无 `finish_reason` / `stop_reason` 处理（P0 根因） |
| `model-target-store.ts` 的 `savedModelTargets()` | 遍历整个 `model-targets` 目录但对每个都做 `providerAccountId()` 比对，实际只有自己的会通过；启动期 O(历史 credential 数) |
| `middleware/model-gateway.ts` | 把 `/api/codex-proxy/<key>` 重写成 `/api/ekko-studio/models`，与 `requireTarget` 里的 `ctx.params.key` 双重鉴权路径叠加，可读性差且分支难覆盖 |

---

## 安全面核查（未发现高危）

逐项核对后，以下几处是**做对了**的，值得记录：

- **API key 存储**：只存 `sha256(token)`，明文仅创建时返回一次（`keys.ts` 注释与实现一致）。
  格式校验 `^sk-ekko-[A-Za-z0-9_-]{43}$` 严格，不符直接返回 null 不查库。
- **key 权限边界**：`auth.ts` 明确限制 `sk-ekko-` 只能用于 `GET /models` 与 `POST <inference>`，
  其余一律 403「This key only permits Model API requests」；且强制 `gatewayToken(ctx) === token`，
  不允许用 query 参数绕过。
- **内部凭证**：`studio_model_` 仅用于 inference，不能访问管理面；`x-studio-profile` 对非 super_admin 会校验 `userCanAccessProfile`。
- **reasoning 信封**：AES-256-GCM，密钥文件 `0600` 且用 `flag: 'wx'` 原子创建；
  decode 时校验 `data.scope === scope`，**跨 target 的信封会抛 400 而非静默降级**（这一点做得对，避免了把 A 模型的签名重放给 B）。
- **model-target 持久化**：文件名是 `sha256(token)`，读取时全等比对 `record.token !== token`，
  不能通过猜测文件名遍历他人绑定。
- **cloud usage receipt**：一次性 token，`claimCloudUsageReceipt` 校验 `userId` + `keyId` 双重匹配后即删，
  且进度有 32 条上限。设计是严谨的。
- **body 限制**：Codex 专用 parser 对未认证请求仍走 20MB 限制（`cold-gateway-body-parser.test.ts` 覆盖了这个冷启动竞态）。

唯一值得提的一条：`isSelfModelApi` 只识别 `studio_model_` 前缀或库内存在的 `sk-ekko-` key 来判定自引用。
若通过反向代理/URL 重写把 `base_url` 指向自身但换成别的凭证形式，会形成自引用循环。
建议再加一道「解析后的 host+port 等于自身监听地址」的判定。

---

## 与上一轮归因的对照

| 上一轮说法 | 本报告结论 |
|---|---|
| 「网关确实不检查空内容」 | 成立，且更糟：空响应被标记为 `completed`（P0-4，实跑证实） |
| 「网关多了一道关卡」 | 成立 |
| 「55 条 STALL 正文都完整、`finish=stop`，所以不是空响应」 | **该证据被污染**：`finish=stop` 是网关伪造的（P0-1）。上游真实 `finish_reason` 从未到达客户端 |
| 「`output_tokens=0` 不能作空响应判据」 | 成立，但网关侧 `record()` 在 abort 时确实写 0 行（P1-5） |
| 「`Operation interrupted` 来自 hermes 的 turn_finalizer」 | 成立，与网关无关 |
| 「true mechanism: 协议导致模型行为改变」 | **不成立**。模型行为没有变；是网关把截断/失败/中断统一改写成了「正常结束」。不需要引入协议语义差异来解释 |
| 「换上游渠道没用」 | 与 P0-1 一致 —— 信号在网关这一层被抹掉，上游换成谁结果都一样 |

**这解释了为什么拆掉网关后 STALL 从 8.18‰ 降到 0.85‰**：不是协议变了，是不再有人伪造「正常结束」。

---

## 修复优先级建议

按「投入/收益」排序：

1. **P0-1 ~ P0-5（必须修）**：`responses-stream.ts` 两个生成器补 `finish_reason` / `stop_reason` 映射，
   流未正常终止时发 `response.failed` + `stream_truncated`。
   可直接参考同仓 `model-api/output.ts` 第 126–131 行已有的正确映射逻辑。
   工作量：约 40 行，4 个分支，可单测覆盖（本报告的 A/B/C/D/E 用例可直接转正）。
2. **P1-5 + P1-4**：record 区分 aborted；pending 行加超时回收。约 30 行。
3. **P1-1**：`unifiedCatalog` 用全部 profiles。1 行，但需评估多 Profile 下的模型 ID 冲突。
4. **P2-6**：`providerRouteNamespace` 移出 model 循环 + 缓存。约 10 行，收益明显（每请求省数百次文件操作）。
5. **P1-6**：投影从「每请求」改为「事件驱动」。改动面较大，但这是整件事的架构根因。
6. **P1-2**：tee 加高水位。约 20 行。

若网关**不再恢复**（当前 `feat/remove-model-gateway` 已整体拆除），则 P0/P1 的修复仅对
「未来重新引入中转」有价值。**核实后的准确状态**（`grep` 全仓引用，不使用推测）：

`packages/server/src/modules/coding-agents/protocol/adapters/` 下全部 7 个文件
（`responses-stream.ts`、`responses.ts`、`chat-completions.ts`、`anthropic.ts`、
`anthropic-stream.ts`、`portable-responses.ts`、`multimodal.ts`）
在 HEAD 上**只剩测试引用，生产代码零引用**：

```
adapters/responses.ts           外部引用: 0
adapters/chat-completions.ts    外部引用: 0
adapters/anthropic.ts           外部引用: 0
adapters/portable-responses.ts  外部引用: 0
```

唯一的类型引用是 `CanonicalResponsesEvent`（`target-registry.ts`、`run-manager.ts`），
而 `target-registry.ts` 本身也已无生产调用者。

**所以结论要收紧**：`7946c24ac` 实际上把整个 Responses 协议转换层一并变成了孤儿代码，
只是没有出现在删除清单里（该提交只改了这两个文件各 1 行 import 路径）。
即「拆掉 Studio 网关，这个截断吞信号的 bug 也随之不再生效 —— 但代码还留在树里」。

这带来两个后果：

1. **短期无生产风险**：当前不会有人踩到 P0。
2. **长期风险**：下次有人要接一个 Responses 协议的 CLI agent（或恢复中转），
   最自然的选择就是复用这个目录 —— 而它带着一个把截断/失败/中断全部标成成功的转换层，
   且现有测试（`tests/server/responses-wire-compatibility.test.ts`）**没有任何一条覆盖终态语义**。
   这比代码里根本没有实现更危险。

建议：要么补上 P0 的四个分支让这层可用，要么在目录加显式 deprecated 标记
（`adapters/README.md` 或文件头注释）说明「此转换层未处理 finish_reason/stop_reason，勿直接复用」。

---

## 验证用例（可直接转正为回归测试）

```ts
// A: 上游 length 截断 → 客户端不得看到 stop
it('upstream finish_reason=length must not become a completed response', async () => {
  async function* upstream() {
    yield Buffer.from('data: {"choices":[{"delta":{"content":"half a sen"}}]}\n\n')
    yield Buffer.from('data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n')
    yield Buffer.from('data: [DONE]\n\n')
  }
  const events = []
  for await (const e of openAiChatSseToResponsesEvents(upstream(), { model: 'm' })) events.push(e)
  expect(events.at(-1)!.type).toBe('response.incomplete')          // 当前: response.completed（失败）
  expect((events.at(-1)!.data as any).response.incomplete_details)
    .toEqual({ reason: 'max_output_tokens' })
})

// B: 无 [DONE] 断流 → 不得报成功
it('stream ending without a terminal signal must fail', async () => {
  async function* upstream() { yield Buffer.from('data: {"choices":[{"delta":{"content":"trunc"}}]}\n\n') }
  const events = []
  for await (const e of openAiChatSseToResponsesEvents(upstream(), { model: 'm' })) events.push(e)
  expect(events.at(-1)!.type).toBe('response.failed')               // 当前: response.completed（失败）
})

// C: 上游 error 帧 → 必须透传
it('upstream error frames must reach the client', async () => {
  async function* upstream() {
    yield Buffer.from('data: {"error":{"message":"overloaded"}}\n\n')
    yield Buffer.from('data: [DONE]\n\n')
  }
  const events = []
  for await (const e of openAiChatSseToResponsesEvents(upstream(), { model: 'm' })) events.push(e)
  expect(events.some(e => e.type === 'error' || e.type === 'response.failed')).toBe(true)  // 当前: false（失败）
})

// D: Anthropic max_tokens → incomplete
it('anthropic stop_reason=max_tokens must become incomplete', async () => {
  async function* upstream() {
    yield Buffer.from('event: message_start\ndata: {"type":"message_start","message":{"id":"m1","usage":{"input_tokens":10}}}\n\n')
    yield Buffer.from('event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"max_tokens"},"usage":{"output_tokens":5}}\n\n')
  }
  const events = []
  for await (const e of anthropicMessagesSseToResponsesEvents(upstream(), { model: 'x' })) events.push(e)
  expect((events.at(-1)!.data as any).response.status).toBe('incomplete')  // 当前: completed（失败）
})
```

四条在本次审查中都实跑确认过**当前会失败**（断言方向已按正确行为书写）。


---

## 附：本会话实测验证（2026-11-20 收尾时补记）

P0 的结论在数据上有一个独立验证：把 state.db 的「真 STALL」按是否经过网关分三段统计，
口径统一为 `Operation interrupted` 之外、无工具调用、`finish_reason=stop`、
下一条用户消息是纯「继续/继续任务」的事件，分母为该段 assistant 轮数。

| 窗口 | assistant 轮 | 真 STALL | 发生率 |
|---|---:|---:|---:|
| 基线 11-10 ~ 11-17 09:27（升级前直连） | 12,704 | 0 | **0.00‰** |
| 网关期 11-17 09:27 ~ 11-20 15:52 | 6,726 | 55 | **8.18‰** |
| 拆除后 11-20 15:52 ~ 收尾 | 1,593 | 1 | **0.63‰** |

拆除网关后 STALL 率下降约 92%，且同期有三个长会话（707 / 411 / 258 轮）并行运行，
未再出现「说完一句就停」。这与 P0 的机制描述一致：**吞掉 `finish_reason` 的转换层
被移除后，被伪装成「正常收尾」的截断不再产生**。

同一窗口内的 3 条 `Operation interrupted` 已逐条定性，均非本报告所述缺陷：
17:41 为后台进程操作、18:41 与 19:27 为 agent 执行 `pkill -f 'dist/server/index.js'`
误杀 Studio 宿主进程（该模式同时命中宿主与执行 pkill 的 bash 自身）。

⚠️ **统计注意事项**：本节的 STALL 判定依赖 `finish_reason='stop'`，而该字段在网关期
正是被伪造的——网关期那 55 条的真实上游信号可能为 `length`/失败/中断。
因此「网关期 8.18‰」应理解为「被伪装成正常收尾的异常响应数」，而非「模型主动收尾次数」。
基线与拆除后两段的 `finish_reason` 由上游直出，可信。
