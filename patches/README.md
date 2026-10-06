# EscapeA/hermes-studio 补丁串（Patch Stack）管理

本目录是 fork 的全部自定义内容的**权威来源**。分支模型：

```
main   = 纯上游同步（git reset --hard upstream/main，不含任何自定义）
custom = main + patches/*.patch 线性重放（部署/集成分支，无 merge commit）
```

## 目录结构

| 组 | 内容 | 补丁 |
|---|---|---|
| 01-ci | CI/测试（unit-test 移除、custom 触发、CF Pages deploy、mock） | 001-006 |
| 02-pwa | PWA（离线、SW 缓存、SWR、资源瘦身、_headers、状态栏主题色） | 001-009 |
| 04-usage | 用量显示（prompt_tokens、百分比、session 累计、composer 对齐、用量行纯文字化＝去上游 0.7.26 的分栏面板、run 态解码读数） | 001-010 |
| 05-chat | Chat 核心（fast-path、avatar、双下拉、identity、滚动、聊天身份开关、用户气泡蓝色、clarify 折叠收起、工具卡按轮分组、去「正在思考」gif 图标、run 态指示器与输入区间距收紧、去输入框语音按钮） | 001-022 |
| 06-mobile-input | 移动端输入（Enter 换行、模型下拉不弹键盘） | 001-002 |
| 07-workflow | Workflow 移动端布局 + i18n | 001-002 |
| 08-server | server 静态缓存头 + GET /sessions archived=1 恢复 | 001-002 |
| 09-cleanup | 清理（移除 apikey.fun 推广：侧边栏 apiRelay 按钮、FUN_LINK_MAP 提示、apiRelay locale 键；移除页面侧边栏「设备互联」入口） | 002-003 |
| 10-perf-p1 | P1 性能（highlight core、comic 字体 woff2、locale 构建期合并、logo 单请求） | 001-004 |
| 11-socket-stall | socket 卡死防护（服务端 backlog 检测断连 + 前端 REST 兜底刷新） | 001-002 |
| 12-tool-strip | 工具面板防闪烁（500ms 延迟显示）+ 折叠单行（正在调用 N 个工具）+ 运行中工具行展开详情 + toggle 与列表上下堆叠 + 展开详情解除高度限制 | 001-004 |
| 13-mobile-nav | 移动端顶栏统一 38px（变量派生几何 + ☰ 与内容同轴）+ ☰ 由品牌图改为三条横线图标 + 去掉与 ☰ 重复的四宫格 ▦（Models/Workflow）+ 页面侧边栏抽屉打开时隐藏全局 ☰ | 001-002 |
| 14-test-adapt | 上游测试套件适配（`tests/client/message-list-live-reasoning.test.ts` 断言 fork 行为：按用户轮折叠的 ToolRunCard、卸载重建的 live ticker） | 001 |
| 15-mobile-models | 模型页移动端布局（辅助模型面板宽表格 → 两行卡片、summary 双列、动作按钮左对齐、页/面板内边距 20→12px，断点改用 `$breakpoint-mobile`） | 001 |
| 16-agent-entry | 侧边栏「Agent 管理」入口可配置直达指定 Agent 设置页（本地 localStorage 偏好；默认保持 Agent 列表） | 001 |
| 17-remove-group-chat | 前端群聊整体移除（3 视图 + group-chat 组件目录 + store/api/utils + 4 条路由与分享页 + 四宫格群聊 tab 回归三宫格 + GlobalPendingActions 群聊分支 + 文件工作区群聊分支 + groupChat i18n 命名空间 + Electron 弹窗；测试同步删除/适配） | 001-002 |
| 18-remove-workflow | 前端工作流整体移除（WorkflowView 5.5k 行 + workflow 组件目录 + api/socket + 10 个 utils + /hermes/workflow 路由 + 三宫格 tab 回归两宫格 + GlobalPendingActions 工作流审批管道 + App.vue deep CSS + workflow i18n 命名空间；保留 source:'workflow' 会话来源识别与 workflow.* webhook 事件名；测试同步删除/适配） | 001-002 |
| 19-sidebar-history-toggle | 页面侧边栏改为扁平按钮组（新建会话/搜索/历史/Agent管理/模型）：历史并入顶部组并按上游 #1518 实现「历史 ⇄ 会话」切换（`chat.sessions` 文案 + 图标切换 + 回跳 hermes.chat）；移除单聊/历史宫格切换及其 CSS、NTooltip/openChat 死代码、11 locale 的 `sidebar.singleChat` 键 | 001-002 |
| 20-remove-avatars | 前端头像整体移除（ProfileAvatar 组件 + chat-agent-avatar→chat-agent-label 只留名字映射 + 账号头像设置区 + Profile 头像弹窗/api/store + 聊天头像（气泡/空态/会话列表）+ 看板执行者头像 + `profiles.avatar`/`settings.userAvatar` i18n + 身份开关文案改「只控名字」；服务端路由/存储/DB 保留，coding-agents 静态 logo 保留） | 001-002 |
| 21-chat-run-new-session-attachment | chat-run 新建会话首条带附件消息修复（上游 #3144 的 session-upload 守卫要求会话行已存在，而新建会话的行由本次 run 自己创建 → 首条带附件消息必报 `Session not found`；改为只对已存在的会话做严格校验、首条消息的上传也登记进 session uploads、run 前置拒绝补一行 warn 日志） | 001 |
| 22-theme-styles | 主题风格表驱动化 + 四套新风格（`tech` 升级为「深空 HUD」，新增 `neon` 霓虹赛博 / `aurora` 渐变空间舱 / `blueprint` 浅色蓝图；风格类名与 naive-ui palette 改查表 `STYLE_CLASS` / `STYLE_PALETTES`，材质层拆到新文件 `styles/style-layers.scss`，风格下拉带色卡，11 locale 补标签键） | 001-002 |
| 23-run-speed-latest | 本轮解码速度「当前/平均」双读数（run 态指示器在原有本轮平均旁补「最近一次已完成调用」的读数；server `usage.updated` 增加 `speedLatest`、client store 增加 `runSpeedLatest`、11 locale 的 `tokensPerSecond` 拆为 Current/Average；**不落消息**） | 001-002 |
| 24-styles-and-motion | 两套克制向风格 + 交互打磨：`graphite`（冷峻工程：近黑 + 单一靛蓝 + 细边框，零渐变零发光，naive-ui 圆角收紧，聚焦只画锐环）、`warm`（暖调暗：暖黑 + 暖白正文 + 无彩色强调，暖色渐隐 + 表面半透明）；新增 `--input-focus-glow` 聚焦光晕（按各风格主色派生，顺带修掉深色下聚焦阴影被 `.dark &` 覆盖的宿疾）；引入 `motion-v@2.4.4`（独立 chunk ≈46KB gzip）+ 共享 `motion-presets.ts`（三档 spring + 尊重减少动效），工具卡展开/入场/按压、会话列表 capped stagger、工具面板弹簧缓动 | 001-002 |
| 25-0.7.25-adapt | 0.7.25 升级适配（搜索命中导航跳过 fast-first 预取；vitest 补 `@locales` 兜底别名；上游搜索导航/输入草稿套件适配 fork 行为） | 001-003 |
| 26-0.7.26-nav-chrome | 0.7.26 导航外壳适配：rail 清掉已删功能入口（群聊/工作流/设备互联）并把首个条目改用现存 `sidebar.chat`；抽屉去掉自带的 40px 关闭行（恢复页面侧栏自带关闭键）+ `--drawer-top-inset` 统一顶部安全区；移动端侧栏头部内边距收紧；导航外壳纳入各风格材质层与自定义背景玻璃组 | 001-002 |
| 27-0.7.26-mobile-nav-merge | 手机抽屉一级菜单合并（Aries 定稿）：rail 新增 `labeled`（图标+文字、140px）与 `withAppEntries`（AppSidebar 的 9 个应用级目的地）两个可选 prop，左下三条横线＝文字开关（localStorage 持久）；对应的应用级页面不再重复渲染同一份列表；桌面端不传 prop ⇒ 保持 64px 图标栏 | 001-002 |
| 28-sidebar-drawer-ux | 侧边栏/抽屉四轮验收打磨：新建会话入口改通栏带文字行（有导航栏时不再重复渲染「历史」）；抽屉宽度 `min(320px, 100vw-70px)` + 去掉移动端 × 关闭键（点遮罩关闭）；抽屉玻璃面（容器 `--glass-sidebar-bg` + blur12、rail/页面列透明、naive 抽屉根透明、遮罩 0.3→0.18，非 scoped + `:has` 限定到本抽屉）；图标导航栏图标 22→18px、单项 44×44→36×36、栏宽 64→52 | 001-004 |
| 29-usage-card-trim | 0.7.27 用量卡瘦身（上游新组件 `RunUsageCard`，本 fork 首个直接改上游新 UI 的组）：去掉「缓存命中率」与「预估费用」两格，只留 输出/输入/缓存/速度；栅格 6→4 列、窄栏 2×2 / ≥440px 一行四格；11 locale 删 `runUsageCacheRate(+Hint)`/`runUsageCost` 三键；e2e 断言同步（summary 载荷字段不动，用量页照旧） | 001-002 |
| 30-bridge-clarify-contract | bridge（clarify 问答契约对齐 hermes-agent：`_clarify_callback` 从「旧字符串契约」改为「归一化问题列表 → `{answers,outcome,notice}`」，修复 Studio 里 clarify 面板无选项按钮 / 必报 `Failed to get user input: 'str' object has no attribute 'get'`） | 001 |
| 31-0.7.28-adapt | 0.7.28 上游测试套件适配（`tests/client/device-connections-icon.test.ts`、`file-context-menu.test.ts` 的断言对齐 fork 的入口裁剪） | 001 |
| 32-reconnect-run-state | run 态卡死修复（socket 重连后**重新入房** + 回前台**只对账运行态**：修「壳退后台时任务跑完 ⇒ `run.completed` 收不到 ⇒ 完成报告能拉到、界面却永久停在 run 态」） | 001 |
| 35-patch-stack-verify | 补丁串新鲜度机器校验（`scripts/verify-patch-stack.sh` 把 §348-353 的 verify-am 流程固化：隔离 worktree 重放 109→111 补丁到 main，与 custom 源码树逐字节比对，漏回写即非零退出；CI 在 build 前执行） | 001-002 |
| 36-server-hardening | server 安全加固（头像 mime 白名单收紧去掉 svg+xml 并加 nosniff；profile 头像 `meta.file` basename 守卫；头像错误响应脱敏；socket 健康检查改为连续 3 次 backlog 超阈才断连） | 001-004 |
| 37-client-memory-leaks | client 内存（`subagentStreams` LRU 上限 50、只淘汰非活跃；`usePwa` 模块级闸门 + `onUnmounted` 清理 controllerchange 监听与 30min timer） | 001-002 |
| 38-security-headers | Pages `_headers` 补安全头（nosniff / X-Frame-Options DENY / Referrer-Policy / CSP；内联 theme 脚本需 script-src 'unsafe-inline'、TTS 需 media-src blob:） | 001 |
| 39-chat-compression-timer | 压缩完成自动清除改为 per-session 跟踪 timer（设置新压缩状态即取消旧 timer，避免旧 timer 清掉新状态；两处 compression.completed 共用 helper） | 001 |
| 40-message-list-parse-cache | `MessageList` filter 的 `parseThinking` 按消息对象缓存（内容引用不变即复用，仅流式那行未命中；实测每重算 300 行 1.06ms→0.029ms） | 001 |
| 41-audit-l-cleanups | 审计 L 级（空会话默认 Hermes 而非遗留 Ekko；live reasoning 用稳定 `:key` 不再每 token 重挂载；`cacheHitRatePercent`→`cacheReadSharePercent` 命名对齐实际语义） | 001-003 |

