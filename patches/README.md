# EscapeA/hermes-studio 补丁串（Patch Stack）管理

本目录是 fork 的全部自定义内容的**权威来源**。分支模型：

```
main        = 纯上游同步（不含任何自定义）
custom      = main + patches/*.patch 线性重放（旧集成分支，2026-10-14 前的 128 条补丁串）
custom-next = main + patches/*.patch 线性重放（当前唯一集成分支）
```

⚠️ **以 `custom-next` 为唯一集成分支**：`custom` 保留作历史对照，不再更新。

> **0.8.12 升级（2026-11-03）**：上游 #3645 一次性删掉整个旧测试树（1105 个文件，`tests/` 只剩
> `README.md` 与 `e2e/README.md`）并简化 CI（`vitest.config.ts` 加 `passWithNoTests`,
> `test:e2e` 改 `--pass-with-no-tests`, 删 `harness:memory` / `test:pi-rpc-real` / `test:workflow-live`）。
> 因此补丁串做了「去测试化」：**退役 13 条 test-only 补丁**，并把其余补丁里的 `tests/**`
> 文件段剥掉 ⇒ **25 组 / 67 条**。`scripts/verify-patch-stack.sh` 保留（它不依赖测试树）。
> 上游删测试后 `harness:check` 也不再要求 `tests/client|server|e2e` 目录存在。

## 分组总览（25 组 / 67 条）

| 组 | 条数 | 内容 |
|---|---|---|
| 01-ci | 1 | push 触发分支 = custom-next（「去单测门禁」已由上游 #3645 吸收 ⇒ 退役） |
| 02-server | 2 | GET /sessions `archived=1`（过滤分支 + 数据源放行，成对） |
| 03-mobile-input | 1 | 移动端 Enter 换行而非发送 |
| 04-usage | 11 | API prompt_tokens 接入、完整 in=、resume 轮询兜底、去进度条、会话累计、左上排版、去 cache-write、同排对齐、速率解码、当前/平均双读数 |
| 05-chat | 13 | 隐藏未分类组、clarify 单列、多行流式思考、工具卡锚定、反闪烁工具条（4 条）、工具卡按用户轮、收紧间距、去语音按钮、移动端模型卡片 |
| 06-remove | 2 | 群聊整体移除、工作流整体移除；头像移除已于 0.8.0 退役 |
| 07-sidebar | 1 | 页面侧栏扁平化 + 历史切换 |
| 08-agent-entry | 1 | 侧栏 Agent 管理可配置直达 |
| 09-nav | 6 | 抽屉去自有关闭行+幽灵入口、0.7.26 导航外壳适配/材质、抽屉一级菜单合并、磨砂抽屉、图标栏尺寸 |
| 10-reconnect | 1 | socket 重连对账 run 态 |
| 11-perf | 4 | highlight 按需注册、i18n 构建期合并、启动光晕单请求、locale 同级 import 解析 |
| 12-adapt | 2 | 0.7.38 ProviderImportModal 改用 models.profile；tr locale 清键 |
| 13-memory | 1 | subagentStreams LRU 上限 |
| 14-cleanup | 2 | 去 apikey.fun 推广、去侧栏设备互联入口 |
| 15-userwait | 2 | 压缩 timer per-session、parseThinking 缓存 |
| 16-audit | 2 | 默认标签 Hermes、命名对齐（cacheHitRatePercent） |
| 17-verify | 5 | 补丁串校验脚本 + CI 接入 + ORDER 支持 + 未跟踪落盘 + 指向 custom-next |
| 18-security | 3 | 头像 mime 白名单、meta.file 路径守卫、错误响应脱敏 |
| 19-blueprint | 1 | 蓝图风格（淡冷纸面 + 墨蓝主色 + 16/80px 制图网格；暗色为深海军蓝 + 天蓝），插在上游 ink/comic 旁的最小增量 |
| 20-run-indicator | 1 | run 指示器窄屏排版（读数容器查询 440px，空间不足时放下「平均」避免孤儿行）+ 中文读数改名「当前速度」 |
| 22-0.7.36-adapt | 1 | harness ui-theme baseline 归属重排（上游 0.7.36 新增检查器 × fork 删页/自有组件） |
| 23-theme-contrast | 1 | 「正在思考」渐隐带与会话 live 点改走调色板 token + 思考头像内缩 |
| 24-drawer-safe-top | 1 | 抽屉顶栏让开状态栏（`NDrawer` 是 body 级 portal，不吃 `env(safe-area-inset-top)`） |
| 26-sidebar-recent-only | 1 | 会话侧栏拍平成「置顶 + 最近」两组；「最近」分页加载更多；分类标签 `max-width` 放开 |
| 27-identity-cleanup | 1 | 去掉会话界面的身份噪音：列表副标题 profile 名与头像行、气泡作者行（`hideAuthor`），Person 视图仍保留身份行 |

