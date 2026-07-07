import { ref, onMounted } from 'vue'

const updateAvailable = ref(false)
let swRegistration: ServiceWorkerRegistration | null = null

export function usePwa() {
  onMounted(() => {
    registerSW()
  })

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return

    // controllerchange listener BEFORE register (skill pitfall)
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

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
      setInterval(() => reg.update(), 30 * 60 * 1000)
    } catch (err) {
      console.warn('SW registration failed:', err)
    }
  }

  function applyUpdate() {
    swRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }

  return { updateAvailable, applyUpdate }
}