**2026-10-03 新增 `29-usage-card-trim` 组（001 源码、002 测试）**：用量卡从 6 格减到 4 格。
起因是 Aries 实测发现「预估费用」恒为 `—`：账本 `session_usage` 里 **69,631 行全部** `cost_usd=NULL` / `cost_source='unknown'`，原因是
**价格表的 provider 键与账本上报的 provider 不是同一个字符串** —— 定价面板存的是配置里的 provider id（`custom:octopus`，agent 日志里 31 次的少数派），
而 Hermes 往账本上报的是裸族名（`custom`，同一份日志 9783 次），`usage-recorder.ts` 的匹配是精确相等，永远不成立；且面板的 provider 是**下拉**（只列已配置 id），
手工也建不出能命中的条目。上游该匹配函数只对 `custom` 做特例，没做「命名块 ↔ 族名」归一化。
处置：**直接把这两格从卡片上拿掉**（命中率那格本来也只是把旁边的缓存读取数换个说法），保留 输出/输入/缓存/速度；
`run_usage` 表与 summary 载荷里的 `costUsd`/`cacheHitRate` **字段不动**（用量页、导出仍在用）。
复现与判据：`sqlite3` 读 `session_usage` 的 `cost_source` 分布 + `usage_pricing` 的键 + agent 日志的 `provider=` 计数，三者一比即定位。

**2026-10-03 新增 `30-bridge-clarify-contract` 组（001）**：修好 Studio 里的 clarify 表单（本 fork 首个直接改 **agent-bridge Python** 的组）。

- **症状**：Studio 会话里 `clarify` 必定失败——工具返回 `Failed to get user input: 'str' object has no attribute 'get'`；
  面板即使弹出也是一条「Python 列表 repr 的纯文本题、没有选项按钮」，无人作答则 5 分钟后崩同样的异常。
- **根因（契约错配，不是偶发）**：hermes-agent ≥0.21 把澄清契约改成「入参 = 归一化问题列表、回参 = `{answers:{qid:…},outcome,notice?}`」
  （提交 `5eea87882a`「one question shape and one result shape」/ #127760，同批重构**删掉了旧的签名探测兼容层**），
  而 `bridge_pool.py` 的 `_clarify_callback` 仍是 `def callback(question: str, choices=None) -> str` ⇒
  `clarify_tool._result()` 对字符串调 `.get("answers")` 抛 `AttributeError`。上游 **0.7.28 仍是旧签名**（拉 tarball 核对过）⇒ 升级修不了。
- **改法**：回调改为收归一化列表，逐题发卡（每题一个 `clarify_id`——服务端 `respond_clarify` 只能回一个字符串），汇总成 `answers`；
  超时 → `outcome='timed_out'` + `notice`（不再把哨兵文本当成答案），空答 → 该题记 `None`（工具报 `skipped`）后停止整批。
  事件形状 `question`/`choices` 与旧版**逐字一致** ⇒ Web UI 与客户端零改动；`multi_select` 未转发（Studio 仍单选，与既有结论一致）。
- **真机回归（Aries 验收）**：单问（选择题 / 自由文本）与「三问串行」两形态都跑到 `status=answered` + 正确 `user_response` + `outcome=submitted`。
- ⚠️ **生效需换新 worker 进程**（Python 不热重载，`_sync_*_patches()` 不含该方法）：回收 bridge worker 或重启 `hermes-web-ui-client.service`；
  且 **agent 自身就跑在 worker 里**，只能由用户在本轮结束后执行。离线契约对拍脚本与两个回收脚本见 skill
  `hermes-webui-development → references/clarify-capabilities.md`。
- 当前补丁文件总数 = **123**（以 `find patches -type f -name '*.patch' | wc -l` 为准；111 = 35 组时点，其后新增审计整改六组 `36`–`41`）。

**2026-10-05 升级 0.7.30（main `c204d59bd`；5 提交 / 100 文件 / +2675 −2807）**：109 补丁重放 **1 处冲突**（**2 个补丁文件回写 / 100 个逐字节未变**；无新增补丁组）：

- **`05-chat/003-avatar-session-fast-path`（`stores/hermes/chat.ts`）**：上游 #3288 在 `openSession` 的 `beginMessageLoad(...)` 之前新增「未发送草稿无服务端历史」的提前返回，与 fork fast-first 补丁同区域 ⇒ **取上游新行为（HEAD 侧 4 行）+ fork fast-first 增量原样保留**（ours 侧为空，无内容丢失）。回写后该补丁 hunk 的上下文即含上游这段提前返回。
- **`02-pwa/001-pwa-offline-install`（仅上下文漂移）**：上游本轮裁剪 changelog（删 0.7.27 及更早条目），该补丁在 `i18n/locales/{en,zh}.ts` 的 changelog 锚点由 `new_0_7_0_10/11` 变为 `new_0_7_28_5/6`；语义未变，回写仅刷新锚点。
- 上游本轮主题：**#3281 coding-agents 模块隔离重构**（`services/runtime/*` 拆成每 agent 一个 `services/<id>/` + `services/registry/`；`services/native/chat-turn.ts`、`services/native/runtime-config.ts` 删除；`protocol/acp/turn.ts` 迁移；新增 `scripts/coding-agent-module-harness.mjs` 并入 `harness:check`）、#3286/#3289 Copilot 流式与自定义工具参数、#3287 Claude 沙箱权限绕过、#3288 未发送草稿不加载历史、0.7.30 版本号与 changelog。
- 兼容性：`package.json` / `package-lock.json` **仅版本号变化**、`bin/` 与已装包逐字节一致（`npm pack` 实测）⇒ **纯 dist 热替，不需要 `npm i -g`**；`docs/openapi.json` 只有 `info.version` ⇒ **API 面零变化**（hstudio-mobile 无需适配）。
- 验证：预演树（worktree `--detach` 到 upstream tip）`npm run build` exit 0 + `harness:check` 通过；单测三向对比中的双向（30 个受影响/新增文件）新树 **598 例 / 0 失败** vs 0.7.29 基线树 494 例 / 0 失败 ⇒ **0 回归**；补丁行存活审计（带 baseline）**无静默丢失**；删除型补丁标识符复扫 `apikey.fan` 推广链接 / `apiRelay` / workflow 目录 **全仓 0 命中**，`i18n-coverage` 通过。
- 落地手法：预演树已验证树等价，故按 playbook §9 **`cherry-pick upstream/main..<preflight-tip>`**（不再二次 `git am`），`git diff custom <preflight-tip> -- . ':(exclude)patches'` 为空；verify-am **109/109 零冲突、0 差异**。备份 tag `backup/custom-pre-0.7.30`。

**2026-10-04 升级 0.7.29（main `ae238d0ae`；7 提交 / 199 文件 / +4966 −1165）**：106 补丁重放 **6 处冲突**全部解毕并回写（**55 个补丁文件重写 / 51 个逐字节未变；新增 `33-0.7.29-adapt` 组**）：

- **`04-usage/001`（session.ts）**：union merge——上游新增 `ekkoContext?: { fixedContextTokens: number }`，fork 的 `apiPromptTokens?: number` 并排保留。
- **`05-chat/005` / `06-mobile-input/002`（同文件 `ChatPanel.vue`）**：上游 #3277 删除 retired **OpenCode Free** provider，连带删掉 `utils/codingAgentProviders.ts` 的 `isKeylessModelProvider` / `openCodeFreeApiMode`（fork 的 05-chat/005 只把它们当上下文行）⇒ 取上游的 2 符号导入；上游新加的 `useCollapsedProviderGroups` 导入**不带**（fork 的 05-chat/005 已删折叠组 UI，带上会 TS6133）。新会话模型选择：**保留上游 `:loading`/`:disabled`，用 fork 的 `:filterable="!isMobile"`**。
- **`17-remove-group-chat/002` / `18-remove-workflow/002`**：上游 #3280 给 agent picker 重排（Ekko 提到首位、新增 6 个 native agent、`AGENT_OPTIONS.map` → `.filter`）⇒ 保留上游新增的 `it.each([...])` 块与首行，套用 fork 的删除/改名（`it('normalizes Agent aliases')`、丢掉 group-chat / group chat link / workflow 三行）。
- **modify/delete ×9 全接受删除**（fork 侧删除）：`api/studio/group-chat{,-agent-link}.ts`、`group-chat/GroupChatPanel.vue`、`utils/group-agent-avatar.ts`、`views/hermes/GroupChatLinkView.vue`、`workflow/WorkflowAgentNode.vue`、`views/hermes/WorkflowView.vue`、`tests/client/group-chat-panel-workspace-source.test.ts`、`tests/e2e/group-chat-room-deeplink.spec.ts`、`utils/chat-agent-avatar.ts`。
- ⚠️ **上游把 fork 删掉的东西换个地方重新用起来（本轮两处，只有 build 抓到）**：
  1. `stores/hermes/chat.ts` 的 `completionNotificationAgent()` 新增 `if (isNativeCodingAgent(codingAgentId)) return { icon: chatSessionAgentAvatar(session).src }`——引用 fork 已删的 `utils/chat-agent-avatar.ts` ⇒ 改为 6 条显式 logo 分支（`/coding-agents/{qwen-logo.svg,kimi-logo.png,codebuddy-logo.svg,qoder-logo.svg,copilot-logo.svg,zcode-logo.png}`），与既有 claude/cursor/antigravity 分支同款。
  2. 新上游测试 `tests/client/native-coding-agents.test.ts` import 同一模块 ⇒ 新增 **`33-0.7.29-adapt/001-native-agent-avatar-test-adapt`** 去掉该 import 与一条 avatar 断言（其余断言原样保留）。
