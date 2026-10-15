# EscapeA/hermes-studio 补丁串（Patch Stack）管理

本目录是 fork 的全部自定义内容的**权威来源**。分支模型：

```
main        = 纯上游同步（不含任何自定义）
custom      = main + patches/*.patch 线性重放（旧集成分支，2026-10-14 前的 128 条补丁串）
custom-next = main + patches/*.patch 线性重放（新集成分支，本轮重整后的 75 条）
```

⚠️ **本轮（2026-10-14）以 `custom-next` 为唯一集成分支**：`custom` 保留作历史对照，不再更新。

## 分组总览（22 组 / 80 条）

| 组 | 条数 | 内容 |
|---|---|---|
| 01-ci | 3 | CI 去单测门禁、push 触发分支 = custom-next、getBaseUrlValue mock |
| 02-server | 2 | GET /sessions `archived=1`（过滤分支 + 数据源放行，成对） |
| 03-mobile-input | 1 | 移动端 Enter 换行而非发送 |
| 04-usage | 11 | API prompt_tokens 接入、完整 in=、resume 轮询兜底、去进度条、会话累计、左上排版、去 cache-write、同排对齐、速率解码、当前/平均双读数（含测试） |
| 05-chat | 16 | 隐藏未分类组、clarify 单列、多行流式思考、工具卡锚定、反闪烁工具条（4 条）、工具卡按用户轮、收紧间距、去语音按钮、移动端模型卡片、live-reasoning 套件适配、rebase 结构修正、套件适配 |
| 06-remove | 6 | 群聊整体移除、工作流整体移除、头像整体移除（各含测试适配） |
| 07-sidebar | 2 | 页面侧栏扁平化 + 历史切换（含测试） |
| 08-agent-entry | 1 | 侧栏 Agent 管理可配置直达 |
| 09-nav | 6 | 抽屉去自有关闭行+幽灵入口、0.7.26 导航外壳适配/材质、抽屉一级菜单合并、磨砂抽屉、图标栏尺寸 |
| 10-reconnect | 2 | socket 重连对账 run 态（含测试） |
| 11-perf | 4 | highlight 按需注册、i18n 构建期合并、启动光晕单请求、locale 同级 import 解析 |
| 12-adapt | 6 | 0.7.25 / 0.7.28 / 0.7.29 / 0.7.34 套件与 locale 适配 |
| 13-memory | 1 | subagentStreams LRU 上限 |
| 14-cleanup | 2 | 去 apikey.fun 推广、去侧栏设备互联入口 |
| 15-userwait | 2 | 压缩 timer per-session、parseThinking 缓存 |
| 16-audit | 3 | 默认标签 Hermes、稳定 live key、命名对齐 |
| 17-verify | 4 | 补丁串校验脚本 + CI 接入 + ORDER 支持 + 未跟踪落盘 |
| 18-security | 3 | 头像 mime 白名单、meta.file 路径守卫、错误响应脱敏 |
| 19-blueprint | 1 | 蓝图风格（淡冷纸面 + 墨蓝主色 + 16/80px 制图网格；暗色为深海军蓝 + 天蓝），插在上游 ink/comic 旁的最小增量 |
| 20-run-indicator | 1 | run 指示器窄屏排版（读数容器查询 440px，空间不足时放下「平均」避免孤儿行）+ 中文读数改名「当前速度」 |
| 21-session-live-dot | 1 | 会话列表「进行中」小圆点（补 06-remove 删头像后丢失的 streaming 指示，含测试与 11 locale 文案） |
| 22-0.7.36-adapt | 1 | harness ui-theme baseline 归属重排（上游 0.7.36 新增检查器 × fork 删页/自有组件） |
| 04-usage（追加） | 1 | 压缩触发口径改锚 provider prompt_tokens（本地 cl100k 对 wire 高估约 1.7×，长会话在 ~54% 占用就被判超阈值） |

## ORDER 的语义

`ORDER` 是**唯一权威顺序**（`{序号} {组}/{文件名}`）。组目录只做归类，**跨组的依赖顺序由 ORDER 决定**：
例如 05-chat 的 `099-rebase-onto-upstream-0.7.35-structures` 必须排在最后，因为它修正了前面若干补丁在
上游 0.7.35 结构上的落点。

