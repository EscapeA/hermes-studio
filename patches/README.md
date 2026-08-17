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
| 02-pwa | PWA（离线、SW 缓存、SWR、资源瘦身、_headers） | 001-008 |
| 03-connection | 连接设置/自定义后端 URL | 001-011 |
| 04-usage | 用量显示（prompt_tokens、百分比、session 累计、composer 对齐） | 001-009 |
| 05-chat | Chat 核心（fast-path、avatar、双下拉、identity、滚动） | 001-013 |
| 06-mobile-input | 移动端输入（Enter 换行、模型下拉不弹键盘） | 001-002 |
| 07-workflow | Workflow 移动端布局 + i18n | 001-002 |
| 08-server | server 静态缓存头 | 001 |
| 09-cleanup | locale 冲突标记清理 | 001 |
| 10-perf-p1 | P1 性能（highlight core、comic 字体 woff2、locale 构建期合并、logo 单请求） | 001-004 |

共 **57 个补丁**（含 01-ci/006 的 custom 分支切换）。

## 升级 SOP（上游新版本）

```bash
# 1. 同步 main
git fetch upstream --tags
git checkout main && git merge --ff-only upstream/main
git push escapea main

# 2. 重放补丁串（custom 重建）
git checkout -B custom main
git am --3way patches/*/*.patch
# 冲突：只解真正碰上游改动的补丁；上游已吸收某功能 → git am --skip 并从 patches/ 删除该文件

# 3. 验证 + 部署
NODE_ENV= npm run build
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

- 2026-08-17 迁移：21 活跃分支（feat/feature/fix/*）+ dev/main → main/custom + patches/ + 32 archive 分支
- 备份：tag `backup/pre-migration-20260817-dev`（旧 dev/main）、`backup/pre-upgrade-20260817`（迁移后首次升级前 custom）；全部 backup/* tag 已推远程
- 旧分支全部保留在 `archive/*`（含 archive/dev-main），可随时对比/回滚
