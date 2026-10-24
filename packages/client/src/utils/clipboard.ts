/**
 * Copy text to clipboard with fallbacks for non-secure contexts (HTTP, non-localhost).
 *
 * Strategy, in order:
 *   1. `navigator.clipboard.writeText` — reliable, but only exists in secure contexts
 *      (HTTPS or localhost). A Tailscale-IP / LAN deployment over plain HTTP never qualifies.
 *   2. A selection + `document.execCommand('copy')` on a scratch element. This is the legacy
 *      path and it is fragile on mobile:
 *        · `execCommand` must run inside a user-gesture task. A callback fired from a
 *          `setTimeout` (long-press) has left the gesture context, so WebViews reject the copy
 *          even though the selection is correct.
 *        · A long-press also leaves its own text selection/drag state on the list row, so
 *          whatever the scratch element selects is not what ends up copied.
 *      We therefore (a) select with an explicit Range so no focus is required, and (b) verify
 *      the resulting selection actually covers the text before trusting `execCommand`.
 *
 * The return value is the *verified* outcome, never `execCommand`'s bare boolean: some engines
 * answer `true` while copying nothing, which surfaced as a "copied" toast with an unchanged
 * clipboard.
 */

/**
 * Compare what the selection covers against the intended text.
 *
 * Line endings are the only normalization we allow: a browser may hand back `\r\n` for a
 * `\n` we wrote, and refusing that copy would report a failure the user cannot act on.
 * Anything else (collapsed spaces, dropped newlines) is a real mismatch and must fail loudly,
 * otherwise the UI shows "copied" while the clipboard holds something shorter.
 */
function sameText(actual: string, expected: string): boolean {
  const normalize = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return normalize(actual) === normalize(expected)
}

/** Text the current selection covers, or '' when nothing is selected. */
function selectedText(): string {
  if (typeof window === 'undefined') return ''
  const selection = window.getSelection?.()
  return selection ? selection.toString() : ''
}

/**
 * Put `element`'s whole text into the document selection without relying on focus().
 *
 * `textarea.setSelectionRange` requires the element to be focused, and a 1px off-screen
 * element is exactly what mobile WebViews refuse to focus (especially while another element
 * still owns focus after a long-press). A Range on a contenteditable node needs no focus.
 */
function selectElementText(element: HTMLElement): string {
  const selection = window.getSelection?.()
  if (!selection) return ''
  const range = document.createRange()
  range.selectNodeContents(element)
  selection.removeAllRanges()
  selection.addRange(range)
  return selection.toString()
}

/**
 * Text a DOM Range covers, with the trailing line breaks this browser keeps.
 *
 * A DOM selection cannot represent a newline at the very end of its content: the caret sits
 * after the last character, and `toString()` reports the block's text without the break. So a
 * code block whose source ends with `\n` — `sudo systemctl restart x\n`, which is *most*
 * shell snippets — can never match its own selection, and the verification used to reject
 * every such copy. Pasting such a command does not need that final newline, so when the only
 * difference is trailing newlines we accept the result instead of failing the copy.
 */
function matchesIgnoringTrailingBreaks(actual: string, expected: string): boolean {
  if (sameText(actual, expected)) return true
  const trimmed = expected.replace(/\n+$/, '')
  return trimmed !== expected && sameText(actual, trimmed)
}

/**
 * Select through a textarea and return what `getSelection()` reports.
 *
 * Unlike a DOM Range, a textarea selection is a character range over its value, so it keeps
 * trailing line breaks exactly. That makes it the only path that can copy a shell snippet
 * with its terminating newline. It does need focus, which is why it is tried first and the
 * contenteditable path stays as the fallback (mobile WebViews sometimes refuse the focus).
 */