- 部署：`bin/` 与依赖**零变化**（`package.json` 仅版本号）⇒ 纯 dist 热替，**不需要 `npm i -g`**。
- 验证：预演树 `npm run build`（openapi:generate + vue-tsc -b + vite + server tsc + esbuild）**exit 0**；`harness:check` 通过；三树对比（预演 1675 例 / 140 失败 vs 0.7.28 基线树 1477 / 135 vs 纯净上游 1788 / 1）⇒ **新增失败 5 例全是本轮新上游测试**（`chat-store-session-command` 的 5 个 Ekko 命令用例），根因是 fork 的 `32-reconnect-run-state` 让 store 在 setup 期调用 `onChatRunConnected`、而这 8 个测试文件的 `@/api/studio/chat` mock 没补该导出（**同样因由使基线该文件 23/23 全红，属既有缺口、非本轮回归**）；promo / 删除型补丁标识符全仓复扫 0 命中（`apikey.fan/register`、`apiRelay`、`groupChat.*`、`workflow.*`、`ProfileAvatar`）；改动 vs 旧 custom 与上游改动文件集**完全重合**（无解析器误改）。
- 上游本轮主题：6 个 native coding agent（qwen/kimi/codebuddy/qoder/copilot/zcode，`config/agents.json` → 16 agent）、builtin Ekko 会话分类（`source:'builtin_agent'`）、**新会话默认 agent Hermes → Ekko**（fork 无对抗，跟随上游 ⇒ 用户可见变化）、移除 OpenCode Free provider、Antigravity Live Activity 身份、coding-agent 图片输入 / Windows 长 prompt。
- **同日追加两条（Aries 2026-10-04 拍板）**：
  - **`34-new-chat-default-hermes/001`**：把新会话默认 agent 从上游的 `ekko-agent` **改回 `hermes`**（`ChatPanel.vue` 两处：ref 初值 + 空选项时的兜底字面量）。上游 #3284 的「只列已安装 agent」过滤与「创建期不探测 CLI」**照留**；默认只在 `hermes` 不在已安装列表时才被首个可用项取代（既有逻辑）。
  - **`32-reconnect-run-state/002`**：补 8 个 chat-store 测试文件 `@/api/studio/chat` mock 的 `onChatRunConnected`（32/001 让 store 在 setup 期就调用它 ⇒ 未 mock 的测试**在 setup 直接抛错**）。并把 `chat-store-reasoning-effort` 的 `fetchSessions` 从裸 `vi.fn()` 重新接回 `sessionsApi.fetchSessions`——05-chat/003 当年改断了这层接线，使「从服务端摘要读 reasoning effort」用例的 `.mockImplementation` 失效（此前被 setup 崩溃掩盖，补 mock 后才暴露）。8 文件 132 例全绿（此前 127 例红）。


**2026-10-03 新增 `32-reconnect-run-state` 组（001）**：修「壳退后台时任务跑完，界面永久停在 run 态」（Aries 2026-10-03 真机验收）。

- **症状**：手机壳（WebView）退后台期间任务跑完 → 回前台**完成报告能拿到**（消息自己出现），但界面一直停在 run 态（转圈不消失、停止键不还原），停在那个会话里不自愈；切走再切回/刷新即恢复。
- **根因（两处叠加，都在客户端）**：
  1. **重连丢房间**：客户端把 run 态建立在 `streamStates ∪ serverWorking` 上（`isStreaming` → `isRunActive`），而这两个集合只有 **socket 终态事件**（`run.completed`/`run.failed`/`abort.completed`）或**重新打开会话**（resume 返回 `isWorking:false`）才会清。服务端 run 事件**只发 `session:<sid>` 房间**（`sockets/chat-run.ts`）。重连在服务端是**新 socket 对象** ⇒ 房间成员关系清零；而**只有本机发起的那条 run** 会在 `connect` 时补发 `resume`（该钩子注册在 `startRunViaSocket` 内），
     **以「resumed 运行中」挂着某个 run 的会话没有任何 connect/disconnect 钩子**（`switchSession`/`resumeServerWorkingRun` 里写明「不必再发 resume」）⇒ 终态事件永远收不到。
  2. **前台恢复被自己挡住**：`visibilitychange` 恢复路径要求 `!isStreaming` 才走 ⇒ 客户端正（错误地）认为在跑 ⇒ 整段跳过，连消息都不拉；此时**唯一还在跑的是停滞看门狗**（`11-socket-stall/002`），而它只 `refreshActiveSession()` 重拉消息、**完全不碰运行态** ⇒ 正是「消息在刷、run 态不消」的组合。
- **改法**（纯客户端，2 文件）：
  - `api/studio/chat.ts`：新增全局 `onChatRunConnected`（照既有 `onPeerUserMessage` 注册表模式），在 `connectChatRun` 的全局监听块挂 `connect` ⇒ 首次连接与每次重连都广播。
  - `stores/hermes/chat.ts`：① 订阅它 → 对「客户端仍认为在跑」的会话（`serverWorking ∪ streamStates`，且在本机会话列表中）逐个重发 `resume`（重新入房 + 拿服务端 `isWorking` 对账）；服务端说已经跑完则本地收敛（清 `streamStates`/`serverWorking`/`runStartedAt`、收尾流式气泡与运行中工具、关 abort/压缩态、按服务端值留队列、标未读、刷新该会话消息）。
    ② `visibilitychange`：`isStreaming` 为真时不再整体跳过，改为发一次**只对账运行态、不动消息**的 resume（真实流式期间不会用服务端快照盖掉本地已累积的 delta）。
- **验证**：`npm run build`（vue-tsc+vite+server）exit 0；本机 dist/client 热替（未重启，`MainPID`/`ActiveEnterTimestamp` 未变；三处 `index.html` md5 一致 + 入口 chunk sha256 一致 + chat chunk 内 `queueLength` 计数 11→12）；**Aries 真机复现验收通过**——「发起任务 → 切走再切回该会话（让客户端以 resumed 运行中挂着）→ 退后台等它跑完 → 回前台」，run 态自愈，无需切换/刷新。
- 触发前提（复现要点）：该路径只在**任务开跑之后客户端才接上这个会话**时成立；若 run 就是本机当前页面发起的，`startRunViaSocket` 自带的 connect 钩子本来就会补 resume ⇒ 观察不到。
- ⚠️ 纯前端改动，**热替 dist/client 即可、无需重启**（`packages/server` 零改动）。

**2026-10-02 升级 0.7.27（main `ef9409601`；9 提交 / 145 文件 / +4948 −493）**：101 补丁重放 **10 处冲突**全部解毕并回写（**53 个补丁文件重写 / 48 个逐字节未变；无新增补丁组**）：

- **`04-usage/001`/`002`/`010`（同族，改动最大）**：上游 #3248 把 `recordBridgeModelUsage` 从 `services/chat-run/handle-bridge-run.ts` 抽到新模块 **`services/usage/bridge-model-usage.ts`**，并顺带补上 `parentRunId` / `apiDuration`（配合 0.7.27 新增的 `usage.parent_run_id`、`usage.api_duration` 列与 `run_usage` 表）。我们的**上下文用量口径（API `prompt_tokens`）与解码速度折叠（`foldDecodeCallResult`）移植进该新模块**——`bridge-model-usage.ts` 新增可选第 6 参 `live?: {state, emit}` 与 `applyApiPromptContextTokens` 调用，调用点仍在 `handle-bridge-run.ts`（传 `{ state, emit }`），上游的 `parentRunId`/`apiDuration` 一并保留。
- **`17-remove-group-chat` / `18-remove-workflow`**：上游 #3248（群聊回复气泡里的 run usage）与 #3247（抽屉/工作区选择器）改了我们要删的前端文件（`api/studio/group-chat.ts`、`group-chat/{GroupAgentRunCard,GroupChatPanel,GroupMessageItem}.vue`、`stores/group-chat.ts`、`WorkflowView.vue` 及对应 `tests/client`+`tests/e2e`）⇒ 按 **modify/delete 接受删除**（先确认上游不再有其他引用）。服务端两模块照旧保留。
- **`26-0.7.26-nav-chrome` / `27-0.7.26-mobile-nav-merge` / `28-sidebar-drawer-ux`（同一文件 `MobileNavigationDrawer.vue`）**：上游 #3247 引入**全局 `--studio-drawer-width`**（桌面 `min(520px,100vw)`、移动 `100vw`）统一所有 `NDrawer`，并给移动导航抽屉加了 5px 圆角、`overflow:hidden` 和自带关闭行的 CSS。裁决：**保留 fork 的 `drawerWidth`**（`min(320px, calc(100vw - 70px))`，与「点遮罩关闭、任何视口留 ≥70px」配套；上游的移动端 `100vw` 恰好是当初被否的形态）、保留玻璃面与「删掉自带关闭行」，**采纳上游的圆角/overflow**。
- **重合点的处置（Aries 2026-10-02 定）**：上游 0.7.27 新增 **`RunUsageCard.vue`**（每条 assistant 消息下方一格：输出 / 输入 / 缓存 / 命中率 / 费用 / **tok/s**，服务端按 assistant 消息落库 `run_usage`）与我们既有的消息下 `本轮平均速度：N tok/s`（`04-usage/010`）**会在同一条消息上重复出现 tok/s** ⇒ 决定**移除 fork 那条消息行**，**保留上游用量卡 + run 态「当前/平均」**。
  落法（折叠，不留「加了又删」的补丁）：把移除折回引入它的 `04-usage/010`（该补丁现在只做 run 态读数与参考解算，`MessageItem.vue` 不再被它碰），并回写受上下文影响的 `23-run-speed-latest/001`、`24-styles-and-motion/001` 等 → 共重写 27 个补丁文件、verify-am 101/101 零冲突零差异。
  **同日后续**：卡上门再去掉「缓存命中率」与「预估费用」两格（新组 `29-usage-card-trim`，见上）。
- 部署：`bin/` 与依赖**零变化**（`package.json` 仅版本号）⇒ **不需要 `npm i -g`**，直接 dist 热替即可（client + `server/index.js`±map + `server/openapi.json` + `ekko-skills` + `agent-bridge/python`）；跑 `npm i -g` 前仍须清 socks5 代理变量（0.7.24 坑，否则 node-pty 编译失败）。
- 验证：本机 `npm run build`（`openapi:generate` + `vue-tsc -b` + vite + server tsc + esbuild）**exit 0**；**双树对比**受影响的 158 个测试文件：新树 1449 例 / 16 失败 vs 基线（0.7.26 custom）1327 例 / 13 失败，**新增 3 例全是 `tests/server/coding-agent-run-manager-windows.test.ts` 的 `no such table: messages`，纯净上游树同样复现 ⇒ 0 fork 回归**；行存活审计只剩「被本 fork 自己删除的文件」与已移植项；verify-am **101/101 落位、零冲突、与 custom 源码树 0 差异**；`i18n-coverage` 16 例全绿、无被删功能的 i18n key 回归（`sidebar.apiRelay`/`workflow`/`groupChat`/`connections` 全 0）。

