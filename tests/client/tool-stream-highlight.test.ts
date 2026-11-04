import { describe, expect, it } from 'vitest'
import {
  MAX_HIGHLIGHT_CHARS,
  detectLanguageByAuto,
  detectLanguageFromArgs,
  detectLanguageFromContent,
  detectOutputLanguage,
  highlightOutput,
  hljsHtmlToAnsi,
} from '@/components/hermes/chat/tool-stream-highlight'
import { formatOutput, paintShellCommand, renderToolBlock, summarizeToolCall } from '@/components/hermes/chat/tool-stream-format'
import type { Message } from '@/stores/hermes/chat'

const labels = { tool: 'tool', empty: 'none' }

function toolMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    role: 'tool',
    content: '',
    timestamp: 0,
    toolName: 'terminal',
    ...overrides,
  }
}

describe('格式化', () => {
  it('把单行 JSON 展开成缩进格式', () => {
    const out = formatOutput('{"a":1,"b":[2,3]}')
    expect(out).toContain('\n')
    expect(out).toContain('  "a": 1')
  })

  it('非 JSON 文本原样返回', () => {
    const log = 'step 1\ndone'
    expect(formatOutput(log)).toBe(log)
  })

  it('空内容不炸', () => {
    expect(formatOutput('')).toBe('')
    expect(formatOutput('   ')).toBe('   ')
  })

  it('关闭格式化时保留原始单行', () => {
    const raw = '{"a":1}'
    const block = renderToolBlock(
      toolMessage({ toolStatus: 'done', toolResult: raw }),
      false,
      labels,
      { format: false },
    )
    expect(block).toContain('{"a":1}')
  })
})

describe('语法高亮', () => {
  it('JSON scope 转成 ANSI 颜色', () => {
    const ansi = hljsHtmlToAnsi('<span class="hljs-string">&quot;x&quot;</span>')
    expect(ansi).toContain('\u001b[32m')
    expect(ansi).toContain('"x"')
    expect(ansi).toContain('\u001b[0m')
  })

  it('实体转义被还原', () => {
    expect(hljsHtmlToAnsi('a &lt; b &amp;&amp; c &gt; d')).toBe('a < b && c > d')
  })

  it('嵌套 span 的内层 token 不掉色', () => {
    // hljs 实际会这样输出 true：<span class="hljs-literal"><span class="hljs-keyword">true</span></span>
    const ansi = hljsHtmlToAnsi(
      '<span class="hljs-literal"><span class="hljs-keyword">true</span></span>',
    )
    const keyword = '\u001b[35m' // keyword 映射到品红
    const idx = ansi.indexOf('true')
    expect(idx).toBeGreaterThan(-1)
    // true 之前必须紧邻 keyword 的颜色码，而不是 reset
    expect(ansi.slice(0, idx).endsWith(keyword)).toBe(true)
  })

  it('识别 JSON 输出', () => {
    expect(detectOutputLanguage('terminal', '{"a":1}')).toBe('json')
    expect(detectOutputLanguage('terminal', 'plain log line')).toBeUndefined()
  })

  it('已有 ANSI 的内容不重复染色', () => {
    const colored = '\u001b[31mboom\u001b[0m'
    expect(highlightOutput(colored, 'json')).toBe(colored)
  })

  it('超长内容跳过语法高亮（避免卡主线程）', () => {
    const huge = '{"a":'.repeat(MAX_HIGHLIGHT_CHARS / 5 + 1)
    expect(huge.length).toBeGreaterThan(MAX_HIGHLIGHT_CHARS)
    expect(highlightOutput(huge, 'json')).toBe(huge)
  })

  it('未注册语言原样返回', () => {
    expect(highlightOutput('abc', 'not-a-language')).toBe('abc')
  })

  it('开启高亮后输出含 ANSI 转义', () => {
    const block = renderToolBlock(
      toolMessage({ toolStatus: 'done', toolResult: '{"k": "v"}' }),
      false,
      labels,
      { highlight: true },
    )
    expect(block).toContain('\u001b[')
  })

  it('关闭高亮时输出正文不含配色（reset 之外无其他转义）', () => {
    const raw = '{"k": "v"}'
    // 面包屑：面板自身只用 reset(0m)/勾(32m)/叉(31m)，所以这里直接验证纯函数
    expect(highlightOutput(raw, undefined)).toBe(raw)
    const block = renderToolBlock(
      toolMessage({ toolStatus: 'running', toolResult: raw }),
      false,
      labels,
      { highlight: false },
    )
    // running 态没有勾号，正文之外不应出现绿色
    expect(block).not.toContain('\u001b[32m')
  })
})

