/**
 * 「Agent 执行直播」面板的纯格式化逻辑。
 *
 * 与渲染分离，便于在不启动 xterm / DOM 的情况下测试：
 * 这里只回答「一条 tool 消息应该产生哪几行文本」。
 */
import type { Message } from '@/stores/hermes/chat'
import { detectOutputLanguage, highlightOutput } from './tool-stream-highlight'

export const ANSI = {
  reset: '\u001b[0m',
  dim: '\u001b[90m',
  cmd: '\u001b[36m',
  ok: '\u001b[32m',
  err: '\u001b[31m',
} as const

/** 只关心会影响渲染的字段，便于幂等判断。 */
export function messageSignature(message: Message): string {
  const output = message.toolResult
  const outputPart = typeof output === 'string'
    ? `s${output.length}`
    : output === undefined || output === null ? 'none' : 'set'
  return `${message.toolStatus || ''}|${outputPart}|${message.toolDuration ?? ''}`
}

/**
 * shell 命令行的结构化着色。
 *
 * 为什么不用 hljs 的 bash：实测它对单条命令行只认得出 1~2 个 token
 * （多数情况只有 built_in/string），整条命令看起来仍是单色。
 * 这里按 shell 的语法要素分色——命令名、选项、字符串、管道/重定向、变量赋值，
 * 让「这条命令在干什么」一眼可辨。
 */
export function paintShellCommand(command: string): string {
  const MAGENTA = '\u001b[35m'   // 管道/连接符
  const CYAN = '\u001b[36m'      // 选项
  const GREEN = '\u001b[32m'     // 引号字符串
  const YELLOW = '\u001b[33m'    // 环境变量赋值
  const BLUE_BOLD = '\u001b[1;34m' // 命令名
  const RESET = '\u001b[0m'

  const tokens = command.split(/(\s+|\||&&|\|\||;|>>|>|<)/)
  const out: string[] = []
  let expectCommand = true

  for (const token of tokens) {
    if (!token) continue
    if (/^\s+$/.test(token)) {
      out.push(token)
      continue
    }
    if (/^(?:\||&&|\|\||;|>>|>|<)$/.test(token)) {
      out.push(`${MAGENTA}${token}${RESET}`)
      expectCommand = true
      continue
    }
    if (/^["'].*["']$/.test(token)) {
      out.push(`${GREEN}${token}${RESET}`)
      expectCommand = false
      continue
    }
    if (/^-/.test(token)) {
      out.push(`${CYAN}${token}${RESET}`)
      expectCommand = false
      continue
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token) && expectCommand) {
      out.push(`${YELLOW}${token}${RESET}`)
      continue
    }
    if (expectCommand) {
      out.push(`${BLUE_BOLD}${token}${RESET}`)
      expectCommand = false
      continue
    }
    out.push(token)
  }
  return out.join('')
}

/**
 * 调用行的截断标记。
 *
 * 用一个固定串做锚点：面板用 xterm LinkProvider 扫到它就能把这一行变成可点击，
 * 点击后展开完整参数。`${n}` 是省略的剩余行数。
 */
export const EXPAND_MARKER = '⟨展开⟩'

/** 截断标记的正则（面板侧复用，避免两边写法漂移）。 */
export const EXPAND_MARKER_PATTERN = /… \(\+\d+ 行\) ⟨展开⟩/

/**
 * 完整参数文本，供展开浮层显示。
 *
 * 与调用行摘要故意不同：这里给**原始参数**（多行代码原样），
 * 让人能真正看清这次调用带了什么。
 */
export function fullToolArgsText(message: Message): string {
  const raw = message.toolArgs
  if (raw === undefined || raw === null || raw === '') return ''
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return ''
    // JSON 字符串参数：能解析就缩进展示（MCP 的 arguments 就是这种）。
    if (/^[[{]/.test(text)) {
      try {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object') {
          return JSON.stringify(parsed, null, 2)
        }
      } catch {
        /* 原样输出 */
      }
    }
    return text
  }
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
}

/**
 * 把工具参数归一化成对象。
 *
 * 历史回放时 `toolArgs` 来自 `tc.function.arguments`——那是**JSON 字符串**，
 * 不是对象。直接按对象取字段会全部拿到 undefined，
 * 于是 terminal 的命令行丢失、其他工具只显示原始 JSON。
 * 这也是「刷新后调用参数不对」的真正原因（与 terminal 无关，各工具都中）。
 */