重放：

```bash
git checkout -B custom-next main
# patches/ 由该分支自身跟踪，重放前先把它从工作区取出（避免 checkout 时被删）
git am patches/*/*.patch       # 顺序由 ORDER 定义，实际用：
while read n p; do git am --3way "patches/$p"; done < patches/ORDER
```

## 本轮重整纪要（2026-10-14）

- 原 128 条 → **保留 75 / 丢弃 53**，按 Aries 逐条确认。
- 丢弃主因：PWA/CF Pages 线（家宽 tailnet 良好、http 装不了 PWA）、WebView color-scheme 线、
  fast-first 秒开线、模型双下拉（上游 ModelCascader 已取代）、上游已吸收的修补（附件守卫、agent 部署落点、
  run-usage-card 费用格）、以及与上游互冲的表驱动风格泛化。
- 丢弃项对应的 i18n 键/组件已同步清理（tr locale 清键等），保证 `i18n-coverage` 逐键比对通过。
- 合并：`08-server/002+003`、`23-run-speed-latest/001+002`、`35-patch-stack-verify/001..004`、
  `41-audit-l-cleanups/001..003` 等按「源码+测试同条」原则合并。
- **已补回**：原 `22-theme-styles`（表驱动 + neon/aurora/blueprint）不采用；蓝图风格已按「最小增量插在上游
  ink/comic 旁」重写为 `19-blueprint/001`（第 2 轮追加），neon/aurora/tech 升级与表驱动泛化仍未采纳。原 `13-mobile-nav`（移动端顶栏变量体系）按决定不重做，故上游顶栏现状保留。
- 验证：`git am` 纯重放 **75/75 零冲突**，与 `custom-next` 树**逐字节一致**；`npm run build` 通过；
  客户端单测对照旧 custom 分支**无新增失败**。

## 增量：09-nav/001 重写（2026-10-15）

- 原 `001-fix-mobile-nav-adapt-the-0-7-26-nav-chrome-to-th` 整体重写为
  `001-fix-mobile-nav-drop-the-drawer-close-row-and-ghost-entries`：Aries 决定丢弃其中的
  抽屉顶部 inset 覆写（`--drawer-top-inset: 0px`）。该覆写当年为治 K60 壳双重 inset 死带，
  但 web-to-app 壳切到「全屏 + 状态栏常驻 + 全透明」后窗口真 edge-to-edge、壳不再预留顶部
  padding，`env(safe-area-inset-top)` 成为唯一正确 inset，覆写反而把抽屉第一行
  （新建会话/搜索）埋进状态栏带无法点击。上游 inset 两行原样恢复。
- 新 001 只保留三项非 inset delta：抽屉自有关闭行（按钮 + 死 CSS）移除、
  StudioNavigationRail 幽灵入口（group-chat/workflow/connections、singleChat→chat）清理、
  ChatPanel 移动端 page-sidebar 收紧。
- `003`/`005` 的 pre-image 原本基于旧 001 输出；已用 --3way 全量重放验证新基线下
  **79/79 零冲突**且重放树与源码树逐字节一致（`scripts/verify-patch-stack.sh`）。
- 教训：**动补丁串中间任意一条，必须重放全量 ORDER**——孤立重放 003/004 会因缺少前置
  补丁的中间态而假冲突（本次 004 在 main+001+003 上必败，全量序下才成立）。

## 修改补丁串的约定

- **新增一个补丁组**：目录名 `NN-<slug>`，序号取现有末组 +1；同时更新本文件的分组总览与 ORDER。
- **重写/重生成已上线的补丁**：用 `git format-patch -1 <sha>` 从 custom-next 上的对应提交导出，替换文件后
  **必须**重跑校验（见 `scripts/verify-patch-stack.sh`），确认 `git am` 全量重放零冲突且树等效。
- **改动 ORDER**：任何重排都要重跑一次全量 `git am` 干净重放；按主题重排会破坏依赖顺序（本轮踩过：
  04-usage 的速率补丁需要 `04-usage/005` 落下的中间状态）。
