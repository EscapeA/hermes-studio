<script setup lang="ts">
/**
 * 只读的「Agent 执行直播」终端。
 *
 * 数据源：当前会话的 tool 消息流（tool.started 带命令，tool.completed 带输出）。
 * 与 TerminalPanel 的区别：那是一个可交互的独立 shell，这里是 agent 实际执行的只读回放。
 * 键盘输入在 xterm 层禁用（disableStdin），组件不持有任何写通道。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import { terminalTheme } from '@/styles/theme-integrations'
import { useChatStore } from '@/stores/hermes/chat'
import type { Message } from '@/stores/hermes/chat'
import {
  EXPAND_MARKER,
  EXPAND_MARKER_PATTERN,
  chunkForWrite,
  fullToolArgsText,
  isStreamToolMessage,
  messageSignature,
  renderToolBlock,
  toTerminalNewlines,
} from './tool-stream-format'

const props = defineProps<{ visible?: boolean }>()

const { t } = useI18n()
const { customization, isDark } = useTheme()
const chat = useChatStore()

const mountRef = ref<HTMLDivElement | null>(null)
const statusText = ref('')
let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
/** 已渲染的 tool 消息 id → 上次渲染时的状态签名。 */
const rendered = new Map<string, string>()
/**
 * 缓冲区行号 → 该行属于哪个 tool 消息。
 *
 * 调用行带 ⟨展开⟩ 标记时点击要能反查到消息，所以写块时登记起始行，
 * 供 LinkProvider 使用。replay 时随 term.reset() 一起清空。
 */
const lineOwners = new Map<number, string>()

/** 当前展开的完整参数浮层内容；null = 关闭。 */
const expandedArgs = ref<{ title: string; body: string } | null>(null)

function openArgsPreview(messageId: string) {
  const message = (chat.messages || []).find(m => m.id === messageId)
  if (!message) return
  const body = fullToolArgsText(message)
  if (!body) return
  expandedArgs.value = {
    title: message.toolName || t('toolStream.tool'),
    body,
  }
}

function closeArgsPreview() {
  expandedArgs.value = null
}

const MAX_RENDERED_TOOLS = 200

// ─── 缩放 ───────────────────────────────────────────────────────
// 独立于全局字号：直播面板里经常需要临时缩小看长行、放大看细节。
const STORAGE_KEY_ZOOM = 'studio.toolStream.zoom'
const ZOOM_STEPS = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.8] as const
const BASE_FONT_SIZE = 13

function readStoredZoom(): number {
  const raw = Number(localStorage.getItem(STORAGE_KEY_ZOOM))
  return ZOOM_STEPS.includes(raw as typeof ZOOM_STEPS[number]) ? raw : 1
}

const zoom = ref(readStoredZoom())
const fontSize = computed(() => Math.round(BASE_FONT_SIZE * zoom.value))

function applyZoom(next: number) {
  zoom.value = next
  localStorage.setItem(STORAGE_KEY_ZOOM, String(next))
  if (term) {
    term.options.fontSize = fontSize.value
    fit()
  }
}

function zoomIn() {
  const index = ZOOM_STEPS.indexOf(zoom.value as typeof ZOOM_STEPS[number])
  applyZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, index + 1)] ?? 1)
}

function zoomOut() {
  const index = ZOOM_STEPS.indexOf(zoom.value as typeof ZOOM_STEPS[number])
  applyZoom(ZOOM_STEPS[Math.max(0, index - 1)] ?? 1)
}

function zoomReset() {
  applyZoom(1)
}

const canZoomIn = computed(() => zoom.value < ZOOM_STEPS[ZOOM_STEPS.length - 1])
const canZoomOut = computed(() => zoom.value > ZOOM_STEPS[0])

// ─── 格式化 / 高亮开关 ──────────────────────────────────────────
const STORAGE_KEY_FORMAT = 'studio.toolStream.format'
const STORAGE_KEY_HIGHLIGHT = 'studio.toolStream.highlight'
const formatOn = ref(localStorage.getItem(STORAGE_KEY_FORMAT) !== '0')
const highlightOn = ref(localStorage.getItem(STORAGE_KEY_HIGHLIGHT) !== '0')

function toggleFormat() {
  formatOn.value = !formatOn.value
  localStorage.setItem(STORAGE_KEY_FORMAT, formatOn.value ? '1' : '0')
  replay()
}

function toggleHighlight() {
  highlightOn.value = !highlightOn.value
  localStorage.setItem(STORAGE_KEY_HIGHLIGHT, highlightOn.value ? '1' : '0')
  replay()
}

