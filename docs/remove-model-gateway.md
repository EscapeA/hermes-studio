# 移除 LLM 中转（Model Gateway）

## 决策

Aries 2026-11-20 决定：**完全移除 hermes-studio 的 LLM 中转功能**（L1/L2/L3 全拆），Studio 只保留 hermes-agent 作为模型消费方。14 个外部 CLI agent（coding-agents 模块）**保留**，但它们只能用自己的官方订阅/凭证，不再能借用 Studio 里配置的第三方 Provider。

## 为什么要拆

停顿归因（state.db 实证，见 `~/.hermes/cache/scratch/stall-rootcause-20261120.md`）：

| 时期 | 路径 | 停顿/stop 轮 |
|---|---|---|
| 11-14 ~ 11-16 | 直连 Octopus `chat_completions` | 0/82 = **0%** |
| 11-17 09:27 起 | Studio 代理 `codex_responses` | 10% → 21% → 45% → 34% |

`sessions` 表 11-17 09:27 时 `billing_base_url` 从 `100.69.155.60:6677/v1` 变为 `127.0.0.1:8648/api/ekko-studio/models/v1`，模型 id 从 `deepseek-flash` 变 `octopus/deepseek-flash`。

**改 UI 无效的原因**：UI 展示逻辑名（`custom:octopus`），但 `hermes-projection.ts` 每次同步都把传输层改写为网关。逻辑名与实际路由解耦，所以"页面显示 octopus"与"实际走网关"可以同时成立。

## 三层边界

| 层 | 内容 | 处置 |
|---|---|---|
| **L1 对外 Model API** | `/v1/chat/completions`、`/v1/responses`、`/v1/messages`、Gemini、API 密钥管理、cloud-link、前端 Model API 页 | **删** |
| **L2 路由投影（根因）** | `hermes-projection`、`provider-gateway-client`、`model-gateway` 中间件、3 个 runtime adapter 的网关接线 | **删** |
| **L3 agent 协议代理** | `codex/proxy`、`claude-code/proxy`、`model-gateway`(coding-agents)、协议 target 注册 | **删** |

## 必须保留（不能连带删）

这些文件**同时被非网关功能使用**，删了会误伤：

| 文件 | 保留原因 |
|---|---|
| `providers/model-routes.ts` | `account-management.ts` 用 `canonicalProviderId`（Provider 管理，非网关） |
| `providers/supplemental-routing.ts` | auxiliary / MoA / fallback / delegation 配置编辑（`config.ts` 在用） |
| `providers/account-store.ts` | 账户级 Provider 存储（Provider 管理页） |
| `public/model-routing.ts` | 上面 model-routes 的公开转出口 |
| `public/supplemental-routing.ts` | 上面 supplemental 的公开转出口 |

只从这些文件里**摘掉网关专用导出**（如 `qualifyModelRoute`、`providerRouteNamespace`、`logicalModelSelection` 的网关分支），不删整个文件。

## L3 删除的安全依据

所有 proxy 调用点都写成带兜底的表达式：

```ts
const claudeBaseUrl = proxyTarget?.baseUrl || baseUrl
const codexApiKey  = proxyTarget?.token  || apiKey
```

删掉 `proxyTarget` 后自动退回直连 `baseUrl`/`apiKey`（即该 agent 自己的官方凭证）。这是 L3 可以干净移除的关键。

## 回退

- 分支：`feat/remove-model-gateway`（基于 `custom-next` @ 9c7e6d26e）
- 整体回退：`git checkout custom-next`
- 与上游 rebase：本次改动集中在新文件删除 + 少量接线删除，冲突面小；上游若继续演进网关，需在 rebase 时**保留我方删除**（视为 fork 自有决策）

## 部署顺序（重要）

**必须先停旧进程，再清理配置，最后启动新版本。** 顺序颠倒会白做：

1. 旧 Studio 进程（11-18 启动的版本）跑的是旧代码，`provider-account` 中间件每次请求都会把 `providers.ekkostudio` 与 `model.provider: ekkostudio` 写回 `~/.hermes/config.yaml`。实测：删掉后 3 秒内被回写。
2. 正确顺序：`sudo systemctl stop hermes-web-ui-client` → 清理 config.yaml 的 ekkostudio 段 → 部署新 dist → `start`。
3. 备份：`~/.hermes/config.yaml.bak-pre-gateway-removal-<ts>`

## 验收

1. `npm run build` 通过（类型检查 + 生产构建）✅
2. `grep -r "ekko-studio/models" packages/` 无残留 ✅
3. 新会话 `billing_base_url` = `http://100.69.155.60:6677/v1`（直连），不再是 `127.0.0.1:8648`
4. 停顿率回落（11-21 起观察）
