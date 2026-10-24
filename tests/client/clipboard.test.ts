// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '@/utils/clipboard'

const realClipboard = navigator.clipboard

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

/**
 * jsdom has no layout, so a real Range selection always reads ''. Model the part that matters
 * here: what text the scratch node holds while execCommand runs.
 */
function makeSelectionMirrorScratchNode(removeAllRanges = vi.fn(), addRange = vi.fn()) {
  vi.spyOn(window, 'getSelection').mockImplementation(() => {
    // A focused textarea owns the document selection (it mirrors its own range over `.value`),
    // so prefer it over the contenteditable scratch node — both may be in the DOM at once.
    const focusedTextarea =
      document.activeElement instanceof HTMLTextAreaElement ? document.activeElement : null
    const node =
      focusedTextarea ||
      document.body.querySelector('[contenteditable="true"]') ||
      document.body.querySelector('textarea')
    // A textarea selection is a character range over `.value`, so it reports the value as-is.
    const isTextarea = node instanceof HTMLTextAreaElement
    const raw = isTextarea
      ? (node as HTMLTextAreaElement).value
      : (node ? node.textContent || '' : '')
    let value = raw
    if (!isTextarea) {
      // jsdom has no layout, so it cannot collapse whitespace. Reproduce what a real browser
      // does to a selection inside a `white-space: normal` block: newlines and runs of spaces
      // become single spaces. Without this the test cannot tell `pre-wrap` from its absence.
      const collapses = node instanceof HTMLElement && node.style.whiteSpace !== 'pre-wrap'
      if (collapses) value = raw.replace(/\s+/g, ' ').trim()
      // A DOM Range also cannot cover a newline at the very end of its content — the caret
      // sits after the last character. Chrome/WebView drop it from `toString()`, which is why
      // a shell snippet ending in `\n` could never satisfy its own verification.
      value = value.replace(/\n+$/, '')
    }
    return {
      toString: () => value,
      rangeCount: value ? 1 : 0,
      removeAllRanges,
      addRange,
      getRangeAt: () => ({ cloneRange: () => ({}) }),
    } as unknown as Selection
  })
  return { removeAllRanges, addRange }
}

/** Simulate a selection that never lands: focus succeeded, selection stays empty. */
function makeSelectionAlwaysEmpty() {
  vi.spyOn(window, 'getSelection').mockImplementation(
    () =>
      ({
        toString: () => '',
        rangeCount: 0,
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
        getRangeAt: () => ({ cloneRange: () => ({}) }),
      }) as unknown as Selection,
  )
}

function scratchNode(): HTMLElement | null {
  return (
    document.body.querySelector('[contenteditable="true"]') ||
    document.body.querySelector('textarea')
  )
}