**2026-10-02 新增 `28-sidebar-drawer-ux` 组（001-004，Aries 手机端逐轮验收，一条一补丁便于单独回滚）**：

- **001 新建会话入口**：原来是 32×34、15px 图标、`#666`、无文字的小按钮，挤在搜索框右侧（Aries：「太小了，甚至注意不到」）→ 改为**通栏带文字行**，位置在搜索行**上方**，样式与其它条目**完全同款**（34px / 灰字 / 无填充，仅 hover 出 6% 底纹）。首版做成主色实心按钮被否，理由「风格不统一」——统一优先于强调。
- **001 顺带**：导航栏一级已有「历史」⇒ 面板不再渲染同名行（`hasNavigationRail` 时隐藏，与既有的 Agent 管理/模型同规则），消除抽屉里两处「历史」；历史页那行是回「会话」的跳转（`active === 'history'` 分支），保留。
- **002 抽屉宽度与关闭**：原 `min(392px, 100vw - 24px)` 在 390 视口只剩 **24px** 遮罩可点（实测点得中、但落在系统手势区，实际按不到）⇒ 只有点面板 × 才能关；改 `min(320px, 100vw - 70px)`（任何视口都留 ≥70px），并删掉移动端 × 关闭键（`ChatPanel`/`HistoryView` 各一处 + 两处因此变死的 CSS）。关闭改由点遮罩承担，CDP 真点实测：按下 + 抬起 ⇒ 抽屉宽度 0、遮罩消失；360 视口回落 290px（仍留 70px）。
- **003 抽屉玻璃**：容器改 `var(--glass-sidebar-bg)` + `backdrop-filter: blur(12px) saturate(110%)`（复用带自定义背景时既有的玻璃配方，强度随主题走），rail 与页面列设 `transparent`（只留**一层**玻璃，两列各透一次会把背景叠浑）；naive 抽屉根自身的模态白底（`--n-color`）必须透明化，否则玻璃被它盖住；遮罩 0.3 → **0.18**（重遮罩 + 半透面板读起来发脏）。
  naive 把抽屉根与遮罩渲染在**本组件子树之外**（两者是兄弟节点）⇒ 这段用**非 scoped 样式块 + `:has(.studio-mobile-drawer)`** 限定；实测其它 NDrawer（新建会话/语音/看板）遮罩仍是 naive 默认 0.3。
  像素实测（同坐标）：抽屉内空白 **255 → 226**（背后内容确实透出）、遮罩区 **83 → 98**（遮罩确实减淡）。
- **004 图标栏尺寸**：仅图标模式渲染 svg 写死的 **22px 属性**，而带文字模式是 CSS 强制 **18px** ⇒ 两模式不一致、仅图标偏大；统一 18px（CSS 覆盖属性），单项 44×44 → **36×36**，`$navigation-rail-width` 64 → **52**（`MobileNavigationDrawer` 的 `RAIL_WIDTH.collapsed` 同步，页头 `--studio-header-inset` 自动跟随）。实测：桌面 52 / 36×36 / 18；抽屉纯图标 52 / 36×36 / 18（面板得 268）；带文字模式仍 140 / 124×38、18px 图标，不受影响。
- 验证：`vue-tsc -b`、`vite build` 通过；`tests/client` 相关 3 个套件 5 用例全绿；**verify-am 全串重放 101/101 落位、零冲突、与 custom 源码树 0 差异**。

**2026-09-27 新增 `24-styles-and-motion` 组（001 源码、002 测试）**：风格补到 **9 套**，并给交互补上状态反馈与物理手感。

| 风格 | 定位 | 关键点 |
|---|---|---|
| `graphite` 冷峻工程 | T1（Linear / Vercel / x.ai） | 近黑 `#08090a` + 靛蓝 `#5e6ad2`；**零渐变/零阴影/零发光**（实测顶-底亮度差 0.00），只靠 1px 半透明白边分层；naive-ui 圆角收紧到 6/4px |
| `warm` 暖调暗 | T6（Warp / OpenCode） | 暖黑 `#201d1d` + 暖白 `#e6dccd`；**无彩色强调**（按钮是纸白底深字）；暖色渐隐（实测暖度 +4.59、顶-底 +6.43）；表面半透明让渐隐透出 |

- **聚焦光晕（状态样式）**：新增 `--input-focus-glow`，从各风格自己的 `--accent-primary-rgb` 派生，一套变量覆盖 9 风格；`graphite` 按 T1 定义 opt-out（`noFocusGlow` → 只画 1.5px 锐环）。同时修掉一个宿疾：composer 的聚焦 `box-shadow` 在深色风格下**从未生效**（`.dark &` 同等特异性但更靠后）。naive-ui 输入类组件同步加了 `boxShadowFocus` / `boxShadowActive`。
- **动效（motion-v）**：`motion-v@2.4.4`（MIT，官方 motiondivision/motion-vue）落地为独立 chunk **≈46KB gzip**（占全部 js gzip 1.06%，入口 chunk 只 +1.3KB），无 React 代码混入。共享 `composables/motion-presets.ts` 统一三档 spring 并在系统「减少动效」时降级为短 tween。接入：工具卡展开改 spring `height:auto`（替换原 CSS `grid-template-rows` 技巧）、工具卡入场、工具卡 header / 主题按钮按压；会话列表用 **capped nth-child 纯 CSS stagger**（根元素是动态 `<component :is>` 且有 5 个调用点，加 index prop 不划算）；工具面板用**弹簧形 `linear()` 缓动**（该面板是 Vue `<Transition>` + 4 个生命周期钩子，且上游测试钉死 `width 0.25s`，换 motion-v 风险收益不匹配）。
- ⚠️ 途中把 spring 加到了 `DrawerPanel.vue`，实测发现它是 **fork 内死代码**（全仓零引用）→ 已 `git checkout` 回退，无无意义改动。

验证：`vue-tsc -b` 与 `vite build` 通过；客户端测试对比**当前环境**基线（56 失败/12 文件）**零新增失败**；9 套风格在真实浏览器逐风格读回 `html` 类名 / `--bg-primary` / `--accent-primary` / `theme-color` 全部命中；聚焦光晕以截图 + 计算值双实证（tech 出青光晕、graphite 无发光）；Aries 真机验收通过。

**2026-09-27 新增 `23-run-speed-latest` 组（001 源码、002 测试）**：
`04-usage/010` 上线后 run 态指示器只有一个数——本轮平均，随着调用陆续完成会**往上爬**，长工具执行期间看着像在变。
本组在旁边补上「当前」= **最近一次已完成调用**的解码速度（一次事件下发一次，工具执行期间数值不动）：

- server：`foldDecodeCallResult` 额外记下最后一次调用的 span/tokens，`latestRunSpeed` 暴露它；
  `usage.updated` 在原有 `speed`（本轮平均）旁新增 `speedLatest`；新 run 接管 fold state 时两者一起归零。
- client store：`runSpeedLatest` 与 `runSpeed` 并列，同一事件填充，`clearRunSpeed` 一起清。
- 聊天视图：run 态指示器并排渲染「当前 / 平均」（**只在 run 态显示**；2026-10-02 起不再结算到消息上，消息下的速度行已随 0.7.27 重合处置移除）。
- i18n：`chat.tokensPerSecond` 拆为 `chat.tokensPerSecondCurrent` / `chat.tokensPerSecondAverage`（11 locale 同步）。

⚠️ **为什么是新组 23 而不是接在 `04-usage/010` 后面**（踩过并已实证的坑）：
重放顺序是**按组号**（`04` → `05` → … → `22`），而 `LiveReasoningStatus.vue` 同时被
`04-usage/010`、`05-chat/014/020/021`、`20-remove-avatars/001` 改过。把本补丁放进 `04-usage` 时，
它会在 `05-chat/020` **之前**被应用，可它的 diff 是在 `05-chat/020` **之后**创作出来的 ⇒ 基线不匹配，
`git am --3way` 在该文件上直接冲突（实测 87/88 落位、1 失败）。**结论：新补丁必须放进「组号排在它所依赖的所有补丁之后」的组**，
若它依赖了多个更高组号的补丁，就新建一个组放在最后，而不是塞回早期组。

验证：`tests/client/live-reasoning-status-speed.test.ts`（新）+ `tests/server/run-chat-run-speed.test.ts`（扩）
+ 既有 `run-speed` / `message-item-run-speed` / `chat-store-workspace-diff-turn` 共 **30 用例全绿**；`vue-tsc -b` 通过；
全量 **88/88** 补丁在 `upstream/main` 上零冲突重放、重放树与 `custom` 逐字节一致。

共 **90 个补丁**（含 01-ci/006 的 custom 分支切换；0.7.1 升级新增 10-perf-p1/005、05-chat/016-聊天身份开关、05-chat/017-用户气泡浅蓝；0.7.17 后新增 05-chat/018-clarify 折叠收起、05-chat/019-工具卡按轮分组、12-tool-strip/002-运行中工具行展开详情、12-tool-strip/003-toggle 与列表上下堆叠、12-tool-strip/004-展开详情解除高度限制、09-cleanup/002-移除 apikey.fun 推广、08-server/003-归档数据源放行；0.7.18 重放 77/77 成功，3 处冲突已回写：05-chat/004、05-chat/005、11-socket-stall/001；0.7.22 新增 14-test-adapt/001；**0.7.23 重放 83/83 零冲突、无补丁需回写**；**2026-09-21 移除 03-connection 组（11 补丁）+ 连带失效的 09-cleanup/001，重放 72/72 零冲突**；**2026-09-21 新增 16-agent-entry/001-侧边栏「Agent 管理」入口可配置**；**0.7.24 重放 73/73 落位、2 处位置冲突已回写：01-ci/004、15-mobile-models/001**；**2026-09-24 新增 13-mobile-nav/002-页面侧边栏抽屉打开时隐藏全局 ☰**；**2026-09-24 新增 17-remove-group-chat 组（001 前端源码移除、002 测试适配）**；**2026-09-24 新增 18-remove-workflow 组（001 前端源码移除、002 测试适配；保留 workflow 会话来源与 webhook 事件名）**；**2026-09-24 新增 19-sidebar-history-toggle 组（侧边栏扁平化 + 历史⇄会话切换，对齐上游 #1518）**；**2026-09-24 新增 20-remove-avatars 组（001 前端源码移除、002 测试适配；服务端与静态 logo 保留）**；**2026-09-27 新增 21-chat-run-new-session-attachment/001（上游 #3144 附件守卫 → 新建会话首条带附件消息必报 `Session not found`；只对已存在会话严格校验 + 首条上传登记 + 前置拒绝日志），共 90 个补丁**；**0.7.25 重放 90/90 落位、18 处冲突已回写（group-chat/workflow/avatar 三块整体移除接受 modify/delete；ChatInput 撞名 `showSessionUsage`→`showSessionTokensUsed`；搜索导航与 fast-first 合并；上游新 `stores/account.ts` 依赖 → 重建 20-001 保留 `UserAvatar`+`fetchMyAvatar`；并新增 25-0.7.25-adapt 组（001 搜索命中跳过 fast-first、002 vitest `@locales` 兜底、003 上游搜索导航/输入草稿套件适配）），共 93 个补丁**）。