function selectWithTextarea(value: string): { selected: string; node: HTMLTextAreaElement } | null {
  const node = document.createElement('textarea')
  node.value = value
  node.setAttribute('readonly', '')
  node.setAttribute('aria-hidden', 'true')
  node.setAttribute('tabindex', '-1')
  node.style.position = 'fixed'
  node.style.top = '0'
  node.style.left = '0'
  node.style.width = '1px'
  node.style.height = '1px'
  node.style.padding = '0'
  node.style.border = 'none'
  node.style.outline = 'none'
  node.style.boxShadow = 'none'
  node.style.background = 'transparent'
  node.style.opacity = '0.01'
  node.style.fontSize = '1px'
  node.style.resize = 'none'
  node.style.pointerEvents = 'none'
  document.body.appendChild(node)

  try {
    node.focus({ preventScroll: true })
  } catch {
    // fall through: without focus the selection below will simply be empty
  }
  if (document.activeElement !== node) {
    document.body.removeChild(node)
    return null
  }

  node.select()
  node.setSelectionRange(0, value.length)

  // Trust only what the document selection actually reports. A focused textarea mirrors its
  // own selection there; if it reads back empty (some WebViews), the caller falls back to the
  // contenteditable path rather than claiming a copy we cannot verify.
  const selected = selectedText()
  if (!selected) {
    document.body.removeChild(node)
    return null
  }
  return { selected, node }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy fallback
    }
  }

  if (typeof document === 'undefined') return false

  // Whatever a long-press left selected must not leak into the copy.
  const previousFocused = document.activeElement as HTMLElement | null
  const previousRange = (() => {
    const selection = window.getSelection?.()
    if (!selection || selection.rangeCount === 0) return null
    return selection.getRangeAt(0).cloneRange()
  })()

  const scratch = document.createElement('div')
  scratch.textContent = text
  scratch.setAttribute('contenteditable', 'true')
  scratch.setAttribute('aria-hidden', 'true')
  scratch.setAttribute('tabindex', '-1')
  scratch.style.position = 'fixed'
  scratch.style.top = '0'
  scratch.style.left = '0'
  scratch.style.width = '1px'
  scratch.style.height = '1px'
  scratch.style.overflow = 'hidden'
  scratch.style.padding = '0'
  scratch.style.border = 'none'
  scratch.style.outline = 'none'
  scratch.style.boxShadow = 'none'
  scratch.style.background = 'transparent'
  // Invisible to the eye but NOT `opacity: 0` / `display: none`: those make the node
  // unfocusable and unusable as a selection source in Chromium.
  scratch.style.color = 'transparent'
  scratch.style.caretColor = 'transparent'
  // `white-space` is the difference between copying the text and copying a re-flowed
  // approximation of it: a default-`normal` block collapses runs of spaces and turns every
  // newline into a single space, so `getSelection()` returns "a b c" for "a\nb\nc" and the
  // verification below (correctly) refuses to claim success. `pre-wrap` keeps the line breaks
  // and the indentation that code blocks and multi-line messages depend on.
  scratch.style.whiteSpace = 'pre-wrap'
  scratch.style.pointerEvents = 'none'
  scratch.style.userSelect = 'text'
  scratch.style.zIndex = '-1'
  document.body.appendChild(scratch)

  let ok = false
  let textarea: HTMLTextAreaElement | null = null
  try {
    // A textarea selection preserves trailing line breaks; a DOM Range cannot. Try it first
    // and keep the contenteditable node as the fallback for engines that refuse the focus.
    const viaTextarea = selectWithTextarea(text)
    textarea = viaTextarea?.node ?? null
    if (viaTextarea && matchesIgnoringTrailingBreaks(viaTextarea.selected, text)) {
      ok = document.execCommand('copy')
    } else {
      if (textarea) {
        document.body.removeChild(textarea)
        textarea = null
      }
      const selected = selectElementText(scratch)
      // Also focus as a courtesy: some engines copy only the focused element's selection.
      try {
        scratch.focus({ preventScroll: true })
        selectElementText(scratch)
      } catch {
        // focus is best-effort; the Range above is what matters
      }
      if (matchesIgnoringTrailingBreaks(selected, text) && matchesIgnoringTrailingBreaks(selectedText(), text)) {
        ok = document.execCommand('copy')
      }
    }
  } catch {
    ok = false
  } finally {
    if (textarea && textarea.parentNode) document.body.removeChild(textarea)
    document.body.removeChild(scratch)
    // Put the document selection back so the page does not stay in a "selected" state
    // after a long-press copy.
    try {
      const selection = window.getSelection?.()
      if (selection) {
        selection.removeAllRanges()
        if (previousRange) selection.addRange(previousRange)
      }
    } catch {
      // restoring the selection is cosmetic
    }
    if (previousFocused && typeof previousFocused.focus === 'function') {
      try {
        previousFocused.focus({ preventScroll: true })
      } catch {
        // restoring focus is cosmetic; never let it mask the copy result
      }
    }
  }
  return ok
}