// ─── 触摸滚动 ───────────────────────────────────────────────────
// xterm 不接管移动端原生滑动，必须自己把位移折算成行数交给 scrollLines。
let touchLastY: number | null = null
let touchRemainder = 0
const TOUCH_SCROLL_LINE_PX = 18

function isAtBottom(): boolean {
  if (!term) return true
  const buffer = term.buffer.active
  return buffer.viewportY >= buffer.baseY
}

function handleTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) {
    touchLastY = null
    touchRemainder = 0
    return
  }
  touchLastY = event.touches[0].clientY
  touchRemainder = 0
}

function handleTouchMove(event: TouchEvent) {
  if (!term || event.touches.length !== 1 || touchLastY === null) return
  const nextY = event.touches[0].clientY
  touchRemainder += touchLastY - nextY
  touchLastY = nextY

  const lines = Math.trunc(touchRemainder / TOUCH_SCROLL_LINE_PX)
  if (lines === 0) return
  term.scrollLines(lines)
  touchRemainder -= lines * TOUCH_SCROLL_LINE_PX
  event.preventDefault()
}

function handleTouchEnd() {
  touchLastY = null
  touchRemainder = 0
}

function currentTheme() {
  return terminalTheme(customization.value, isDark.value)
}

const labels = computed(() => ({
  tool: t('toolStream.tool'),
  empty: t('toolStream.empty'),
  truncatedAtSource: t('toolStream.truncatedAtSource', { size: '50KB' }),
}))

function streamTools(): Message[] {
  return (chat.messages || []).filter(isStreamToolMessage)
}

function writeBlock(message: Message) {
  if (!term) return
  const signature = messageSignature(message)
  const previous = rendered.get(message.id)
  if (previous === signature) return
  // 用户正在往上翻历史时不要把他拽回底部。
  const stick = isAtBottom()
  rendered.set(message.id, signature)
  const block = renderToolBlock(message, previous === undefined, labels.value, {
    format: formatOn.value,
    highlight: highlightOn.value,
  })
  if (!block) return
  // 行号登记必须在写入**之后**做：xterm 的 write 是异步的，
  // 写入前 cursorY 还没走到落点，按写入前算会整体错位（实测第 1 行被登记成下一条消息）。
  const lineCount = block.split('\n').length
  const beforeLine = term.buffer.active.baseY + term.buffer.active.cursorY
  // 分块写入：完整内容照写，只是不让单次 write 阻塞主线程。
  const chunks = chunkForWrite(toTerminalNewlines(block))
  chunks.forEach((chunk, index) => {
    const isLast = index === chunks.length - 1
    term?.write(chunk, isLast
      ? () => {
        const afterLine = term!.buffer.active.baseY + term!.buffer.active.cursorY
        const startLine = Math.max(beforeLine, afterLine - (lineCount - 1))
        for (let i = 0; i < lineCount; i += 1) lineOwners.set(startLine + i, message.id)
        if (stick) term?.scrollToBottom()
      }
      : undefined)
  })
}

function replay() {
  if (!term) return
  term.reset()
  rendered.clear()
  lineOwners.clear()
  expandedArgs.value = null
  const tools = streamTools()
  const slice = tools.slice(-MAX_RENDERED_TOOLS)
  statusText.value = slice.length
    ? t('toolStream.count', { count: tools.length })
    : labels.value.empty
  for (const message of slice) writeBlock(message)
}

/**
 * 条数变化 = 新工具；同一条工具 running→done 只改状态不改条数，
 * 因此用「条数 + 最近几条的签名」作为触发依据。
 */
const messagesRevision = computed(() => {
  const tools = streamTools()
  const tail = tools.slice(-3).map(messageSignature).join(';')
  return `${tools.length}|${tail}`
})

function syncTools() {
  if (!term) return
  const tools = streamTools()
  if (!tools.length) {
    statusText.value = labels.value.empty
    return
  }
  statusText.value = t('toolStream.count', { count: tools.length })
  for (const message of tools.slice(-MAX_RENDERED_TOOLS)) writeBlock(message)
}