describe('Python 识别', () => {
  const PY_SOURCE = `import os
from typing import List

class Foo:
    def bar(self, x: int = 3) -> List[str]:
        # comment
        if x > 0:
            return [f"{i}" for i in range(x)]
        raise ValueError("neg")
`

  it('识别 Python 源码', () => {
    expect(detectLanguageFromContent(PY_SOURCE)).toBe('python')
  })

  it('识别 traceback（最需要看的那类输出）', () => {
    const tb = `Traceback (most recent call last):
  File "/app/main.py", line 12, in <module>
    run()
ValueError: broke
`
    expect(detectLanguageFromContent(tb)).toBe('python')
  })

  it('识别 REPL 回显', () => {
    expect(detectLanguageFromContent('>>> 1+1\n2\n>>> print("hi")\nhi\n')).toBe('python')
  })

  it('不把 shell 日志 / grep / docker ps 误判成 Python', () => {
    expect(detectLanguageFromContent('=== / ===\n200\n=== /app.html ===\n404\n')).toBeUndefined()
    expect(detectLanguageFromContent('docs/00.md:7:> 名称\ndocs/48:| 22 | x |\n')).toBeUndefined()
    expect(detectLanguageFromContent('CONTAINER ID   IMAGE   STATUS\nabc  nginx  Up 2h\n')).toBeUndefined()
  })

  it('不把 JS 误判成 Python（现在会正确识别为 javascript）', () => {
    const js = 'const x = 1;\nfunction foo() {\n  return x;\n}\n'
    expect(detectLanguageFromContent(js)).not.toBe('python')
    expect(detectLanguageFromContent(js)).toBe('javascript')
  })

  it('从 .py 文件路径直接认出（比内容更可靠）', () => {
    expect(detectLanguageFromArgs({ file_path: '/tmp/script.py' })).toBe('python')
    expect(detectLanguageFromArgs({ path: 'a/b.pyw' })).toBe('python')
    expect(detectLanguageFromArgs({ file_path: '/tmp/script.js' })).toBeUndefined()
    expect(detectLanguageFromArgs(undefined)).toBeUndefined()
  })

  it('路径线索优先于内容推断', () => {
    expect(detectOutputLanguage('read_file', 'plain log line', { file_path: 'x.py' })).toBe('python')
  })

  it('Python 输出经高亮后带 ANSI 颜色', () => {
    const painted = highlightOutput(PY_SOURCE, 'python')
    expect(painted).toContain('\u001b[')
    expect(painted).toContain('\u001b[35m') // keyword 品红
  })

  it('Python 源码经直播渲染后带颜色', () => {
    const block = renderToolBlock(
      toolMessage({
        toolName: 'read_file',
        toolArgs: { file_path: 'x.py' },
        toolStatus: 'done',
        toolResult: PY_SOURCE,
      }),
      false,
      labels,
      { highlight: true },
    )
    expect(block).toContain('\u001b[35m')
    // 着色会在 token 之间插入 reset，所以分别断言关键词与标识符
    expect(block).toContain('import')
    expect(block).toContain('List')
    expect(block).toContain('ValueError')
  })
})