**2026-09-27 新增 `22-theme-styles` 组（001 主题表驱动化 + 四套风格、002 测试）**：
主题从「四个写死的风格」改为表驱动，并新增三套外观（`tech` 同时升级）：

| 风格 | 定位 | 关键点 |
|---|---|---|
| `tech`（升级） | 深空 HUD | 近黑藏蓝 `#070a12` + 青 `#22d3ee`；128px 模块网格 + 32px 细网格 + 顶部青光 |
| `neon` | 霓虹赛博 | `#05060a` + 青 `#00e5ff`/品红 `#ff2d95`；3px 扫描线 + 双角 bloom + 卡片霓虹描边 |
| `aurora` | 渐变空间舱 | `#0a0a14` + 紫 `#8b5cf6`；三层极光 radial（42s 漂移）+ 表面 0.60 半透明 + `backdrop-filter` |
| `blueprint` | 蓝图（浅色优先，跟随明暗） | 浅 `#f4f7fb` / 暗 `#0d1b2a`，墨蓝 `#0b6bcb`；16px 细网格 + 80px 模块网格 |

泛化：`theme-style.ts` 成为唯一来源（`STYLE_CLASS` 类名表 / `STYLE_CLASSES` / `STYLE_SWATCH` 选择器色卡），
`main.ts` 与 `useTheme.ts` 删掉逐风格的 `if`，`theme.ts` 用 `STYLE_PALETTES` 注册表取代三元链
（`DarkStylePalette`→`StylePalette`、`darkStyleOverrides`→`styleOverrides`）。**加风格不再改 main/useTheme/单测。**

⚠️ 落地时最重要的一条：hermes-studio 是**浮动卡片布局**，页面背景只剩 ~10px 缝隙可见，**只把氛围纹理加在 `.app-layout` 上等于没加**
（实测：卡片截图的频谱里检不出任何周期）。做法 = `body::after` 固定全屏层（z-index 3，在 `.app-layout` 之上、naive-ui teleport 弹层之下）
+ 各风格把 `--bg-main-surface` / `--bg-sidebar-surface` 改半透明（含 `-rgb` 兄弟变量）。**两半必须成对。**

验证（本机）：`vue-tsc -b` 与 `vite build` 通过；客户端测试对照 HEAD 基线 worktree **零新增失败**（基线 101 失败 / 31 文件）；
Playwright 登录后逐风格读回 `html` 类名 / `--bg-primary` / `--accent-primary` / `theme-color` **全部命中**；
材质渲染用「去趋势 + FFT 谱峰/底噪比」实证：tech 32px **410**、neon 3px **176**、blueprint 16px **42（浅）/281（暗）**，
ink/aurora 无周期（符合设计）。Aries 真机验收通过。

⚠️ 提交时工作树另有**既有未提交 WIP**（run 态实时速度 `speedLatest`：`LiveReasoningStatus` / `MessageList` /
`stores/hermes/chat.ts` / server `contracts+runs/session.ts` / `chat-run/usage.ts` / 两个测试文件 / locale 的
`tokensPerSecond→tokensPerSecondCurrent+Average`），与主题在 11 个 locale 文件里**同文件不同 hunk**；
本次只提交主题 hunk，speed hunk 原样留在工作树（拆分脚本见 `hermes_workspace/hermes-studio-tech-ui-research/stage-theme-only.py`）。

**2026-09-23 新增 `09-cleanup/003-remove-connections-sidebar-entry`（用户要求，仅前端）**：
删除页面侧边栏（chat / 历史 / 群聊 / workflow 共用的 `PageSidebarNav.vue`）的「设备互联」tab 及随之失去引用的 `openConnections()`；
**路由 `hermes.connections`、`ChatView` 的 `connections` section、`ConnectionsPanel` 全部保留**（页面仍可经 URL 直达，符合「只裁剪入口、保留页面代码」惯例）。
验证：`vite build` 通过；新产物 `PageSidebarNav-*.js` 中 `sidebar.connections` 与 tab 图标 path 命中 **0**（旧部署产物各 1）；本机 `dist/client` 已热替。
上游测试 `tests/client/agent-manager-routing.test.ts` 用 `indexOf` 比较先后顺序，删除后 `-1` 不破坏 `>` 断言 ⇒ 无需改测试。

**0.7.24 升级（2026-09-22，上游 `4805c44b1` = 29 提交 / 194 文件 / +8522 −949）**：
73 个补丁 `git am --3way` 全部落位（无空提交），**2 处位置冲突已解并回写**（0.7.23 为零冲突）：
- `01-ci/004-test-client-mocks`：上游给 `tests/client/models-store.test.ts` 的 `@/api/client` mock 加了 `getModelsPageProfile`，与我方同一行插入 `getBaseUrlValue` 重叠 → **取并集**（单行含三个成员）。
- `15-mobile-models/001-models-page-mobile-layout`：上游在 `.models-content` 与 `.header-actions` 之间插入新的 `.models-profile-select`（模型页 profile 选择器），与我方插入的移动端 `.models-content{padding:12px}` 媒体查询同位 → **两侧都保留**（媒体查询在前，维持注释里「必须紧跟基础规则」的约束）。
- 其余补丁（含 05-chat/016-022、12-tool-strip、13-mobile-nav、16-agent-entry）全部自动合并，无上下文漂移回写。
依赖与 `bin/` 无变化（`package.json` 仅 version + repository URL）⇒ 热替脚本覆盖范围不变，但仍建议 `npm i -g hermes-web-ui@0.7.24` 对齐安装包元数据。
API 面：新增 13 条路径（`session-shares` 会话分享、`push/live-activities` 注册、`share-voice`、`share-context-length`、`share-models/workspaces`），**零删除**；hstudio-mobile 无需适配。
回归判定（双树 JSON 对比，95 个「补丁涉及 + 上游新增」测试文件）：新树 1596 用例 / 13 失败 vs 0.7.23 基线树 1392 用例 / 12 失败，**`新−旧` = 0 条真回归**；
唯一新增失败 `sessions-controller > returns shared session agent and workspace metadata without account secrets`（`no such table: task_plans`，批量执行时的测试库干扰，单跑该文件 81/81 全绿）在**纯净上游 0.7.24 树同样复现** ⇒ 上游/环境问题，非 fork 引入。
预演树（worktree `--detach` 到上游 tip）与落地 custom 逐字节一致（`git diff custom <预演 tip>` 排除 `patches/`、`docs/openapi.json` 为空）。

**0.7.23 升级（2026-09-19，上游 `551c1104e` = 13 提交 / 152 文件 / +4511 −560）**：
83 个补丁 `git am --3way` **全部零冲突落位**（0.7.22 是 3 处），补丁文件**逐字节未变**（无需回写）；
与补丁重叠的上游文件 20 个（13 locale + `controllers/sessions.ts`、`stores/hermes/chat.ts`、
`ChatPanel.vue`、`HistoryView.vue`、`sockets/chat-run.ts` 等）全部自动合并，`archived=1` 分支与上游新增
pinned 过滤共存。⚠️ 上游把 npm 包改名 `ekko-studio`（保留 `hermes-web-ui` 双发包）并把 MCP 服务
`ekko-studio-plan` 改名为 `ekko-studio-interaction`（autoinject 负责迁移 legacy 名）。

**03-connection 组移除（2026-09-21，用户决定）**：
- 背景：本机迁入家庭网络后 tailnet 直连（同源访问本机 tailscale serve / tailscale IP），不再使用「静态前端（CF Pages）+ 自定义后端 URL」的前后端分离部署 ⇒ 移除全部「连接」自定义。
- 移除：03-connection 全组 11 补丁（ConnectionSettings.vue、登录页服务器编辑器、auth.ts base URL、upload 405 修复、i18n ×10 语言、AppSidebar 登出选择性清理）+ 连带失效的 09-cleanup/001（其清理对象 `51ccc514` 残留标记由本组 008 引入，组移除后不再存在）。
- 重放：`git am --3way` **72/72 零冲突落位**、无补丁需回写；净差异 30 文件 +16 −2848。
- 保留上游机制：`hermes_server_url` / `getBaseUrlValue` 为上游自带（20 文件在用），不受影响；已存在的 localStorage 自定义 URL 仍被上游逻辑读取（本机同源使用下为空）。
- 行为变化（恢复上游）：登出 `localStorage.clear()`（不再保留主题/locale/连接配置）；上传恢复相对路径 `/api/studio/uploads`；登录页恢复上游样式（无服务器编辑器）。
- 验证：vue-tsc 0 错 + vite build 成功；相关单测对照旧 tip 无回归（旧 30 failed/318 passed → 新 29 failed/319 passed；唯一差异 = models-voice-tabs 旧 tip 因 ConnectionSettings 渲染撞不完整 naive-ui mock 失败 1 例、移除后转绿；其余 29 例为 chat-store 套件既有失败）。
- 交付：本机 dist/client 热替（未重启）；push `a5fb6a388` + tag `backup/pre-conn-removal-20260921`（CI build+deploy 双绿）；**2026-09-21 用户实测确认通过**。

**0.7.19 之后新增（2026-09-12）**：04-usage/010-每轮解码速度（run 态实时 + 单轮结束常驻在消息上）；05-chat/020-去掉 run 态「正在思考」左侧的 thinking.gif 图标（模板/导入/样式三层清理 + 单测与 e2e 断言同步；未导入的 gif 资产保留在源码树，构建产物不再打包）。
链路：hermes-agent `post_api_request` hook 的 `first_chunk_at` → `bridge_pool.py` 透传 → `chat-run/usage.ts` 折叠（`output_tokens / (ended_at - first_chunk_at)`，仅按**调用**累加，无首 chunk 的调用整体退出）→ 每次调用完成时随 `usage.updated` 的 `speed` 字段下发一次 → 客户端两处显示：① **run 态**：`LiveReasoningStatus`（"正在思考"计时右侧）实时显示 `138 tok/s`；② **单轮结束时**：`clearRunStartedAt` → `settleRunSpeed` 把最后一个读数挂到**本轮最新 assistant 消息**上，`MessageItem` 在消息下方常驻 `本轮平均速度：145 tok/s`（`.assistant-run-speed`），随后清理 run 态读数避免重复显示。
设计取舍（用户 2026-09-12 定，三轮收敛）：① **不做流式估算、不周期性下发** —— 一次调用完成只发一次，数字在工具执行/思考停顿期间保持不动（早期流式估算会因分母持续增长而一直下降，已废弃）；② **run 态 + 结束常驻两处都要** —— 只放 run 态则单轮结束即消失，只放消息上则运行中看不见；③ 读数**纯客户端**挂载，刷新/重开后丢失（用户已接受，未落库）。
⚠️ 该补丁改到 `bridge_pool.py`，热替脚本 `patch-hermes-web-ui-from-workspace-dist.sh` 已同步新增 `dist/server/agent-bridge/python/` 的 rsync 段（只换 index.js 不够，bridge worker 从**安装包**里加载这些 py 文件）。

