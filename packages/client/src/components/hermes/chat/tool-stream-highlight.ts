/**
 * 把工具输出转成带 ANSI 颜色的终端文本，供 xterm 显示。
 *
 * 为什么复用 highlight.js：仓库已经为消息气泡注册了 20 种语言（`highlight.ts`），
 * 直播面板再引入一套高亮器会让包体翻倍。这里只做两件事——
 * ① 用同一套语言推断 / 归一化；② 把 hljs 的 HTML token 转成 ANSI。
 */
import hljs from 'highlight.js/lib/core'
import {
  inferStructuredLanguage,
  normalizeHighlightLanguage,
} from '@/components/hermes/chat/highlight'

/** 这些语言在 highlight.ts 里注册过，可以直接高亮。 */
export const HIGHLIGHTABLE_LANGUAGES = [
  'bash', 'c', 'cpp', 'css', 'diff', 'dockerfile', 'go', 'ini',
  'java', 'javascript', 'json', 'markdown', 'php', 'python',
  'rust', 'shell', 'sql', 'typescript', 'xml', 'yaml',
] as const

export const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[90m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
} as const

/**
 * hljs 的 scope → ANSI 颜色。
 *
 * 只映射常用 scope：终端里颜色太多反而难读，也避免和用户自己的输出着色打架。
 */
const SCOPE_COLORS: Array<[RegExp, string]> = [
  [/^hljs-(comment|quote)$/, ANSI.dim],
  [/^hljs-(keyword|selector-tag|literal|built_in)$/, ANSI.magenta],
  [/^hljs-(string|regexp|addition|symbol|template-variable)$/, ANSI.green],
  // Python f-string 的插值部分（hljs 的 subst）跟随字符串但更亮，便于扫读。
  [/^hljs-subst$/, ANSI.cyan],
  [/^hljs-(number|meta|link)$/, ANSI.yellow],
  [/^hljs-(attr|attribute|property|variable|params)$/, ANSI.cyan],
  [/^hljs-(title|section|function|name|type|class)$/, ANSI.blue],
  [/^hljs-(deletion|invalid)$/, ANSI.red],
]

function colorForScope(scope: string): string | null {
  for (const [pattern, color] of SCOPE_COLORS) {
    if (pattern.test(scope)) return color
  }
  return null
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * hljs 的 HTML → ANSI。
 *
 * 输出形如 `<span class="hljs-string">"a"</span>` 加裸文本。
 * 注意 hljs 会嵌套 span（`hljs-literal` 里套 `hljs-keyword`），
 * 因此遇到闭合标签要恢复**外层**颜色，而不是一律 reset——
 * 否则 `true`/`false` 这类嵌套 token 会掉色。
 */
export function hljsHtmlToAnsi(html: string): string {
  const stack: string[] = []
  let colored = false
  const withColors = html.replace(
    /<span class="([^"]*)">|<\/span>/g,
    (match, classNames: string | undefined) => {
      if (match === '</span>') {
        stack.pop()
        return stack.length && stack[stack.length - 1]
          ? stack[stack.length - 1]
          : ANSI.reset
      }
      const scopes = (classNames || '').split(/\s+/).filter(Boolean)
      const color = scopes.map(colorForScope).find(Boolean) || ''
      stack.push(color)
      if (color) colored = true
      return color
    },
  )
  const plain = decodeEntities(withColors.replace(/<[^>]+>/g, ''))
  // 纯文本不加多余转义码；着色过才补 reset 收尾。
  return colored ? `${plain}${ANSI.reset}` : plain
}

