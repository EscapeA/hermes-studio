<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import multiavatar from '@multiavatar/multiavatar'
import type { ProfileAvatar } from '@/api/hermes/profiles'
import { getApiKey, getBaseUrlValue } from '@/api/client'

const props = withDefaults(defineProps<{
  name: string
  avatar?: ProfileAvatar | null
  size?: number
}>(), {
  size: 24,
})

const fallbackSeed = computed(() => props.name || 'default')
const generatedSvg = computed(() => multiavatar(props.avatar?.seed || fallbackSeed.value))
const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  flexBasis: `${props.size}px`,
}))

const imageSrc = ref('')
let objectUrl = ''
let resolveGeneration = 0

function revokeObjectUrl() {
  if (!objectUrl) return
  URL.revokeObjectURL(objectUrl)
  objectUrl = ''
}

async function resolveImageSrc() {
  const generation = ++resolveGeneration
  revokeObjectUrl()
  const avatar = props.avatar
  if (avatar?.type !== 'image') {
    imageSrc.value = ''
    return
  }
  if (avatar.dataUrl) {
    imageSrc.value = avatar.dataUrl
    return
  }
  if (!avatar.url) {
    imageSrc.value = ''
    return
  }
  if (!avatar.url.startsWith('/api/')) {
    imageSrc.value = avatar.url
    return
  }
  try {
    const token = getApiKey()
    const res = await fetch(`${getBaseUrlValue()}${avatar.url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      if (generation === resolveGeneration) imageSrc.value = ''
      return
    }
    const blob = await res.blob()
    if (generation !== resolveGeneration) return
    objectUrl = URL.createObjectURL(blob)
    imageSrc.value = objectUrl
  } catch {
    if (generation === resolveGeneration) imageSrc.value = ''
  }
}

watch(
  () => [props.avatar?.type, props.avatar?.dataUrl, props.avatar?.url, props.avatar?.updatedAt],
  () => { void resolveImageSrc() },
  { immediate: true },
)

onUnmounted(() => {
  resolveGeneration += 1
  revokeObjectUrl()
})
</script>

<template>
  <span class="profile-avatar-view" :style="style">
    <img
      v-if="imageSrc"
      class="profile-avatar-image"
      :src="imageSrc"
      alt=""
      draggable="false"
    >
    <span v-else class="profile-avatar-svg" v-html="generatedSvg" />
  </span>
</template>

<style scoped>
.profile-avatar-view {
  display: inline-flex;
  flex: 0 0 auto;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-secondary);
  /* Declare as still-light so WebView FORCE_DARK won't algorithmically
     darken (invert) the avatar image/inline SVG in the shell APK. */
  color-scheme: only light;
}

.profile-avatar-image,
.profile-avatar-svg,
.profile-avatar-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.profile-avatar-image {
  object-fit: cover;
}
</style>