function ensureTerminal() {
  const container = mountRef.value
  if (!container || term) return
  term = new Terminal({
    disableStdin: true,
    cursorBlink: false,
    cursorStyle: 'bar',
    fontSize: fontSize.value,
    allowTransparency: true,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: { ...currentTheme() },
    // 大输出不要因为 scrollback 太小而被自己的缓冲区截掉。
    scrollback: 50_000,
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())
  term.open(container)
  registerExpandLinks()
  fit()
  replay()
}

/**
 * 让调用行上的 ⟨展开⟩ 可点击。
 *
 * xterm 的 LinkProvider 会按需请求「这一行有哪些可点击区间」，
 * 我们只在带标记的行上返回一个 range，点开后弹出完整参数浮层。
 */
function registerExpandLinks() {
  if (!term) return
  term.registerLinkProvider({
    provideLinks(bufferLineNumber, callback) {
      // bufferLineNumber 是 1-based 的绝对行号（含 scrollback）。
      const owner = lineOwners.get(bufferLineNumber - 1)
      if (!owner) {
        callback(undefined)
        return
      }
      const line = term?.buffer.active.getLine(bufferLineNumber - 1)
      const text = line?.translateToString(true) ?? ''
      const match = text.match(EXPAND_MARKER_PATTERN)
      if (!match || match.index === undefined) {
        callback(undefined)
        return
      }
      callback([
        {
          range: {
            start: { x: match.index + 1, y: bufferLineNumber },
            end: { x: match.index + match[0].length, y: bufferLineNumber },
          },
          text: EXPAND_MARKER,
          decorations: { underline: true, pointerCursor: true },
          activate: () => openArgsPreview(owner),
        },
      ])
    },
  })
}

/**
 * 底部常驻留白行数。
 *
 * 真实终端正文下面总还留着提示行，不贴容器底边。
 * 项目全局是 `box-sizing: border-box`，给容器加 padding 会被算进高度、
 * fit 依旧撑满（实测反而多一行），所以这里只能用「fit 之后少算 2 行」。
 */
const BOTTOM_GUTTER_ROWS = 2
/** 防止 resize 回调与 fit 相互触发。 */
let fitting = false

function fit() {
  const container = mountRef.value
  if (!container || !fitAddon || !term) return
  if (!container.clientWidth || !container.clientHeight) return
  if (fitting) return
  fitting = true
  try {
    fitAddon.fit()
    // fit 已把行数撑满；收回 2 行形成底部留白。
    // 每次都先撑满再收缩，所以重复调用是幂等的。
    const rows = term.rows - BOTTOM_GUTTER_ROWS
    if (rows > 0 && term.rows !== rows) term.resize(term.cols, rows)
  } catch {
    /* 容器不可见时 fit 会抛错，忽略 */
  } finally {
    fitting = false
  }
}

function attachObserver() {
  if (resizeObserver || !mountRef.value) return
  resizeObserver = new ResizeObserver(() => fit())
  resizeObserver.observe(mountRef.value)
}

watch(
  () => chat.activeSessionId,
  async () => {
    await nextTick()
    replay()
  },
)

watch(messagesRevision, async () => {
  await nextTick()
  syncTools()
})

watch(
  () => [
    customization.value.fontSize,
    isDark.value,
    customization.value.textColor,
    customization.value.accentColor,
    customization.value.appearance,
  ],
  () => {
    if (!term) return
    term.options.theme = { ...currentTheme() }
    // 面板自带缩放优先；用户没手动缩放时才跟随全局字号。
    term.options.fontSize = zoom.value === 1
      ? Math.round(customization.value.fontSize * zoom.value)
      : fontSize.value
    fit()
  },
)

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    await nextTick()
    ensureTerminal()
    attachObserver()
    fit()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  term?.dispose()
  term = null
  fitAddon = null
  rendered.clear()
})
</script>