export function normalizeToolArgs(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'object') {
    return Array.isArray(value) ? undefined : (value as Record<string, unknown>)
  }
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (!text || !/^[[{]/.test(text)) return undefined
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* 不是 JSON */
  }
  return undefined
}

/**
 * 取出一次调用的可读摘要。
 *
 * 直播面板要像终端一样——**每次调用都先打一行命令**，而不是只倒输出。
 * terminal 有 `command` 直接当命令行；其他工具按「关键字段」拼摘要，
 * 拼不出关键字段时退回工具名 + 参数 JSON 的紧凑形式。
 */
export function describeCall(message: Message): { command: string; workdir: string } {
  const args = normalizeToolArgs(message.toolArgs)
  if (message.toolName === 'terminal') {
    return {
      command: typeof args?.command === 'string' ? args.command : '',
      workdir: typeof args?.workdir === 'string' ? args.workdir : '',
    }
  }
  return { command: summarizeToolCall(message.toolName, message.toolArgs), workdir: '' }
}

/** 各工具里最能说明「这次在干什么」的字段（按优先级）。 */
const CALL_SUMMARY_KEYS = [
  'command', 'path', 'file_path', 'query', 'queries', 'url', 'code',
  'pattern', 'content', 'goal', 'prompt', 'explanation', 'step',
  'session_id', 'context_id', 'name',
] as const

/** 单行摘要的最大长度，超出截断——终端里一行拉太长反而难读。 */
const SUMMARY_MAX = 160
/** 这些字段本质是长文本（代码/正文），只取首行，不要整段塞进命令行。 */
const LONG_TEXT_KEYS = new Set(['code', 'content', 'prompt', 'goal'])

function oneLine(value: string): string {
  return value.replace(/\s*\r?\n\s*/g, '\u23ce ').trim()
}

/** 长文本字段只显示首行 + 总行数；多行时附可点击的展开入口。 */
function firstLineSummary(value: string): string {
  const lines = value.split('\n')
  const head = lines[0].trim().slice(0, 80)
  if (lines.length <= 1) return head
  return `${head} … (+${lines.length - 1} 行) ${EXPAND_MARKER}`
}

/**
 * 从参数里挑关键字段拼一行摘要。
 *
 * 只挑「用户一眼能看懂在做什么」的字段；挑不到就把参数压成紧凑 JSON，
 * 至少让人看到这次调用带了什么。
 */
export function summarizeToolCall(
  toolName: string | undefined,
  args: unknown,
): string {
  if (args === undefined || args === null) return ''
  if (typeof args === 'string') {
    // MCP 工具的 arguments 常常是 JSON **字符串**而不是对象，
    // 直接返回会把整段原始 JSON 贴出来——先尝试解析成对象再摘要。
    const text = args.trim()
    if (!text) return ''
    if (/^[[{]/.test(text)) {
      try {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object') {
          return summarizeToolCall(toolName, parsed)
        }
      } catch {
        /* 不是合法 JSON，按纯文本处理 */
      }
    }
    return text.slice(0, SUMMARY_MAX)
  }
  if (typeof args !== 'object') return String(args)

  const record = args as Record<string, unknown>

  // tool_call 这类批量调用：把首个内层调用的参数提上来，避免退化成裸 JSON。
  const nestedCalls = record.calls
  if (Array.isArray(nestedCalls) && nestedCalls.length) {
    const first = nestedCalls[0] as Record<string, unknown> | undefined
    const inner = first?.arguments
    const innerName = typeof first?.name === 'string' ? first.name : ''
    const innerSummary = summarizeToolCall(innerName || undefined, inner)
    if (innerSummary) {
      const count = nestedCalls.length > 1 ? ` (+${nestedCalls.length - 1} 个调用)` : ''
      return `${innerName ? innerName + ' ' : ''}${innerSummary}${count}`.slice(0, SUMMARY_MAX)
    }
  }

  const picked: string[] = []
  for (const key of CALL_SUMMARY_KEYS) {
    const value = record[key]
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      const items = value.filter(v => typeof v === 'string' || typeof v === 'number')
      if (!items.length) continue
      picked.push(`${key}=[${items.slice(0, 3).join(', ')}${items.length > 3 ? ', …' : ''}]`)
      continue
    }
    if (typeof value === 'string' && LONG_TEXT_KEYS.has(key)) {
      picked.push(`${key}=${firstLineSummary(value)}`)
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      picked.push(`${key}=${oneLine(String(value))}`)
    }
    if (picked.length >= 2) break
  }
  if (picked.length) {
    const joined = picked.join(' ')
    // 截断摘要时保住展开标记，否则入口会消失。
    if (joined.length <= SUMMARY_MAX) return joined
    const hasMarker = joined.includes(EXPAND_MARKER)
    const budget = hasMarker ? SUMMARY_MAX - EXPAND_MARKER.length - 1 : SUMMARY_MAX
    const trimmed = joined.slice(0, Math.max(0, budget))
    return hasMarker ? `${trimmed} ${EXPAND_MARKER}` : trimmed
  }

  // 兜底：紧凑 JSON，让「参数存在」这件事可见。
  try {
    return JSON.stringify(record).slice(0, SUMMARY_MAX)
  } catch {
    return String(toolName || '')
  }
}