**13-mobile-nav/001-移动端顶栏与 ☰（2026-09-12，用户验收 38px）**：
- 几何单一来源 = `packages/client/src/styles/variables.scss` 的 `$mobile-topbar-height`(38px) / `$mobile-topbar-content`(32px)，
  派生出 `$mobile-topbar-min-height`、`$mobile-topbar-padding`（对称垂直内边距 + min-height ⇒ 内容中心恒为 高度/2 = 19px）；
  ☰ 的 `top` 也从同一变量推导，禁止写死像素。
- 受管顶栏：global.scss `.page-header`（`!important`，含 Models/Logs/Usage/Agents…）、
  ChatPanel/GroupChatPanel/HistoryView 的 `.chat-header`、TerminalView 的 `.terminal-header`、WorkflowView 的 `.page-header`；
  KanbanView 两行 sticky 顶栏**只**用同一变量推导首行 padding（不能固定高）。
- ☰ 图标：删除 `App.vue` 里的 `/logo.png` 品牌图，改 18px / stroke 1.5 / 圆头圆角三条横线（与终端/侧栏那批内置图标同族）。
- 移动端隐藏与 ☰ 功能重复的四宫格 ▦：新增 `ModelsView`（`.models-sidebar-toggle`，独立 mobile 块）与 `WorkflowView`（`.header-sidebar-toggle`）。
  ⚠️ **TerminalView 的 ▦ 有意保留**：`hermes.terminal` 不在 `App.vue usesPageSidebar` 名单内，其 ☰ 打开的是应用导航抽屉而非终端会话列表，
  隐藏后移动端将无法打开终端会话。
- 实测（本机 Playwright + 系统 Chrome，390×844）：聊天/历史/终端/群聊顶栏 = 38px、内容中心 18.5~19、☰ 中心 19；`.page-header` 类因 1px 下边框为 39；看板两行 191px、首行中心 19.2。
  验证配方与三个环境坑见 skill `hermes-webui-development → references/mobile-topbar-geometry.md`。

**15-mobile-models/001-模型页移动端布局（2026-09-20 正式入补丁串）**：
- `AuxiliaryModelsPanel.vue`：断点由写死的 `760px` 改为共享变量 `$breakpoint-mobile`；
  `delegation-actions` 左对齐 + `width:auto`（原「整行宽 + 右对齐两个按钮」在 390px 上是空洞）；
  `delegation-summary` 改 `repeat(auto-fit, minmax(150px, 1fr))`，每个 cell 自带顶部分隔线（换行成单列仍有分隔）；
  720px 固定宽表格 `.auxiliary-table` → `min-width:0` + `overflow-x:visible` + 隐藏 `.auxiliary-row-head`，
  `.auxiliary-row` 用 `grid-template-areas` 排成 `name actions / config timeout` 两行卡片。
- `ModelsView.vue`：`.models-content` 移动端 padding 20 → 12px（**必须放在基础规则之后**，两者特异性相同）。
- 该改动 2026-09-14 完成并热替本机供用户实测，因未提交而在 0.7.22 / 0.7.23 两次升级里被反复 stash / 取回；
  本次正式入补丁串（当时的工作树 WIP 与 `stash@{0}` 逐字节相同，stash 已清理）。
- 范式与 390×844 实测记录见 skill `hermes-webui-development → references/mobile-settings-panel-tables.md`。

**16-agent-entry/001-侧边栏「Agent 管理」入口可配置（2026-09-21）**：
- 设置 → 显示 tab 新增「侧边栏「Agent 管理」入口」下拉：默认（Agent 列表）/ Ekko / Hermes / Claude / Codex / Pi / Grok / OpenCode / DSH。
- `utils/agent-manager-entry.ts`（新）：localStorage 键 `hermes_agent_manager_entry`（纯本地偏好，无服务端改动）；`resolveAgentManagerEntryRoute` 映射目标路由。
- `PageSidebarNav.vue`：`openAgentManager` 读偏好 → 有目标直接跳（Ekko→`ekko.settings`、Hermes→`hermes.configSettings`、编程工具→`codingAgent.config{agentId,section:'settings'}`），未设置时维持 Agent 列表。
- i18n ×11 新增 `settings.display.agentManagerEntry*` 三键；测试：util 单测 3 例 + display-settings 1 例 + locale parity 1 例。
- 交付：本机 dist/client 热替（未重启）；push `6acb78d3d`（feature）+ `2d9ce63d5`（补丁登记），CI Build 绿；**2026-09-21 用户实测确认通过**。

**已知偏差（2026-09-21 记录，决定不修）：clarify 折叠态与 approval 共存时的列表留白**：
- 位置：`packages/client/src/components/hermes/chat/MessageList.vue` 的 `clarifyCompact` / `virtualListPadding`（05-chat/018 引入）。
- 现象：同一会话中 clarify 已被折叠（`clarifyCollapsed=true`）时又出现 approval → clarify 面板被 `!visibleApproval` 隐藏、真正显示的是 approval 面板，
  但 `clarifyCompact` 仍为 true → 列表底部只留 80px（上游该分支固定 260px）→ approval 浮层盖住最后几条消息。
- 复现（实测 jsdom 探针，已删除）：仅 clarify → padding `20px 20px 260px`；点折叠 → `80px`；再注入同会话 approval → 仍 `80px`。
  该场景不是臆想：上游自带 client 测试 `tests/client/message-list-scroll-position.test.ts`（"has no close control and keeps explicit approval and reply actions usable"）本身就构造了 approval+clarify 同时 pending。
- 不修原因（用户 2026-09-21 定）：需「折叠态 + 两个 pending 同时存在」才触发，只造成视觉重叠、无功能或数据损失。
- 若日后要修，一行即可：`const clarifyCompact = computed(() => !visibleApproval.value && !!visibleClarify.value && clarifyCollapsed.value)`。
- 升级注意：05-chat/018 的 `ru.ts` hunk 是旧上下文，plain `git apply` 会在 `ru.ts:976` 失败，必须走既定流程 `git am --3way`；3-way 结果已核对（两个 i18n key 落在 `interactionCountdownElapsed` 之后，位置合理）。

**05-chat/021-run 态指示器与输入区间距收紧（2026-09-12，用户验收）**：把「正在思考」块与输入框之间 32px 的空白收到 16px，并收紧行内上下与工具卡片间距。
- `.streaming-indicator`：`padding: 4px` → `0 4px`；`gap: 8px` → `4px`（正在思考行 ↔ 思考详情/工具条）；新增 `margin-top: -6px`（吃掉上一条消息 `.virtual-row` 16px 行距中的 6px）。
- `LiveReasoningStatus.vue`：`.thinking-status` `min-height: 40px` → `32px`（行内上下留白 9 → 5px）；`.live-reasoning-status` `gap: 8px` → `4px`。
- `MessageList.vue` 的 `virtualListPadding`：新增 run 态分支 `"20px 20px 10px"`（列表底部 20 → 10，仅 run 期间；排队消息/浮动提问分支的 260/380/80 不变）。
- `ChatInput.vue` `.chat-input-area`：顶部 8 → 6px（桌面 `6px 20px 14px`、移动 `6px 12px 12px`，**全局生效**，非 run 态专属）。
- 结果（移动端、无思考内容）：文字↔上一条消息 ≈29 → 15px；「正在思考」行框↔输入框 32 → 16px；文字↔输入框 ≈41 → 21px。
- ⚠️ 群聊页输入框是另一个组件 `GroupChatInput.vue`，**未同步**（顶部仍 8px）；要统一需另开补丁。

**05-chat/022-去掉输入框底部语音按钮（2026-09-12，用户验收）**：
- `ChatInput.vue` 的 `.input-actions` 里删掉 `<VoiceDialogueControls />`（录音开关 + 浮层转录），底部工具栏只剩发送按钮。
- 连带清理（`tsconfig.app.json` 的 `noUnusedLocals: true` 会把残留直接报成编译错误，必须一起删）：`VoiceDialogueControls` 与 `useComposerVoiceInput`/`normalizeComposerVoiceTranscript` 的 import、`const voiceInput = ...`、`insertVoiceTranscriptIntoInput()`、以及唯一消费方随之消失的 `--voice-overlay-mobile-bottom-offset: 146px`（原供转录浮层在移动端定位）。
- `tests/e2e/voice-dialogue.spec.ts` 里那条测试就是点这个 `voice-record-toggle` → 已 `test.skip` 并注明原因（`playwright.yml` 只在 main/PR 跑，fork 的 CI 不受影响，但不留必挂测试）。组件本体保留：`GroupChatInput.vue` 仍在用，`tests/client/voice-dialogue-controls.test.ts` 单测照旧。
- **有意保留**：群聊输入框的语音按钮、设置下拉里的「实时语音模式 ◉」入口（仍可打开全屏 `RealtimeVoiceStage`）。

**0.7.19 重放（2026-09-11，上游 b09dafb23）**：77/77 全部落位（无空提交），**8 处冲突已回写**：
02-pwa/001（上游品牌 Ekko Studio 改写 index.html/manifest/test → 取上游品牌值 + 保留我方 PWA 增量）、
02-pwa/007（上游修改 logo-original.png vs 我方删除 → 上游全树无引用，接受删除；补丁重生成后内嵌上游新版 pre-image）、
02-pwa/010（color-scheme meta 与上游新 favicon 行重叠 → 保留双方）、
03-connection/007（chat.ts import-only 双侧合并）、
08-server/002（**上游重写 sessions 控制器**（分类分页 #2977 + filtered totals #2982）→ 保留上游分页/total 结构，仅重新植入 archivedOnly 过滤分支，`includeArchived` 交由 003 处理）、
08-server/003（**改为条件式** `includeArchived: archivedOnly ? true : false` —— store 层只有 `=== false` 才拼 `COALESCE(s.is_archived,0)=0`，不传 = 包含归档；默认列表显式 false 才不污染上游分页窗口与 total）、
11-socket-stall/001（chat-run.ts close()：上游 mobile-health 清理 + 我方 watchdog/backlog 清理都保留）、
11-socket-stall/002（客户端 chat.ts：上游 runtimeGeneration 守卫 + 我方心跳都保留）。
预演与验证记录：`/home/aries/hermes_workspace/hermes-studio-0.7.19-upgrade/`（构建全绿、相关单测 95/95、归档语义 3 条真实 SQLite 集成测试通过）。