<template>
  <div class="tool-stream-panel">
    <div class="tool-stream-head">
      <span class="tool-stream-title">{{ t('toolStream.title') }}</span>
      <div class="tool-stream-actions">
        <button
          class="ts-btn"
          :class="{ on: formatOn }"
          type="button"
          :title="t('toolStream.format')"
          :aria-label="t('toolStream.format')"
          :aria-pressed="formatOn"
          @click="toggleFormat"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h10M4 18h7" />
          </svg>
        </button>
        <button
          class="ts-btn"
          :class="{ on: highlightOn }"
          type="button"
          :title="t('toolStream.highlight')"
          :aria-label="t('toolStream.highlight')"
          :aria-pressed="highlightOn"
          @click="toggleHighlight"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 4 4 9l7 7 5-5z" />
            <path d="M13 13l7 7" />
          </svg>
        </button>
        <button
          class="ts-btn"
          type="button"
          :disabled="!canZoomOut"
          :title="t('toolStream.zoomOut')"
          :aria-label="t('toolStream.zoomOut')"
          @click="zoomOut"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12h12" />
          </svg>
        </button>
        <button
          class="ts-btn ts-zoom-value"
          type="button"
          :title="t('toolStream.zoomReset')"
          :aria-label="t('toolStream.zoomReset')"
          @click="zoomReset"
        >{{ Math.round(zoom * 100) }}%</button>
        <button
          class="ts-btn"
          type="button"
          :disabled="!canZoomIn"
          :title="t('toolStream.zoomIn')"
          :aria-label="t('toolStream.zoomIn')"
          @click="zoomIn"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 6v12M6 12h12" />
          </svg>
        </button>
      </div>
      <span class="tool-stream-meta">{{ statusText }}</span>
    </div>
    <div
      ref="mountRef"
      class="tool-stream-term"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchEnd"
    />

    <!-- 完整参数浮层：点调用行上的 ⟨展开⟩ 打开，贴底弹出 -->
    <div v-if="expandedArgs" class="ts-args-layer" @click.self="closeArgsPreview">
      <div
        class="ts-args-card"
        data-theme-surface="card"
        role="dialog"
        :aria-label="t('toolStream.argsTitle')"
      >
        <div class="ts-args-head">
          <span class="ts-args-title">{{ expandedArgs.title }}</span>
          <button
            class="ts-btn"
            type="button"
            :title="t('common.close')"
            :aria-label="t('common.close')"
            @click="closeArgsPreview"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <pre class="ts-args-body">{{ expandedArgs.body }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.tool-stream-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  /* 参数浮层用 absolute 定位，需要这里是定位容器。 */
  position: relative;
  /* 移动端面板与输入区相邻时，底部留一点呼吸位，避免最后一行贴着边被切。 */
  padding-block-end: 2px;
}

.tool-stream-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: calc(6px * var(--spacing-scale, 1)) calc(10px * var(--spacing-scale, 1));
  border-bottom: var(--border-width, 1px) solid $border-color;
  font-size: 11px;
  color: $text-secondary;
}

.tool-stream-title {
  font-weight: 600;
  color: $text-primary;
}

.tool-stream-meta {
  margin-inline-start: auto;
  opacity: 0.7;
  white-space: nowrap;
}

.tool-stream-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-inline-start: auto;
}

.ts-btn {
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: $text-secondary;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: color 120ms, background 120ms;

  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover:not(:disabled) {
    color: $text-primary;
    background: rgba(var(--accent-primary-rgb), 0.08);
  }

  &.on {
    color: var(--accent-primary);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.ts-zoom-value {
  min-width: 34px;
}

/* 完整参数浮层：贴底弹出，不铺全屏遮罩（避免硬编码 scrim 色） */
.ts-args-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: flex-end;
  pointer-events: none;
}

.ts-args-card {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 70%;
  /* 主题契约：卡片面由 data-theme-surface="card" 拥有背景/圆角/阴影。 */
  background: $bg-card;
  border-top: var(--border-width, 1px) solid $border-color;
  border-top-left-radius: var(--radius-component, 8px);
  border-top-right-radius: var(--radius-component, 8px);
  overflow: hidden;
}

.ts-args-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 10px;
  border-bottom: var(--border-width, 1px) solid $border-color;
}

.ts-args-title {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-args-body {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 10px;
  overflow: auto;
  font: 12px/1.5 Menlo, Monaco, 'Courier New', monospace;
  color: $text-secondary;
  white-space: pre;
  overscroll-behavior: contain;
}

.tool-stream-term {
  flex: 1;
  min-height: 0;
  padding: calc(4px * var(--spacing-scale, 1)) calc(6px * var(--spacing-scale, 1));
  overflow: hidden;

  :deep(.xterm) {
    height: 100%;
  }

  // xterm 自身靠 viewport 滚动，默认 hidden 会让内容无法上下翻。
  :deep(.xterm-viewport) {
    overflow-y: scroll !important;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    background-color: transparent !important;
  }

  :deep(.xterm-viewport::-webkit-scrollbar) {
    display: none !important;
  }

  :deep(.xterm-scrollable-element) {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  :deep(.xterm-scrollable-element::-webkit-scrollbar) {
    display: none !important;
  }
}

@media (max-width: $breakpoint-mobile) {
  .tool-stream-term {
    :deep(.xterm-viewport),
    :deep(.xterm-scrollable-element) {
      touch-action: pan-y;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
  }
}
</style>
