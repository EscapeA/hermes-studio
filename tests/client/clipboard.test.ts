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
    const value = node ? node.textContent || '' : ''
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