**0.7.20 重放（2026-09-12，上游 v0.7.20 = 6e9e68717）**：82/82 全部落位（无空提交），**13 个补丁已回写**（2 处真冲突 + 11 处上下文漂移）：
- 硬冲突 **09-cleanup/002**（上游把推广域名改成 `apikey.fan`，我方整块删除 → 新 pre-image = `.fan` 版，语义仍是「推广一律去掉」）、
  硬冲突 **10-perf-p1/003**（`vite.config.ts`：上游新增 `cacheDir` 行与我方 `plugins` 行重叠 → **两侧都保留**，`plugins: [vue(), createLocaleMergePlugin()]`）。
- 上下文漂移（3-way 回落、`+/-` 行未变，回写为消除下次冲突）：02-pwa/011、03-connection/001、04-usage/001、04-usage/002、04-usage/003、04-usage/010、05-chat/001、05-chat/002、05-chat/003、05-chat/009、08-server/001。
- 本次上游特征：`bin/` 与 0.7.19 **逐字节一致**（无 0.7.19 那次 MCP 改名陷阱）、依赖仅新增运行时 `yaml`（已 bundle 进 `dist/server/index.js`）、新增一次性启动任务会把各 profile 的 `apikey.fun` 迁到 `apikey.fan`（本机无匹配 ⇒ 空转）、DSH 集成（未使用即无副作用）。
- 预演与验证记录：`/home/aries/hermes_workspace/hermes-studio-0.7.20-upgrade/`（构建 5/5 全绿、相关单测 96/96、上游新增用例 20/20、归档语义 3 条真实 SQLite 集成测试通过、官方 tarball 热替缺口 0 个功能文件）。

**0.7.21 重放（2026-09-13，上游 v0.7.21 = 8d964022d）**：82/82 全部落位，**零冲突、零空提交、零回写**（唯一 1 次三路回落 = 10-perf-p1/003，产出与存储补丁逐行一致 ⇒ 无需回写；逐补丁审 82/82 IDENTICAL）。
- 本次上游仅 2 提交（21 文件 / +166 −14）：Windows 下 DSH 配置运行时启动修复（#3026，改 `dsh/host.ts` + `management.ts`）+ 版本号与 changelog 提升（#3027）；12 个 locale 各 +2 条 `new_0_7_21_*`。
- `bin/`、`dist/ekko-skills`、`dist/skills` 与官方 tarball **逐字节一致**；本机不使用 DSH ⇒ 唯一可见变化 = changelog 两行。
- 验证记录：`/home/aries/hermes_workspace/hermes-studio-0.7.21-upgrade/`（`UPGRADE-ASSESSMENT.md` + `evidence-stage1/`：verify-am 树零差异、构建 rc=0、相关单测 121/121、全量 47 failed/624 passed（上一版 51/619）、CI `34727445348` build+deploy 双绿）。

**0.7.22 重放（2026-09-17，上游 v0.7.22 = b036cf244）**：82/82 全部落位（无空提交）+ **新增 1 补丁** `14-test-adapt/001`，3 处真冲突与 3 处历史遗留补齐全部回写：
- **05-chat/014**（多行思考块撞上游 #3052 agent logo 对 `LiveReasoningStatus.vue` 的重写 → **双侧保留**：我们的 `MarkdownRenderer` 多行渲染 + 贴底滚动 + 上游的 `agent` props/`withDefaults`/`isEkko`，并补上被 take-ours 丢掉后仍需要的 `computed` import）、
  **05-chat/020**（去 thinking 图标：上游新写的 `isEkko ? thinkingImage : agent.src` 与 `thinking-avatar--logo` 一并删除，最终 run 态无头像图标）、
  **04-usage/010**（tok/s 补丁撞同一文件 → props 双侧保留 `speed?` 与上游 `agent?`）。
- **历史遗留补齐**（预演期发现，0.7.1 模块化搬迁时漏改）：`04-usage/001/002` 的单测 import 仍指向 `packages/server/src/services/hermes/run-chat/*`（0.7.22 已不存在）→ 改为 `modules/studio/services/chat-run/*`，`04-usage/001` 里 run-chat-bridge 的动态 import 同步改；`04-usage/010` 给 `run-chat-bridge-final-context.test.ts` 补 `foldDecodeCallResult`/`settledRunSpeed` 两个 mock。
- **14-test-adapt/001**（新增）：上游 `tests/client/message-list-live-reasoning.test.ts` 断言的是 fork 之前的工具条与思考 ticker（完成的工具独立成行、live detail 元素跨轮复用）→ 适配为 fork 行为（按**用户轮**折叠进 ToolRunCard、ticker 在 tool 边界后卸载重建、strip 500ms 防闪烁需先 mount 空列表再注入消息）。
- 本次上游 17 提交 / 107 文件 / +3234 −292（terminal 移动端会话走 app relay、standalone task-plan MCP、coding-agents MCP 注入与 PATH 处理、DeepSeek reasoning 回放、grok 多行配置、LiveReasoningStatus agent logo…）。**package.json 仅 version 变化**（无需 npm ci）；
  ⚠️ 但 **`bin/ekko-studio-mcp.mjs` 有改动 ⇒ 部署不能只热替 dist，必须 `npm i -g hermes-web-ui@0.7.22`**（playbook §6）。
- 落地方式：预演树（worktree `--detach` 到上游 tip → 全量重放 → 解冲突 → 补齐 → 相关单测 103/103、目标套件 13/13）经 `cherry-pick` **原样**落到 custom（非 patches 路径树逐字节一致），避免二次解冲突引入偏差；补丁回写用 55 个重锚定（其中 49 个仅 `From`/`index`/`@@` 行号位移，6 个语义变更 = 上述 001/002/010/014/020 + 05-chat/004 import 上下文）。
- 验证记录：`/home/aries/hermes_workspace/hermes-studio-0.7.22-upgrade/`（预演遗留修复 diff、verify-am 结论、构建与单测输出）。

## 升级 SOP（上游新版本）

```bash
# 1. 同步 main
git fetch upstream --tags
git checkout main && git merge --ff-only upstream/main
git push escapea main

# 2. 重放补丁串（custom 重建）
git checkout -B custom main
# ⚠️ patches/ 只在 custom 分支存在：checkout -B 会覆盖掉 working tree 的 patches/
#   若丢失，从旧 custom tip 恢复：git checkout <旧custom-tip> -- patches/ 并 commit
git am --3way patches/*/*.patch
# 冲突：只解真正碰上游改动的补丁；上游已吸收某功能 → git am --skip 并从 patches/ 删除该文件

# 2.5 ⚠️ 冲突解决后必须回写补丁文件（2026-08-19 实测踩坑）
# 手工解决冲突 ≠ 补丁已更新！旧补丁文件仍是升级前版本，下次重放必冲突。
# 铁律：解完冲突 → git add && git am --continue 后，
#   git format-patch -1 <该补丁的commit> -o /tmp/xxx/ && cp /tmp/xxx/*.patch patches/<组>/<原文件名>.patch
# 然后 commit 回写（docs: sync 0XX patch with conflict-resolved commit）

# 3. 验证 + 部署（含可复现性验证，2026-08-19 新增，每次升级必做）
NODE_ENV= npm run build
# 临时分支从 main 重放补丁串，对比源码树必须 0 差异（否则某补丁文件没回写）：
git checkout -B verify-am main && git checkout custom -- patches/ && git commit -m "tmp"
git am --3way patches/*/*.patch && git diff verify-am custom --stat -- . ':(exclude)patches' ':(exclude)docs/openapi.json'
git checkout custom && git branch -D verify-am
git push --force-with-lease escapea custom   # CI → Build + CF Pages deploy
```

## 新增功能流程

```bash
git checkout -b feat/xxx main          # 短命开发分支（仅开发期）
# 开发 → 测试
git format-patch -1 -o patches/组/ feat/xxx   # 导出补丁
# 按依赖序重命名（若新功能依赖已有补丁，编号必须排在依赖之后）
git checkout custom && git am --3way patches/组/新补丁.patch
git add patches/ && git commit -m "docs: sync patches after adding feat/xxx"
NODE_ENV= npm run build && git push --force-with-lease escapea custom
```

**铁律**：任何 custom 上的源码修改，必须同时 `git format-patch -1` 回写 patches/ 并提交，否则视为未完成。

## 历史

