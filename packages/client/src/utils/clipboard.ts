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
  scratch.style.pointerEvents = 'none'
  scratch.style.userSelect = 'text'
  scratch.style.zIndex = '-1'
  document.body.appendChild(scratch)

  let ok = false
  try {
    const selected = selectElementText(scratch)
    // Also focus as a courtesy: some engines copy only the focused element's selection.
    try {
      scratch.focus({ preventScroll: true })
      selectElementText(scratch)
    } catch {
      // focus is best-effort; the Range above is what matters
    }
    if (selected === text && selectedText() === text) {
      ok = document.execCommand('copy')
    }
  } catch {
    ok = false
  } finally {
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
