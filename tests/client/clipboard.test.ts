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
    const node =
      document.body.querySelector('[contenteditable="true"]') ||
      document.body.querySelector('textarea')
    const raw = node ? node.textContent || '' : ''
    // jsdom has no layout, so it cannot collapse whitespace. Reproduce what a real browser
    // does to a selection inside a `white-space: normal` block: newlines and runs of spaces
    // become single spaces. Without this the test cannot tell `pre-wrap` from its absence.
    const collapses = node instanceof HTMLElement && node.style.whiteSpace !== 'pre-wrap'
    const value = collapses ? raw.replace(/\s+/g, ' ').trim() : raw
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
    makeSelectionMirrorScratchNode(removeAllRanges, addRange)
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
