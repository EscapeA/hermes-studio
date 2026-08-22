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
| 04-usage | 用量显示（prompt_tokens、百分比、session 累计、composer 对齐） | 001-009 |
| 05-chat | Chat 核心（fast-path、avatar、双下拉、identity、滚动） | 001-013 |
| 06-mobile-input | 移动端输入（Enter 换行、模型下拉不弹键盘） | 001-002 |
| 07-workflow | Workflow 移动端布局 + i18n | 001-002 |
| 08-server | server 静态缓存头 | 001 |
| 09-cleanup | locale 冲突标记清理 | 001 |
| 10-perf-p1 | P1 性能（highlight core、comic 字体 woff2、locale 构建期合并、logo 单请求） | 001-004 |
| 11-socket-stall | socket 卡死防护（服务端 backlog 检测断连 + 前端 REST 兜底刷新） | 001-002 |
| 12-tool-strip | 工具面板防闪烁（500ms 延迟显示）+ 折叠单行（正在调用 N 个工具） | 001 |

共 **60 个补丁**（含 01-ci/006 的 custom 分支切换）。

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
