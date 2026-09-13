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
| 03-connection | 连接设置/自定义后端 URL | 001-011 |
| 04-usage | 用量显示（prompt_tokens、百分比、session 累计、composer 对齐、运行中实时解码 tok/s） | 001-010 |
| 05-chat | Chat 核心（fast-path、avatar、双下拉、identity、滚动、聊天身份开关、用户气泡蓝色、clarify 折叠收起、工具卡按轮分组、去「正在思考」gif 图标、run 态指示器与输入区间距收紧、去输入框语音按钮） | 001-022 |
| 06-mobile-input | 移动端输入（Enter 换行、模型下拉不弹键盘） | 001-002 |
| 07-workflow | Workflow 移动端布局 + i18n | 001-002 |
| 08-server | server 静态缓存头 + GET /sessions archived=1 恢复 | 001-002 |
| 09-cleanup | locale 冲突标记清理 + 移除 apikey.fun 推广（侧边栏 apiRelay 按钮、FUN_LINK_MAP 提示、apiRelay locale 键） | 001-002 |
| 10-perf-p1 | P1 性能（highlight core、comic 字体 woff2、locale 构建期合并、logo 单请求） | 001-004 |
| 11-socket-stall | socket 卡死防护（服务端 backlog 检测断连 + 前端 REST 兜底刷新） | 001-002 |
| 12-tool-strip | 工具面板防闪烁（500ms 延迟显示）+ 折叠单行（正在调用 N 个工具）+ 运行中工具行展开详情 + toggle 与列表上下堆叠 + 展开详情解除高度限制 | 001-004 |
| 13-mobile-nav | 移动端顶栏统一 38px（变量派生几何 + ☰ 与内容同轴）+ ☰ 由品牌图改为三条横线图标 + 去掉与 ☰ 重复的四宫格 ▦（Models/Workflow） | 001 |

共 **82 个补丁**（含 01-ci/006 的 custom 分支切换；0.7.1 升级新增 10-perf-p1/005、05-chat/016-聊天身份开关、05-chat/017-用户气泡浅蓝；0.7.17 后新增 05-chat/018-clarify 折叠收起、05-chat/019-工具卡按轮分组、12-tool-strip/002-运行中工具行展开详情、12-tool-strip/003-toggle 与列表上下堆叠、12-tool-strip/004-展开详情解除高度限制、09-cleanup/002-移除 apikey.fun 推广、08-server/003-归档数据源放行；0.7.18 重放 77/77 成功，3 处冲突已回写：05-chat/004、05-chat/005、11-socket-stall/001）。

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