describe('工具调用行（不能只有输出）', () => {
  it('非 terminal 工具也打印调用行，而不是只剩输出', () => {
    const block = renderToolBlock(
      toolMessage({
        toolName: 'execute_code',
        toolArgs: { code: 'print(1)\nprint(2)' },
        toolStatus: 'done',
        toolResult: '{"status":"success"}',
      }),
      true, // 首次渲染：历史回放/刷新后就是这种情况
      labels,
    )
    expect(block).toContain('❯ execute_code')
    expect(block).toContain('code=')
  })

  it('已完成状态（历史回放）也打印调用行', () => {
    // 刷新后拿到的消息全是 done —— 这正是之前"只剩输出"的场景
    const block = renderToolBlock(
      toolMessage({
        toolName: 'read_file',
        toolArgs: { path: '/tmp/a.ts' },
        toolStatus: 'done',
        toolResult: 'file body',
      }),
      true,
      labels,
    )
    expect(block).toContain('❯ read_file')
    expect(block).toContain('path=/tmp/a.ts')
  })

  it('read_file / patch 的工具行带出路径', () => {
    const rf = renderToolBlock(
      toolMessage({
        toolName: 'read_file',
        toolArgs: { path: '/tmp/a.ts', limit: 50 },
        toolStatus: 'done',
        toolResult: 'x',
      }),
      true,
      labels,
    )
    expect(rf).toContain('❯ read_file')
    expect(rf).toContain('path=/tmp/a.ts')

    const pf = renderToolBlock(
      toolMessage({
        toolName: 'patch',
        toolArgs: { path: '/tmp/b.ts' },
        toolStatus: 'done',
        toolResult: 'ok',
      }),
      true,
      labels,
    )
    expect(pf).toContain('❯ patch')
    expect(pf).toContain('path=/tmp/b.ts')
  })

  it('长文本参数（code）只取首行，不整段塞进命令行', () => {
    const summary = summarizeToolCall('execute_code', {
      code: 'import os\nprint(os.getcwd())\nprint("done")',
    })
    expect(summary).toContain('import os')
    expect(summary).toContain('+2 行')
    expect(summary).not.toContain('\n')
  })

  it('MCP 工具用 explanation 做摘要，而不是退化成裸 JSON', () => {
    const summary = summarizeToolCall('mcp__x__update_plan', {
      context_id: 'abc',
      explanation: '修复调用行缺失',
      plan: [{ id: 's1' }],
    })
    expect(summary).toContain('explanation=修复调用行缺失')
    expect(summary).not.toContain('{"context_id"')
  })

  it('tool_call 的嵌套 calls 会被展平', () => {
    const summary = summarizeToolCall('tool_call', {
      calls: [{ name: 'read_file', arguments: { path: '/tmp/x.py' } }],
    })
    expect(summary).toContain('read_file')
    expect(summary).toContain('path=/tmp/x.py')
  })

  it('完全没有参数时仍打印工具名（不静默丢行）', () => {
    const block = renderToolBlock(
      toolMessage({ toolName: 'tool_search', toolStatus: 'done', toolResult: '{}' }),
      true,
      labels,
    )
    expect(block).toContain('❯ tool_search')
  })

  it('toolArgs 是 JSON 字符串（历史回放）时也能解析出参数', () => {
    // 历史回放时 toolArgs 来自 tc.function.arguments —— 是字符串不是对象
    const block = renderToolBlock(
      toolMessage({
        toolName: 'read_file',
        toolArgs: '{"path":"/tmp/hist.ts","limit":80}',
        toolStatus: 'done',
        toolResult: 'body',
      }),
      true,
      labels,
    )
    expect(block).toContain('path=/tmp/hist.ts')
    expect(block).not.toContain('{"path"')
  })

  it('历史回放的 terminal 命令（字符串参数）能取出命令', () => {
    const block = renderToolBlock(
      toolMessage({
        toolName: 'terminal',
        toolArgs: '{"command":"ls -la /tmp"}',
        toolStatus: 'done',
        toolResult: '',
      }),
      true,
      labels,
    )
    expect(block).toContain('ls -la /tmp')
  })

  it('MCP 工具（字符串参数）显示可读摘要，不贴原始 JSON', () => {
    const block = renderToolBlock(
      toolMessage({
        toolName: 'mcp__x__update_plan',
        toolArgs: '{"context_id":"cid-1","explanation":"同步任务卡"}',
        toolStatus: 'done',
        toolResult: '{}',
      }),
      true,
      labels,
    )
    expect(block).toContain('explanation=同步任务卡')
    expect(block).not.toContain('{"context_id"')
  })

  it('非法 JSON 字符串不崩，按纯文本展示', () => {
    expect(() => summarizeToolCall('x', '{not json')).not.toThrow()
    expect(summarizeToolCall('x', 'plain text')).toBe('plain text')
  })
})

