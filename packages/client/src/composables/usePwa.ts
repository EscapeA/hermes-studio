import { onMounted, onUnmounted, ref } from 'vue'

const updateAvailable = ref(false)
const offlineReady = ref(false)

// Page-wide singleton guard. Every usePwa() call used to re-register the worker
// and stack another controllerchange listener + update timer that were never
// torn down; the module-level promise keeps the registration single-shot.
let registerPromise: Promise<ServiceWorkerRegistration | null> | null = null
let registration: ServiceWorkerRegistration | null = null
let updateTimer: ReturnType<typeof setInterval> | null = null
let controllerChangeHandler: (() => void) | null = null

function reloadOnce() {
  let reloaded = false
  return () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  }
}

const reloadOnControllerChange = reloadOnce()

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  // Insecure origins (plain-HTTP LAN address) silently refuse registration.
  if (!window.isSecureContext) return null

  try {
    // Registered before register() so the very first activation is not missed.
    controllerChangeHandler = () => reloadOnControllerChange()
    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler)

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    registration = reg

    const flagUpdate = () => {
      // A worker in `waiting` means a newer build is on disk and will take over
      // on the next cold start. Do not activate it mid-session.
      if (reg.waiting) updateAvailable.value = true
    }
    flagUpdate()

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') flagUpdate()
      })
    })

    // A shell cached from the previous session means this cold start already
    // came from disk.
    const cache = await caches.open('ekko-shell-v1').catch(() => null)
    if (cache && (await cache.match('/'))) offlineReady.value = true

    if (updateTimer) clearInterval(updateTimer)
    updateTimer = setInterval(() => void reg.update().catch(() => undefined), 30 * 60 * 1000)
    return reg
  } catch (error) {
    console.warn('[pwa] service worker registration failed:', error)
    return null
  }
}

/** Warm the shell cache so the next launch renders without touching the network. */
async function warmShellCache() {
  if (!('caches' in window)) return
  try {
    const cache = await caches.open('ekko-shell-v1')
    const cached = await cache.match('/')
    // Only refresh once the worker exists; it owns subsequent invalidation.
    if (!cached && navigator.serviceWorker.controller) {
      await cache.add(new Request('/', { cache: 'reload' })).catch(() => undefined)
    }
    offlineReady.value = !!(await cache.match('/'))
  } catch {
    // Private mode / storage pressure: caching is best-effort.
  }
}

export function usePwa() {
  onMounted(() => {
    if (!registerPromise) {
      registerPromise = registerServiceWorker().then(async (reg) => {
        await warmShellCache()
        return reg
      })
    }
    void registerPromise
  })

  onUnmounted(() => {
    if (updateTimer) {
      clearInterval(updateTimer)
      updateTimer = null
    }
    if (controllerChangeHandler) {
      navigator.serviceWorker?.removeEventListener('controllerchange', controllerChangeHandler)
      controllerChangeHandler = null
    }
  })

  /** Apply a pending build now instead of waiting for the next launch. */
  function applyUpdate() {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }

  return { updateAvailable, offlineReady, applyUpdate }
}
