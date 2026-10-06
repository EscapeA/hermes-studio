#!/usr/bin/env bash
# verify-patch-stack.sh — hermes-studio fork 补丁串新鲜度机器校验
#
# 用途（对应 patches/README.md 的铁律与 §348-353 可复现性验证）：
#   custom = main + patches/*.patch 线性重放。任何 custom 上的源码修改若忘记
#   `git format-patch -1` 回写 patches/，重放树就会和 custom 源码树不一致。
#   本脚本在隔离临时引用上把补丁串重放到 main，再与 custom 做源码树比对，
#   有差异即非零退出（失败），从而在 CI / 手工预检时暴露「漏回写」。
#
# 用法：
#   scripts/verify-patch-stack.sh            # 校验当前 custom 相对 main
#   BASE_REF=main STACK_REF=custom scripts/verify-patch-stack.sh   # 显式指定
#
# 安全：全程只用临时引用（refs/verify-patch-stack-*）与 git 只读比对，
#       不切换当前分支、不改工作区、不 push。异常退出也会清理临时引用。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BASE_REF="${BASE_REF:-main}"          # 上游同步基线（纯 upstream/main）
STACK_REF="${STACK_REF:-custom}"      # 补丁串部署/集成分支
VERIFY_TAG="refs/verify-patch-stack-base"  # 临时引用前缀
WORK_BRANCH="refs/verify-patch-stack-work"

log()  { printf '[verify-patch-stack] %s\n' "$*"; }
fail() { printf '[verify-patch-stack] ERROR: %s\n' "$*" >&2; exit 1; }

cleanup() {
  # 确保没有遗留 git-am 状态、临时引用与 worktree 注册
  git -C "$WT_DIR" am --abort >/dev/null 2>&1 || true
  git worktree remove --force "$WT_DIR" >/dev/null 2>&1 || true
  git update-ref -d "$WORK_BRANCH" >/dev/null 2>&1 || true
  git update-ref -d "$VERIFY_TAG"  >/dev/null 2>&1 || true
}
trap cleanup EXIT
WT_DIR=""  # cleanup 引用前占位，避免 set -u 误报

# --- 前置检查 -------------------------------------------------------------
git rev-parse --verify --quiet "$BASE_REF^{commit}"  >/dev/null || fail "基线引用不存在: $BASE_REF"
git rev-parse --verify --quiet "$STACK_REF^{commit}" >/dev/null || fail "补丁分支不存在: $STACK_REF"

# patches/ 只存在于 custom 分支；基线(main)上没有。需要从 custom 取出补丁清单。
if ! git cat-file -e "$STACK_REF:patches" 2>/dev/null; then
  fail "$STACK_REF 上没有 patches/ 目录（补丁串应只存在于该分支）"
fi

mapfile -t PATCHES < <(git ls-tree -r --name-only "$STACK_REF" -- patches \
  | grep -E '^patches/[^/]+/[^/]+\.patch$' | LC_ALL=C sort)

[ "${#PATCHES[@]}" -gt 0 ] || fail "在 $STACK_REF 的 patches/ 下没有找到任何 *.patch"

log "基线 $BASE_REF = $(git rev-parse --short "$BASE_REF")"
log "补丁分支 $STACK_REF = $(git rev-parse --short "$STACK_REF")"
log "待重放补丁数: ${#PATCHES[@]}"

# --- 构造重放工作树 -------------------------------------------------------
# 1) 基线提交
BASE_SHA="$(git rev-parse "$BASE_REF")"
git update-ref "$WORK_BRANCH" "$BASE_SHA"

# 2) 把 custom 的 patches/ 提交成一个临时 commit 叠在基线上，使 git am 能读到补丁文件。
#    用临时 index 不碰工作区。
TMP_INDEX="$(mktemp -u)"
trap 'rm -f "$TMP_INDEX"; cleanup' EXIT
GIT_INDEX_FILE="$TMP_INDEX" git read-tree "$BASE_SHA"
# 从 custom 把 patches/ 全量读进 index
PATCH_TREE="$(git rev-parse "$STACK_REF:patches")"
GIT_INDEX_FILE="$TMP_INDEX" git read-tree --prefix=patches/ "$PATCH_TREE"
TMP_TREE="$(GIT_INDEX_FILE="$TMP_INDEX" git write-tree)"
TMP_COMMIT="$(git commit-tree "$TMP_TREE" -p "$BASE_SHA" -m "tmp: carry patches for verification")"
git update-ref "$WORK_BRANCH" "$TMP_COMMIT"

# --- 在临时引用上重放 ------------------------------------------------------
# git am 需要 checkout；用 --git-dir/--work-tree 指向一个隔离 worktree，避免动当前工作区。
WT_DIR="$(mktemp -d)"
trap 'rm -rf "$WT_DIR"; rm -f "$TMP_INDEX"; cleanup' EXIT
git worktree add --detach "$WT_DIR" "$WORK_BRANCH" >/dev/null 2>&1

pushd "$WT_DIR" >/dev/null
# 逐补丁重放（沿用 README 的 --3way）。补丁路径相对 worktree 根（patches/ 已随临时 commit 落盘）。
AM_LOG="$(mktemp)"
if ! git am --3way "${PATCHES[@]}" >"$AM_LOG" 2>&1; then
  CONFLICTED="$(git am --show-current-patch 2>/dev/null || echo '?')"
  tail -15 "$AM_LOG" >&2 || true
  git am --abort >/dev/null 2>&1 || true
  popd >/dev/null
  rm -f "$AM_LOG"
  fail "补丁重放冲突/失败：$CONFLICTED（请先在 custom 解决并回写补丁，见 patches/README §342）"
fi
rm -f "$AM_LOG"
popd >/dev/null

# am 在 --detach worktree 中移动的是该 worktree 的 HEAD，不会更新 $WORK_BRANCH 引用。
# 因此比对必须取重放后的 worktree HEAD，而非 $WORK_BRANCH。
REPLAYED_SHA="$(git -C "$WT_DIR" rev-parse HEAD)"
log "重放完成：$REPLAYED_SHA（基线 $(git rev-parse --short "$BASE_SHA") + ${#PATCHES[@]} 补丁）"

# --- 源码树比对 ------------------------------------------------------------
# 比对重放树与 custom：排除 patches/（仅 custom 持有）与 docs/openapi.json（生成物，README 既定排除项）。
DIFF_OUTPUT="$(git diff --stat "$REPLAYED_SHA" "$STACK_REF" -- . ':(exclude)patches' ':(exclude)docs/openapi.json' || true)"

if [ -n "$DIFF_OUTPUT" ]; then
  printf '%s\n' "$DIFF_OUTPUT" >&2
  fail "重放树与 $STACK_REF 源码树存在差异——有源码改动未回写补丁（见 patches/README §369 铁律）"
fi

log "OK：${#PATCHES[@]} 个补丁在 $BASE_REF 上重放后，源码树与 $STACK_REF 逐字节一致。"