- 2026-09-30 升级 0.7.25 → **v0.7.26**（main 07ccb17a4 → 200f0eec8；9 提交 / 272 文件 / +7791−2204；主题：**Studio 导航/头部/移动端布局统一 #3232**、用量成本记录 #3226、desktop 窗口控件、Agent Manager 图标）：
  93 补丁重放，**26 个补丁冲突**（含 18 处 modify/delete），53 个补丁按新上下文回写。冲突全部源于上游重构，解法一览：
  - **`04-usage/004|005|006|007|009`（.context-usage-row 搬家）**：上游把用量行从 `.input-wrapper` 内**移到外面**并重排成带边框的 composer 顶栏（`position: relative` / 100% 宽 / 上圆角 / glass）→ 保留上游位置与外框，把 fork 的会话用量 slot、context 百分比重新植进去；`.session-usage-corner` 随之废弃删除。
  - **`05-chat/003`（会话快速打开）**：上游把 `onMounted` 重写成 `disposed` 门控的重试循环 → 保留上游结构，把 `openPreferredSession` 预取插进循环的 `Promise.all`。
  - **`05-chat/005`（移动端抽屉）**：上游把 `.session-list` 从「浮起卡片（margin 10px + radius + shadow）」改成齐边（`margin: 0` / `border-inline-end`）并把移动端定位改回 `absolute` 0/0/0 → 保留齐边定位，保留 fork 的 `z-index: 1000` 与安全区 `padding-top`。
  - **`13-mobile-nav/001|002`**：上游给 App.vue 加 `app-box` 包裹 + nav rail，并把 `<button class="hamburger-btn">` 改成 `:aria-expanded` + logo.png → 取上游结构/属性，重新植入 fork 的 38px 顶栏几何（`$mobile-topbar-*`）、三横线图标与 `hamburger-btn--hidden`；ModelsView 的 ▦ 隐藏规则因上游删掉了该按钮而整体删除。
  - **`17/18`（群聊/工作流前端整体移除）**：上游重写了同样的样式块 → 用「取上游结构 + 程序化剥掉 `group-chat` / `workflow` 选择器行」解决（注意：**列表尾项被移除时要把 `{` 补回上一行**）；`WorkflowView.vue` / group-chat 组件与视图按 modify/delete 接受删除；11 个 locale 的 `workflow` 命名空间整块删除；`App.vue` 的 `isInviteOnlyPage`（来自被删的分享页）一并清除。
  - **`19-sidebar-history-toggle`**：上游的 `conversation-switch`（单聊/历史宫格）被 fork 的扁平按钮组取代 → 保留 fork 的历史按钮，宫格整块删除。
  - **`20-remove-avatars`**：上游给 PageSidebarFooter 加了 `ProfileAvatar` → 去头像时把已被上游删掉的 `useAppStore` 死 import 一起清掉。
  - **`22-theme-styles`**：上游**删掉 ThemeSwitch 的风格切换按钮**并把启动风格硬钉 `'ink'`（`useTheme.ts` + `index.html`）→ 保留 fork 的表驱动风格 + 下拉色卡，并把 `index.html` 首屏风格改回读 `localStorage.hermes_style`（否则刷新先闪 ink）；`main.ts` 的 `useTheme` import 随之删除。
  - **`10-perf-p1/004`（boot logo 单请求）**：上游把 boot 微光抽到共享 `logo-loading.css`（带 mask）→ 保留上游文件，改为在 `index.html` 只对 `.boot-fallback__logo-wrap::after` 关掉 mask（保持「冷启动只取一次 /logo.png」的原意，不影响 in-app `LogoLoading`）。
  - 依赖面：`package.json` / `package-lock.json` **仅 version 变化**、`bin/` 零改动 ⇒ 无需 `npm ci`；部署 = `npm i -g hermes-web-ui@0.7.26` + 热替 dist。
  - 可复现性：verify-am **0 差异**；备份 tag `backup/custom-pre-0.7.26`（= 6ccfe9b7e）。
  - **追加（Aries 2026-10-01 定稿）**：上游把用量行做成贴在输入框上的带边框分栏（视觉上像两行表格）→ 去边框/底色/圆角与`.dark` 底色，用量行回归**纯文字一行**（`padding: 0 11px 6px`，左右 11px 与输入框内文字同轴），输入框恢复完整圆角；`App.vue` 的「自定义背景」半透明组同步移除该行。改动并入 `patches/04-usage/009-composer-align.patch`（故该补丁现在同时含 `ChatInput.vue` 与 `App.vue`）；另有 6 个补丁因父 blob 与行号位移仅重生成头部，无内容变化。
  - **追加 2（Aries 2026-10-01 验收）**：手机端 ☰ 抽屉三项问题（入口失效/多余、会话列表上方大量留白、主题未覆盖）修完，落为 **新补丁组 `26-0.7.26-nav-chrome`**（001 导航外壳、002 主题层）。
    - 根因：上游 #3232 新写的 `StudioNavigationRail` / `MobileNavigationDrawer` 是按**上游功能全集**写的 —— rail 仍列群聊/工作流/设备互联（fork 已删，路由不存在 ⇒ 条目根本不渲染），首个条目的 `sidebar.singleChat` 文案键已被 fork 删除 ⇒ 渲染原文；抽屉自己加了一行 40px 关闭按钮并把**页面侧栏自带的关闭键全压掉**（`:deep(.session-close-btn){display:none}`）。
    - 实测（390×844）：面板顶部到首条会话 **165px → 118px**（40px 关闭行 + 12px 内边距 + 3px 分组头）；Aries 手机实拍另有一条 **≈99px** 的空白带 = 该 WebView 壳报的 `env(safe-area-inset-top)`（Chrome 侧为 0，本地测不出）⇒ 统一收进 `--drawer-top-inset`，Aries 定为 **0**。
    - 主题层：`style-layers.scss` 只画 `.app-layout/.chat-main/.session-list`，新组件没人管 ⇒ 加一段「导航外壳」规则，用各风格自己的 `--accent-primary-rgb` 画细边 + 光晕；并把抽屉加进 `App.vue` 的 `.app-shell--custom-background` 玻璃组（注意：传送到抽屉里的 `.session-list` 不再匹配 `.chat-panel > .session-list`，需单列 `.studio-mobile-navigation__content > .session-list`）。
    - 遗留（未适配）：上游新增的 `tests/e2e/navigation-rail.spec.ts` 仍按上游入口清单断言（含 Workflow/群聊/设备互联）；custom 的 CI 只跑 build+deploy、不跑 e2e，故不影响流水线，待需要时并进 17/18 的测试补丁。
  - **追加 3（Aries 2026-10-01 定稿）**：手机抽屉**一级菜单合并**，落为 **新补丁组 `27-0.7.26-mobile-nav-merge`**（001 带文字 rail + 应用级入口 + 文字开关、002 去重）。
    - 动机（Aries）：抽屉已经是全高侧栏，日志~设置这 9 个应用级目的地却要「先进设置页再开抽屉」才看得到（多点一次），而一级只有 4 项、很空。
    - 解法：`StudioNavigationRail` 加两个可选 prop —— `labeled`（图标+文字行、列宽 140px）与 `withAppEntries`（AppSidebar 的同一批 9 项，含 `requiresSuperAdmin`/桌面壳同款守卫），左下角三条横线＝**文字开关**（localStorage `hermes_mobile_drawer_labels` 持久；抽屉按同一份常量自行设定 NDrawer 宽度）。设置成为列表里的一行，故底部图标改为开关。
    - 去重：日志/用量/性能/技能用量/版本预览/主题/配置/设置 这 8 个路由的页面侧栏**本来就是** AppSidebar ⇒ 抽屉面板不再打开（否则同一份 9 项出现两次）；配置类侧栏路由（journey/skills/memory/channels/mcp/plugins/jobs/kanban/petdex）不受影响。
    - 桌面端零改动：App.vue 渲染 rail 时**不传**这两个 prop，实测 1280×800 仍 64px / 4 项 / 无文字 / 底部是设置链接。
    - 实测（390×844）：展开 rail 140px + 面板 226px、收起 64px + 302px、抽屉 366px、13 项全在一级；从抽屉点应用页会**自动关闭**抽屉。
    - 已知小瑕疵：英文界面下 `Agent Manager` / `Version Preview` 会截断（中文完整）；侧栏图文基线未验证过英文排版，需要时把 140px 再放宽。
  - **追加 4（Aries 2026-10-02 验收）**：手机端四条侧边栏/抽屉打磨（新建会话入口、抽屉宽度与关闭、抽屉玻璃、图标栏尺寸），落为 **新补丁组 `28-sidebar-drawer-ux`**（001-004，一条一补丁）。要点与像素实测见上文该组段落；verify-am **101/101 落位、零冲突、0 差异**。
- 2026-08-25 升级 v0.6.46 → v0.6.47（main 8dc6d193 = tag v0.6.47 + #2730 run-scoped-tool-calls 等，14+ PR：社交消息推送工作区 / 图片模型可配置 / App resume 缓存 / Codex&Claude system 合并 / 上传上限 HERMES_MAX_UPLOAD_SIZE / GLM-5.3 回滚等）：
  62 补丁重放冲突 2 个 + 构建期修复 1 个。
  - 007-conn-upload-405：chat.ts import 行冲突，HEAD 侧上游已加 `setSessionPushEnabled`、删 `fetchWorkspaceRunChangesForSession`（0.6.47 paginated/resume 响应自带 workspaceRunChanges）→ 取并集保留上游新增，删已无调用的 fetch import。
  - 001-chat-session-fast-path：上游 resume 回调已内联 `setWorkspaceRunChanges`（2006 行）并删了 `loadWorkspaceRunChangesForSession` 函数 → fast-first 逻辑保留，删补丁末尾对已删函数的调用。
  - **构建期修复新增 10-perf-p1/005-locale-sibling-imports**：0.6.47 locale 文件（zh/en/…）新增 `import { socialMessagesX } from '../social-messages'`，vite.config.ts 的 build-time locale merge 用 `new Function('require')` 相对 vite.config.ts 解析失败 → 自研 loadTsModuleAsCjs（相对 locales 目录解析 + esbuild 转译 .ts 依赖）。**教训：升级后 locale 文件新增同级 import 时，build-time merge 的 require 基准必须从 locale 目录解析**。
  后端接口零破坏（新增 /api/social-messages/*、POST /sessions/:id/push-enabled、app.resume/app.resumed socket 事件，均为增量；hstudio-mobile 无需改动）。可复现性验证 verify-am 0 差异。备份 tag：`backup/pre-upgrade-20260825-custom-0647`。
- 2026-08-23 补回 0.6.45 升级丢失的 sessions 行为：上游重构 sessions 控制器丢 `GET /sessions` archived 查询参数（?archived=1 只返回活跃会话，hstudio-mobile 归档页坏）→ `fix(server): support archived=1 on GET /sessions`（patches/08-server/002-archived-query.patch）。**教训：升级后必查 sessions 控制器/DB 层的查询参数与过滤语义，不只查接口结构**（0.6.45 接口结构零破坏但行为变了）
- 2026-08-22 升级 0.6.44 → v0.6.45（f829a2ce #2665，16 PR：工具轨迹稳定化/ToolRunCard、备用 Provider 链管理、Studio 下载中心、群聊草稿、Pi 续接等）：
  61 补丁重放仅 0047（live-reasoning-scroll）与 0061（tool-strip anti-flicker）冲突。
  0047 = 上游 #2662 已把 LiveReasoningStatus 改为单行水平自动滚动（scrollReasoningToLatest，语义已吸收）→ **skip 并从补丁串删除**（05-chat/012-live-reasoning-scroll.patch）。
  0061 = 上游 #2662 给 .tool-calls-panel 加固定 26px/overflow hidden（会锁死折叠条展开）→ 冲突解决保留补丁折叠结构、仅取上游 max-width:100%，已回写 patches/12-tool-strip/001-tool-strip-anti-flicker.patch。
  后端接口零破坏（新增 run_marker 字段 + /api/hermes/config/fallback-providers，hstudio-mobile 无需改动）。
  备份 tag：`backup/pre-upgrade-20260822-custom-0645`。
- 2026-08-19 升级 0.6.44 → c246ba64（#2622 删旧官网 + 4 chat 修复 + upload 413 修复 + sessions-db 过滤重构）：
  60 补丁重放仅 0040 冲突（上游 #2606 把折叠组状态抽成 useCollapsedProviderGroups composable；
  解法=保留 NSelect 双下拉模板、删折叠死代码，补丁语义不变）。后端接口签名零变化（hstudio-mobile 无需改动）。
  备份 tag：`backup/pre-upgrade-20260819-custom-0644`。
- 2026-08-17 迁移：21 活跃分支（feat/feature/fix/*）+ dev/main → main/custom + patches/ + 32 archive 分支
- 备份：tag `backup/pre-migration-20260817-dev`（旧 dev/main）、`backup/pre-upgrade-20260817`（迁移后首次升级前 custom）；全部 backup/* tag 已推远程
- 旧分支全部保留在 `archive/*`（含 archive/dev-main），可随时对比/回滚