describe('copyToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setSecureContext(false)
  })

  afterEach(() => {
    setClipboard(realClipboard)
    document.body.innerHTML = ''
  })

  it('uses navigator.clipboard in a secure context', async () => {
    setSecureContext(true)
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    const exec = vi.fn(() => true)
    document.execCommand = exec

    await expect(copyToClipboard('abc')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('abc')
    expect(exec).not.toHaveBeenCalled()
  })

  it('falls back to execCommand when the async clipboard rejects', async () => {
    setSecureContext(true)
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionMirrorScratchNode()
    document.execCommand = vi.fn(() => true)

    await expect(copyToClipboard('abc')).resolves.toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  // The regression the user hit: a "copied" toast with an untouched clipboard.
  it('returns false when execCommand claims success but nothing is selected', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionAlwaysEmpty()
    document.execCommand = vi.fn(() => true)

    await expect(copyToClipboard('abc')).resolves.toBe(false)
  })

  it('returns false when execCommand itself reports failure', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionMirrorScratchNode()
    document.execCommand = vi.fn(() => false)

    await expect(copyToClipboard('abc')).resolves.toBe(false)
  })

  // The mobile failure: selecting must not depend on focus(). A 1px off-screen TEXTAREA cannot
  // be focused after a long-press, so setSelectionRange produced an empty selection and the
  // copy silently wrote nothing. A contenteditable Range needs no focus.
  it('selects through a contenteditable Range, never a textarea', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionMirrorScratchNode()
    let tag: string | null = null
    document.execCommand = vi.fn(() => {
      const node = scratchNode()
      tag = node ? node.tagName : null
      return true
    })

    await copyToClipboard('abc')
    expect(tag).toBe('DIV')
  })

  it('never hides the scratch node with opacity 0', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionAlwaysEmpty()
    let seenOpacity: string | undefined
    document.execCommand = vi.fn(() => {
      const node = scratchNode()
      seenOpacity = node instanceof HTMLElement ? node.style.opacity : undefined
      return true
    })

    await copyToClipboard('abc')
    expect(seenOpacity).not.toBe('0')
  })

  // A long-press leaves its own selection behind; the fallback must clear it and then restore
  // the document selection so the page does not stay in a selected state.
  it('clears the leftover selection and restores it afterwards', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    const removeAllRanges = vi.fn()
    const addRange = vi.fn()
    // A long-press leaves a live selection behind: rangeCount stays >= 1 so the helper
    // captures a range to restore. Without that there is nothing to put back.
    vi.spyOn(window, 'getSelection').mockImplementation(() => {
      const node = scratchNode()
      const value = node ? node.textContent || '' : ''
      return {
        toString: () => value,
        rangeCount: 1,
        removeAllRanges,
        addRange,
        getRangeAt: () => ({ cloneRange: () => ({}) }),
      } as unknown as Selection
    })
    document.execCommand = vi.fn(() => true)

    await copyToClipboard('session-id-42')
    expect(removeAllRanges).toHaveBeenCalled()
    expect(addRange).toHaveBeenCalled()
  })

  // The reported bug: only multi-line content failed. A default-`normal` scratch node turns
  // "line1\nline2" into "line1 line2", the verification sees a mismatch, and the copy is
  // refused — so a code block's copy button (always multi-line) never worked over plain HTTP
  // while a single-line session id did.
  it('copies multi-line text with its line breaks intact', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionMirrorScratchNode()
    let seen = ''
    document.execCommand = vi.fn(() => {
      seen = window.getSelection()?.toString() || ''
      return true
    })

    const text = 'line1\nline2\n  indented'
    await expect(copyToClipboard(text)).resolves.toBe(true)
    expect(seen).toBe(text)
  })

  it('keeps the scratch node in pre-wrap so runs of spaces survive', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionMirrorScratchNode()
    let whiteSpace = ''
    document.execCommand = vi.fn(() => {
      const node = scratchNode()
      whiteSpace = node instanceof HTMLElement ? node.style.whiteSpace : ''
      return true
    })

    await copyToClipboard('21时 4071   22时 4217')
    expect(whiteSpace).toBe('pre-wrap')
  })

  // A browser may normalize the line endings it hands back. That is not a copy failure.
  it('treats CRLF and LF as the same text', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    vi.spyOn(window, 'getSelection').mockImplementation(() => {
      const node = scratchNode()
      const value = (node ? node.textContent || '' : '').replace(/\n/g, '\r\n')
      return {
        toString: () => value,
        rangeCount: value ? 1 : 0,
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
        getRangeAt: () => ({ cloneRange: () => ({}) }),
      } as unknown as Selection
    })
    document.execCommand = vi.fn(() => true)

    await expect(copyToClipboard('a\nb')).resolves.toBe(true)
  })

  // The second reported bug: a code block whose source ends with a newline (most shell
  // snippets do) failed on the very selection check that guards the copy, because a DOM Range
  // cannot cover a trailing break. A textarea selection is a character range over its value
  // and keeps them, so it is tried first.
  it('copies a command that ends with a newline', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionMirrorScratchNode()
    let seen = ''
    document.execCommand = vi.fn(() => {
      seen = window.getSelection()?.toString() || ''
      return true
    })

    const text = 'sudo systemctl restart hermes-web-ui-client\n'
    await expect(copyToClipboard(text)).resolves.toBe(true)
    expect(seen).toBe(text)
  })

  it('prefers a textarea so trailing breaks survive', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionMirrorScratchNode()
    let tag: string | null = null
    document.execCommand = vi.fn(() => {
      tag = (document.activeElement as HTMLElement | null)?.tagName ?? null
      return true
    })

    await copyToClipboard('abc\n')
    expect(tag).toBe('TEXTAREA')
  })

  // Only *trailing* breaks are forgiven. Extra or missing interior newlines mean the copy is
  // genuinely wrong and must still be reported as a failure.
  it('still rejects a selection that dropped an interior newline', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    vi.spyOn(window, 'getSelection').mockImplementation(
      () =>
        ({
          toString: () => 'ab',
          rangeCount: 1,
          removeAllRanges: vi.fn(),
          addRange: vi.fn(),
          getRangeAt: () => ({ cloneRange: () => ({}) }),
        }) as unknown as Selection,
    )
    document.execCommand = vi.fn(() => true)

    await expect(copyToClipboard('a\nb')).resolves.toBe(false)
  })

  // Some mobile WebViews refuse to focus a 1px off-screen textarea (the browser builtin
  // does not, but WebView is not the browser). Then the contenteditable fallback runs and its
  // DOM Range reports the text without the trailing break — the copy is still good, so it
  // must not be reported as a failure.
  it('accepts the contenteditable fallback when only trailing breaks differ', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionMirrorScratchNode()
    const realFocus = HTMLElement.prototype.focus
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement) {
      // Refuse to focus the textarea; leave the real behaviour for everything else.
      if (this instanceof HTMLTextAreaElement) return
      return realFocus.call(this)
    })
    document.execCommand = vi.fn(() => true)

    const text = 'sudo systemctl restart hermes-web-ui-client\n'
    await expect(copyToClipboard(text)).resolves.toBe(true)
  })

  it('restores focus to the previously focused element', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })
    makeSelectionMirrorScratchNode()
    document.execCommand = vi.fn(() => true)
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()

    await copyToClipboard('abc')
    expect(document.activeElement).toBe(button)
  })
})