export function resultText(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/** 统一成 CRLF，xterm 才逐行下移（裸 \n 只回车不下移）。 */
export function toTerminalNewlines(text: string): string {
  return text.replace(/\r?\n/g, '\r\n').replace(/(?<!\r)\r(?!\n)/g, '\r\n')
}

/**
 * 「格式化」开关：把挤成一行的 JSON / JSON 字符串展开成缩进格式。
 *
 * 只处理能成功解析为 JSON 的内容；其他文本原样返回——
 * 命令输出、日志的换行是它本身的意义，重排反而会误导。
 */
export function formatOutput(text: string): string {
  if (!text) return text
  const trimmed = text.trim()
  if (!trimmed) return text

  // 已经是多行缩进 JSON 就不用再动。
  if (/^[[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed)
      const pretty = JSON.stringify(parsed, null, 2)
      // 只在确实变得更清楚时替换（避免把单行小对象也展开得很大）。
      return pretty.length >= trimmed.length ? pretty : text
    } catch {
      return text
    }
  }
  return text
}

/**
 * 一条 tool 消息对应的终端文本块。
 *
 * `isFirstRender` 表示「这条消息在本面板里第一次被写出来」——
 * **无论它当前是 running 还是已 done**，都要先打调用行。
 * 历史回放时拿到的消息全是 done 状态，若只在 running 时打印命令行，
 * 刷新后就只剩输出、看不到调用了什么（真实踩过的 bug）。
 */
export function renderToolBlock(
  message: Message,
  isFirstRender: boolean,
  labels: { tool: string; empty: string; truncatedAtSource?: string },
  options: { format?: boolean; highlight?: boolean } = {},
): string {
  const lines: string[] = []
  const label = message.toolName || labels.tool
  const { command, workdir } = describeCall(message)
  const rawOutput = fullOutputText(message)
  const output = options.format ? formatOutput(rawOutput) : rawOutput
  const painted = options.highlight
    ? highlightOutput(
        output,
        detectOutputLanguage(message.toolName, output, message.toolArgs),
      )
    : output

  if (isFirstRender) {
    if (message.toolName === 'terminal') {
      // terminal：命令行本身就是内容，前面可选带工作目录。
      if (command) {
        if (workdir) lines.push(`${ANSI.dim}# ${workdir}${ANSI.reset}`)
        // 命令行做结构化着色：整条涂一个青色会把选项/字符串/管道的结构糊掉。
        const paintedCommand = options.highlight
          ? paintShellCommand(command)
          : `${ANSI.cmd}${command}${ANSI.reset}`
        lines.push(`${ANSI.cmd}❯ ${ANSI.reset}${paintedCommand}`)
      } else {
        lines.push(`${ANSI.cmd}❯ ${label}${message.toolPreview ? `${ANSI.dim} ${message.toolPreview}${ANSI.reset}` : ANSI.reset}`)
      }
    } else {
      // 其他工具：必须带上工具名，否则只看参数不知道是哪个工具在跑。
      const detail = command || message.toolPreview || ''
      lines.push(`${ANSI.cmd}❯ ${label}${ANSI.reset}${
        detail ? ` ${ANSI.dim}${detail}${ANSI.reset}` : ''
      }`)
    }
  }

  if (output) {
    const tint = message.toolStatus === 'error' ? ANSI.err : ANSI.reset
    lines.push(`${tint}${painted}${ANSI.reset}`)
    // 源头就被截断时要说清楚，别让人以为这是完整输出。
    if (labels.truncatedAtSource && isTruncatedAtSource(rawOutput)) {
      lines.push(`${ANSI.dim}${labels.truncatedAtSource}${ANSI.reset}`)
    }
  } else if (message.toolStatus === 'running' && isFirstRender) {
    lines.push(`${ANSI.dim}…${ANSI.reset}`)
  }

  // 结论只在终态出现；running 不加勾，避免"看起来已完成"。
  if (message.toolStatus && message.toolStatus !== 'running') {
    const duration = typeof message.toolDuration === 'number'
      ? `${ANSI.dim} (${message.toolDuration}s)${ANSI.reset}`
      : ''
    const verdict = message.toolStatus === 'error'
      ? `${ANSI.err}✗${ANSI.reset}`
      : `${ANSI.ok}✓${ANSI.reset}`
    lines.push(`${verdict}${duration}`)
  }

  if (!lines.length) return ''
  return `${lines.join('\r\n')}\r\n`
}

/** 直播面板只回放主会话的工具调用，子任务有自己的面板。 */
export function isStreamToolMessage(message: Message): boolean {
  return message.role === 'tool' && !message.toolCallId?.startsWith('subagent:')
}

/**
 * agent 侧 terminal 工具的输出上限（config.yaml `tool_output.max_bytes`）。
 * 超过它时上游已经截断，直播面板也拿不到更多，需要在界面上说明。
 */
export const AGENT_OUTPUT_CAP_BYTES = 50_000

/** 输出是否在到达前端前就被 agent 截断了（不是前端显示限制）。 */
export function isTruncatedAtSource(text: string): boolean {
  return text.length >= AGENT_OUTPUT_CAP_BYTES
}

/**
 * 直播面板的输出正文。
 *
 * 工具结果常常是**整个 JSON 信封**：`{"output":"...\n...","exit_code":0}`。
 * 直接当纯文本写进终端会看到字面 `\n`、挤成一整行——所以这里先解包：
 *   1. 能解析成对象、且带已知正文键 → 取该字段（换行、转义都已还原）
 *   2. 是字符串且装着转义序列 → 还原 `\n` / `\t` / `\"`
 *   3. 其余原样返回
 *
 * 注意：**不是** JSON 美化。真实 JSON 数据（read_file 的 content 等）
 * 解包后仍保持原文，不会被重排。
 */
export function fullOutputText(message: Message): string {
  return unwrapToolPayload(resultText(message.toolResult))
}

/** 承载正文的常见字段名，按优先级。 */
const OUTPUT_KEYS = ['output', 'content', 'text', 'stdout', 'diff', 'message'] as const

/**
 * 剥掉 agent 为防提示注入给**模型**打的包装。
 *
 * 这层 `<untrusted_tool_result>` 只是信任边界标记，不是正文；
 * 终端里展示给人类看时应当去掉（不影响模型侧收到的内容）。
 */
export function stripUntrustedWrapper(raw: string): string {
  const match = raw.match(
    /^\s*<untrusted_tool_result[^>]*>\n[\s\S]*?\n\n([\s\S]*?)\n<\/untrusted_tool_result>\s*$/,
  )
  return match ? match[1] : raw
}

/** MCP 一类工具把结果再包了一层 `{"result": "<字符串>"}`。 */
const NESTED_RESULT_KEYS = ['result'] as const

/**
 * 反复解包「字符串里装着 JSON」的嵌套层。
 *
 * MCP 结果常见三重包：untrusted 包装 → `{"result":"<json 字符串>"}` → 真正内容。
 * 内层解出来后若是对象，这里直接给缩进文本——这一步属于**还原原始结构**，
 * 不是「格式化」开关管辖的锦上添花：不还原的话用户看到的是一整行转义字符串。
 */
function unwrapNested(raw: string, depth = 0): string {
  if (depth > 4) return raw
  const trimmed = raw.trim()
  if (!trimmed || !/^[[{]/.test(trimmed)) return raw
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return raw
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return raw
  const record = parsed as Record<string, unknown>
  const key = NESTED_RESULT_KEYS.find(k => typeof record[k] === 'string')
  if (!key) return raw
  const inner = (record[key] as string).trim()
  if (!inner) return raw
  // 内层不是 JSON：这就是正文本身。
  if (!/^[[{]/.test(inner)) return inner

  let innerParsed: unknown
  try {
    innerParsed = JSON.parse(inner)
  } catch {
    return inner
  }
  // 内层是对象：可能还能再拆一层，也可能是最终内容。
  const deeper = unwrapNested(inner, depth + 1)
  if (deeper !== inner) return deeper
  return typeof innerParsed === 'object' && innerParsed !== null
    ? JSON.stringify(innerParsed, null, 2)
    : inner
}

/** 去掉外壳后如果还残留转义序列，还原成真正的控制字符。 */
function unescapeLiterals(text: string): string {
  // 只在确实有字面转义、且没有真换行时才处理，避免破坏正常文本。
  if (!/\\[nrt"\\]/.test(text)) return text
  // 已经有多行说明换行是真的，再还原只会破坏内容。
  if (text.includes('\n')) return text
  // Windows 路径（C:\new）会被误判成换行：这类反斜杠后面不是 n/t/r 的边界要护住。
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

/**
 * 解包工具结果信封。
 *
 * `preferStructured` 为真时把非正文键（exit_code 等）作为尾注附上，
 * 让直播里也能看到退出码——这是执行现场的一部分。
 */
export function unwrapToolPayload(raw: string): string {
  if (!raw) return raw
  // ① 先剥掉给模型用的信任边界标记（对展示无意义）。
  const unwrapped = stripUntrustedWrapper(raw)
  // ② 再拆「字符串里套 JSON」的嵌套层（MCP 的 {"result":"..."}）。
  const nested = unwrapNested(unwrapped)
  return unwrapEnvelope(nested)
}

/** 拆掉带正文键的工具结果外壳（output / content / diff…）。 */
function unwrapEnvelope(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed || !/^[[{]/.test(trimmed)) {
    // 不是 JSON：可能只是被双层转义的普通文本。
    return unescapeLiterals(raw)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return unescapeLiterals(raw)
  }

  if (typeof parsed === 'string') return parsed
  if (Array.isArray(parsed)) return raw
  if (!parsed || typeof parsed !== 'object') return raw

  const record = parsed as Record<string, unknown>
  const key = OUTPUT_KEYS.find(k => typeof record[k] === 'string')
  // 没有正文键的对象（MCP 的 {"ok":true,...}）原样返回；
  // 是否美化成缩进由「格式化」开关统一决定，不在解包阶段擅自重排。
  if (!key) return raw

  const body = record[key] as string
  const extras: string[] = []
  for (const [k, v] of Object.entries(record)) {
    if (k === key || v === null || v === undefined || v === '') continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      extras.push(`${k}=${v}`)
    }
  }
  // exit_code 单独拎出来，放在正文之后更贴近终端观感。
  const exit = typeof record.exit_code === 'number' ? record.exit_code : undefined
  const others = extras.filter(e => !e.startsWith('exit_code='))
  if (!body.trim()) {
    return [...others, exit !== undefined ? `exit=${exit}` : ''].filter(Boolean).join(' ')
  }
  const tail: string[] = []
  if (others.length) tail.push(others.join(' '))
  if (exit !== undefined) tail.push(`exit=${exit}`)
  return tail.length ? `${body}\n${tail.join(' ')}` : body
}

/**
 * 大段输出只是分块交给 xterm，避免一次 write 卡住主线程（不是内容截断）。
 */
export const WRITE_CHUNK_CHARS = 16_000

/** 把长文本切成若干块，供逐帧写入。 */
export function chunkForWrite(text: string, size = WRITE_CHUNK_CHARS): string[] {
  if (text.length <= size) return [text]
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size))
  return chunks
}