/** 从工具名 + 输出内容 + 调用参数推断高亮语言；不认识的返回 undefined。 */
export function detectOutputLanguage(
  toolName: string | undefined,
  output: string,
  args?: unknown,
): string | undefined {
  if (!output) return undefined
  const structured = inferStructuredLanguage(output)
  if (structured) return structured

  // ① 最可靠的线索：本次调用操作的文件本身就是 .py。
  const pathHint = detectLanguageFromArgs(args)
  if (pathHint) return pathHint

  // ② 内容特征：Python 源码 / traceback / REPL 回显。
  const fromContent = detectLanguageFromContent(output)
  if (fromContent) return fromContent

  // ③ execute_code / terminal 的结构化 JSON 结果。
  const hint = toolName?.toLowerCase() || ''
  if (hint === 'terminal' || hint === 'execute_code') {
    const trimmed = output.trimStart()
    if (/^[[{]/.test(trimmed)) {
      try {
        JSON.parse(output)
        return 'json'
      } catch {
        /* 不是 JSON */
      }
    }
  }
  return undefined
}

/** 从工具参数里的文件路径推断语言（read_file / patch / write_file 等）。 */
export function detectLanguageFromArgs(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined
  const record = args as Record<string, unknown>
  for (const key of ['file_path', 'path', 'resolved_path', 'target_file']) {
    const value = record[key]
    if (typeof value !== 'string') continue
    if (/\.pyw?$/i.test(value.trim())) return 'python'
  }
  return undefined
}

/**
 * 靠内容认出 Python。
 *
 * 只在特征足够明确时返回：宁可不染色，也不要把普通日志错染成 Python。
 */
export function detectLanguageFromContent(output: string): string | undefined {
  const head = output.slice(0, 4000)

  // traceback 是 Python 独有的强特征，且本身就是用户最需要看的输出。
  if (/^Traceback \(most recent call last\):/m.test(head)) return 'python'
  if (/^\s*File "[^"]+", line \d+/m.test(head) && /^\w*(Error|Exception):/m.test(head)) {
    return 'python'
  }

  // `>>> ` REPL 回显（至少两行才算，避免误判）。
  if ((head.match(/^>>> /gm) || []).length >= 2) return 'python'

  // 源码特征：命中 3 条以上才认。
  const signals: RegExp[] = [
    /^\s*(import|from)\s+[\w.]+\s*(import\b|as\b|$)/m,
    /^\s*def\s+\w+\s*\(.*\)\s*(->\s*[^:]+)?:\s*$/m,
    /^\s*class\s+\w+\s*(\([^)]*\))?\s*:\s*$/m,
    /^\s*(if|elif|for|while|with|try|except|finally)\b[^;{]*:\s*$/m,
    /^\s*(return|yield|raise|pass|continue|break)\b/m,
    /^\s*@\w+/m,
    /f"[^"]*\{[^}]+\}"/,
    /^\s*"""|^\s*'''/m,
  ]
  const hits = signals.filter(re => re.test(head)).length
  if (hits >= 3) return 'python'
  return detectLanguageByAuto(output)
}

/**
 * 允许自动识别的语言白名单。
 *
 * 刻意**不含** bash / yaml / sql / css / xml：
 * 实测它们会把 curl 输出、git diff、docker ps 甚至 JSON 都吞掉
 * （css 尤其严重，relevance 2~4 就认领），而这几类正是日志的本体。
 */
const AUTO_DETECT_LANGUAGES = [
  'typescript', 'javascript', 'python', 'go', 'rust', 'c', 'cpp', 'java', 'json',
] as const

/** relevance 门槛：实测真正代码 ≥5，误判样本 ≤2，取 3 留余量。 */
const AUTO_DETECT_MIN_RELEVANCE = 3

/** 一眼是日志/表格/差异的内容，直接不要自动识别。 */
const LOG_SHAPED_PATTERNS: RegExp[] = [
  /^Traceback \(most recent call last\):/m,
  /^(?:diff --git|---\s+\S+\n\+\+\+\s+\S+|@@ -\d+)/m,
  /^(?:CONTAINER ID|REPOSITORY|NAME\s+READY|HTTP\/1\.\d)/m,
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/m,
  /:[0-9]+:/m,
]

/**
 * 兜底：白名单语言里做自动识别，只在高把握时返回。
 *
 * 用于「一段没标语言的纯代码」——这是真实终端输出里最常见的高亮诉求。
 * 宁可返回空（不染色），也不要把日志染成奇怪的颜色。
 */
export function detectLanguageByAuto(output: string): string | undefined {
  const head = output.slice(0, 4000)
  if (!head.trim()) return undefined
  // 日志/表格/差异形态直接放弃。
  if (LOG_SHAPED_PATTERNS.some(re => re.test(head))) return undefined
  // 单行不足以判断（任何一行文本都可能"像"某种语言）。两行起，能覆盖紧凑片段。
  if (head.split('\n').filter(line => line.trim()).length < 2) return undefined

  try {
    const result = hljs.highlightAuto(head, [...AUTO_DETECT_LANGUAGES])
    if (!result.language) return undefined
    if (result.relevance < AUTO_DETECT_MIN_RELEVANCE) return undefined
    return result.language
  } catch {
    return undefined
  }
}

/**
 * 对整段输出做语法高亮。
 *
 * 不认识的格式原样返回（保持工具自己的 ANSI 颜色，不要二次加工）。
 * 超长内容跳过高亮——hljs 是 CPU 密集的，几万行会卡住主线程。
 */
export const MAX_HIGHLIGHT_CHARS = 60_000

export function highlightOutput(output: string, language?: string): string {
  if (!output || !language) return output
  if (output.length > MAX_HIGHLIGHT_CHARS) return output

  const normalized = normalizeHighlightLanguage(language)
  if (!normalized) return output
  if (!hljs.getLanguage(normalized)) return output

  // 已经带 ANSI 的内容不要重新染色，否则会把原有颜色冲掉。
  if (/\u001b\[/.test(output)) return output

  try {
    const { value } = hljs.highlight(output, { language: normalized, ignoreIllegals: true })
    return hljsHtmlToAnsi(value)
  } catch {
    return output
  }
}