describe('shell 命令行结构化着色', () => {
  it('命令名 / 选项 / 字符串 / 管道分别着色', () => {
    const painted = paintShellCommand('grep -rn "foo" src | head -5')
    // 命令名：加粗蓝
    expect(painted).toContain('\u001b[1;34mgrep')
    // 选项：青
    expect(painted).toContain('\u001b[36m-rn')
    // 字符串：绿
    expect(painted).toContain('\u001b[32m"foo"')
    // 管道：品红
    expect(painted).toContain('\u001b[35m|')
  })

  it('管道后的命令也被认作命令名', () => {
    const painted = paintShellCommand('cat a.txt | tail -3')
    expect(painted).toContain('\u001b[1;34mcat')
    expect(painted).toContain('\u001b[1;34mtail')
  })

  it('环境变量赋值单独着色', () => {
    const painted = paintShellCommand('FOO=1 npm run build')
    expect(painted).toContain('\u001b[33mFOO=1')
  })

  it('内容不被破坏（去掉颜色码等于原文）', () => {
    const cmd = 'cd /a/b && npx vite build 2>&1 | tail -3'
    const plain = paintShellCommand(cmd).replace(/\u001b\[[0-9;]*m/g, '')
    expect(plain).toBe(cmd)
  })

  it('terminal 命令行确实被着色（不再整体单色）', () => {
    const block = renderToolBlock(
      toolMessage({
        toolName: 'terminal',
        toolArgs: { command: 'grep -rn "x" src | head -3' },
        toolStatus: 'done',
        toolResult: '',
      }),
      true,
      labels,
      { highlight: true },
    )
    expect(block).toContain('\u001b[1;34mgrep')
    expect(block).toContain('\u001b[35m|')
  })
})

describe('自动语言识别（高把握才染色）', () => {
  it('认出未标语言的 TS / Go / Rust 代码', () => {
    const ts = `interface User { id: number; name: string }
export function greet(u: User): string {
  return \`hi \${u.name}\`
}`
    const go = `package main

import "fmt"

func main() {
\tfmt.Println("hi")
}`
    const rust = `fn main() {
    let x: i32 = 5;
    println!("{}", x);
}`
    expect(detectLanguageByAuto(ts)).toBe('typescript')
    expect(detectLanguageByAuto(go)).toBe('go')
    expect(detectLanguageByAuto(rust)).toBe('rust')
  })

  it('不把日志 / 表格 / 差异误判成代码', () => {
    const cases = [
      'HTTP/1.1 200 OK\nContent-Type: application/json\n{"ok":true}',
      '--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new',
      '/home/aries/a.py\n/home/aries/b.py\n/tmp/c.txt',
      'CONTAINER ID   IMAGE   STATUS\nabc  nginx  Up 2h\ndef  redis  Up 1h',
      '=== / ===\n200\n=== /app.html ===\n404',
      'docs/00.md:7:> 名称\ndocs/48:| 22 | x |\ndocs/49:| 23 | y |',
      '[2026-11-04 12:00:00] info started\n[2026-11-04 12:00:01] warn\n[2026-11-04 12:00:02] done',
    ]
    for (const text of cases) {
      expect(detectLanguageByAuto(text), text.slice(0, 40)).toBeUndefined()
    }
  })

  it('单行不猜（一行文本不足以判断语言）', () => {
    expect(detectLanguageByAuto('const a = 1')).toBeUndefined()
  })

  it('两行的紧凑代码片段也能认出', () => {
    const ts2 = 'interface U { id: number }\nexport const f = (u: U): string => `hi ${u.id}`'
    expect(detectLanguageByAuto(ts2)).toBe('typescript')
  })

  it('traceback 仍走 Python 专项，不受日志拦截影响', () => {
    const tb = `Traceback (most recent call last):
  File "/app/main.py", line 12, in <module>
    run()
ValueError: broke
`
    expect(detectLanguageFromContent(tb)).toBe('python')
  })
})