## ORDER 的语义

`ORDER` 是**唯一权威顺序**（`{序号} {组}/{文件名}`）。组目录只做归类，**跨组的依赖顺序由 ORDER 决定**。

重放：

```bash
git checkout -B custom-next main
git am patches/*/*.patch       # 顺序由 ORDER 定义，实际用：
while read n p; do git am --3way "patches/$p"; done < patches/ORDER
```

## 增量：0.8.12 升级（2026-11-03）

- 上游 0.8.11 → 0.8.12：**20 提交 / 1234 文件 / +2128 −266218**，全线性（first-parent = 20）。
  体量几乎全部来自 #3645 的「清空旧测试并精简 CI」（1105 个 `tests/**` 删除）。
- 依赖：`package.json` / `package-lock.json` 只有 version 串（0.8.11→0.8.12）与脚本删除，
  **dependencies/devDependencies 零增删** ⇒ 不需 `npm ci`。
- 补丁串处置：
  - **退役 13 条 test-only 补丁**（`01-ci/002`、`05-chat/013`、`06-remove/002`+`004`、
    `07-sidebar/002`、`04-usage/011`、`12-adapt/001`+`002`+`003`+`004`+`006`+`008`、`10-reconnect/002`），
    它们的全部改动都在被上游删掉的测试文件里。
  - **`01-ci/001`（去单测门禁）被上游吸收**：新版 `build.yml` 已无 `test:coverage` 步骤 ⇒ 退役。
  - 其余 67 条剥掉 `tests/**` 文件段后重放：**8 处真实冲突**，其余 59 条零冲突。
- 冲突与解法：
  1. `14-cleanup/001`（去 apikey.fun 推广）：上游本版给 apiRelay 加了**双十一活动**（campaign 文案 /
     `RelayCampaignBadge` 组件 / `aria-description`）⇒ 13 个 locale 与两个 nav 组件都是
     「fork 整块删除 vs 上游在块内加行」。解法 = 取补丁侧（整块删除），
     `ApiRelayView.vue` 走 `deleted file mode` 判据 `git rm`。
     ⚠️ 连带：`PageSidebarNav.vue` / `StudioNavigationRail.vue` 里上游新增的
     `import RelayCampaignBadge` 变成未使用 ⇒ `vue-tsc` 报 `TS6133`，必须一并删掉（已 fixup 进该补丁）。
  2. `22-0.7.36-adapt/001`（ui-theme baseline 归属重排）：上游 baseline 里 `GroupChatLinkView.vue`
     的 5 条键随群聊移除一起删（取补丁侧）。
  3. `27-identity-cleanup/001`：两条**并集**语义 ——
     `SessionListItem` 的 props 取「上游新增 `showTime`」+「fork 的 `showAgentAvatar`」，
     defaults 同理（只保留 `showTime: true`）；`PersonView` 的 `SessionListItem` 传参取
     `single-line show-agent-avatar :show-time="false"`（fork 身份行 + 上游时间开关）。
- 验证：`git am` 重放 **67/67 零冲突**、重放树与集成分支**逐字节一致**
  （独立 worktree 从 `upstream/main` 重放比对）、`npm run build` 通过、`harness:check` 通过。
- 部署：`package.json` 仅 version ⇒ **纯 dist 热替**（不需 `npm i -g`），未重启服务。

## 修改补丁串的约定

- **新增一个补丁组**：目录名 `NN-<slug>`，序号取现有末组 +1；同时更新本文件的分组总览与 ORDER。
- **重写/重生成已上线的补丁**：用 `git format-patch -1 <sha>` 从 custom-next 上的对应提交导出，替换文件后
  **必须**重跑校验（见 `scripts/verify-patch-stack.sh`），确认 `git am` 全量重放零冲突且树等效。
- **改动 ORDER**：任何重排都要重跑一次全量 `git am` 干净重放；按主题重排会破坏依赖顺序（踩过：
  04-usage 的速率补丁需要 `04-usage/005` 落下的中间状态）。
- **上游删测试树这类变更**：不要逐条去「修」test-adapt 补丁，直接把它们退役 + 剥掉其余补丁的
  `tests/**` 段；测试本身已不存在，保留补丁只会让 `git am` 永久停在 modify/delete 上。
