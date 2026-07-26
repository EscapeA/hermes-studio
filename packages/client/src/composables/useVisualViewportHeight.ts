/**
 * Keep the app shell height in sync with the visual viewport.
 *
 * Chrome Android with a fixed full-screen shell (html/body position:fixed +
 * overflow:hidden + height:100svh) will not naturally reflow the bottom chat
 * composer when the IME opens — especially after interactive-widget=overlays-content.
 *
 * Binding --app-height / --app-top to visualViewport lets flex layouts shrink so
 * the composer stays above the keyboard without transform hacks that get clipped
 * by overflow:hidden ancestors.
 */
export function installVisualViewportHeight(): () => void {
  if (typeof window === 'undefined') return () => {}

  const root = document.documentElement

  const sync = () => {
    const vv = window.visualViewport
    if (!vv) {
      root.style.removeProperty('--app-height')
      root.style.removeProperty('--app-top')
      return
    }

    // Round to whole px to avoid subpixel jitter while the IME animates.
    const height = Math.max(0, Math.round(vv.height))
    const top = Math.max(0, Math.round(vv.offsetTop))
    root.style.setProperty('--app-height', `${height}px`)
    root.style.setProperty('--app-top', `${top}px`)
  }

  sync()

  window.addEventListener('resize', sync)
  const vv = window.visualViewport
  if (vv) {
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
  }

  return () => {
    window.removeEventListener('resize', sync)
    if (vv) {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
    root.style.removeProperty('--app-height')
    root.style.removeProperty('--app-top')
  }
}
