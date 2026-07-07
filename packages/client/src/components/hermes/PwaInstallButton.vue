<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NButton, NTooltip } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const canInstall = ref(false)
let deferredPrompt: any = null

function handler(e: Event) {
  e.preventDefault()
  deferredPrompt = e
  canInstall.value = true
}

function installedHandler() {
  deferredPrompt = null
  canInstall.value = false
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handler)
  window.addEventListener('appinstalled', installedHandler)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handler)
  window.removeEventListener('appinstalled', installedHandler)
})

async function install() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const result = await deferredPrompt.userChoice
  deferredPrompt = null
  canInstall.value = false
  return result?.outcome
}
</script>

<template>
  <NTooltip v-if="canInstall" trigger="hover">
    <template #trigger>
      <NButton quaternary size="small" @click="install">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </template>
      </NButton>
    </template>
    {{ t('pwa.install') }}
  </NTooltip>
</template>
