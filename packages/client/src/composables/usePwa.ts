import { ref, onMounted, onUnmounted } from 'vue'

const updateAvailable = ref(false)
let swRegistration: ServiceWorkerRegistration | null = null

// Module-level gate: the SW, its one-time `controllerchange` listener and the
// 30-minute update timer are shared page-wide resources. Without the gate each
// usePwa() call re-registered the SW and stacked another listener + interval
// that were never torn down.
let swRegisterPromise: Promise<void> | null = null
let swUpdateIntervalId: ReturnType<typeof setInterval> | null = null
let swControllerChangeHandler: (() => void) | null = null

export function usePwa() {
  onMounted(() => {
    registerSW()
  })

  onUnmounted(() => {
    if (swUpdateIntervalId !== null) {
      clearInterval(swUpdateIntervalId)
      swUpdateIntervalId = null
    }
    if (swControllerChangeHandler) {
      navigator.serviceWorker.removeEventListener('controllerchange', swControllerChangeHandler)
      swControllerChangeHandler = null
    }
  })

  function registerSW() {
    if (!('serviceWorker' in navigator)) return
    if (swRegisterPromise) return swRegisterPromise
    swRegisterPromise = (async () => {
      // controllerchange listener BEFORE register (skill pitfall)
      let refreshing = false
      swControllerChangeHandler = () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      }
      navigator.serviceWorker.addEventListener('controllerchange', swControllerChangeHandler)

      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        swRegistration = reg

        if (reg.waiting) {
          updateAvailable.value = true
        }

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              updateAvailable.value = true
            }
          })
        })

        // Periodic update check every 30 minutes
        if (swUpdateIntervalId !== null) clearInterval(swUpdateIntervalId)
        swUpdateIntervalId = setInterval(() => reg.update(), 30 * 60 * 1000)
      } catch (err) {
        console.warn('SW registration failed:', err)
      }
    })()
    return swRegisterPromise
  }

  function applyUpdate() {
    swRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }

  return { updateAvailable, applyUpdate }
}
