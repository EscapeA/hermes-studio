<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { NPopconfirm, NCheckbox, NTooltip } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { Session } from '@/stores/hermes/chat'
import { useAppStore } from '@/stores/hermes/app'

import PinIcon from '@/components/common/PinIcon.vue'
import { formatTimestampMs } from '@/shared/session-display'
import { resolveSessionNavigation } from './session-list-item-navigation'

const props = withDefaults(defineProps<{
  session: Session
  active: boolean
  pinned: boolean
  canDelete: boolean
  streaming?: boolean
  completedUnread?: boolean
  selectable?: boolean
  selected?: boolean
  showProfile?: boolean
  categoryLabel?: string
  to?: string
  interceptModifiedNavigation?: boolean
}>(), {
  showProfile: true,
})

const emit = defineEmits<{
  select: []
  contextmenu: [event: MouseEvent]
  delete: []
  'toggle-select': []
  'open-new': []
}>()

const { t } = useI18n()
const appStore = useAppStore()

const profileName = computed(() => props.session.profile || 'default')
const profileHasModels = computed(() => {
  const profileModels = appStore.profileModelGroups.find(profile => profile.profile === profileName.value)
  return !!profileModels?.groups?.some(group => group.models.length > 0)
})
const profileModelsMissing = computed(() =>
  appStore.profileModelGroups.length > 0 && !profileHasModels.value,
)
const isGlobalAgentSession = computed(() => props.session.source === 'global_agent')

let longPressTimer: ReturnType<typeof setTimeout> | null = null
const longPressTriggered = ref(false)

function onTouchStart(e: TouchEvent) {
  longPressTriggered.value = false
  longPressTimer = setTimeout(() => {
    longPressTriggered.value = true
    const touch = e.touches[0]
    const syntheticEvent = new MouseEvent('contextmenu', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true,
    })
    emit('contextmenu', syntheticEvent)
  }, 500)
}

function onTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onTouchMove() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onClick(event?: MouseEvent) {
  if (longPressTriggered.value) {
    longPressTriggered.value = false
    event?.preventDefault()
    return
  }
  const navigationAction = resolveSessionNavigation(event, !!props.interceptModifiedNavigation)
  if (navigationAction === 'native') return
  if (navigationAction === 'open-new') {
    event?.preventDefault()
    emit('open-new')
    return
  }
  if (props.to && !props.selectable) event?.preventDefault()
  emit('select')
}

onUnmounted(() => {
  if (longPressTimer) clearTimeout(longPressTimer)
})
</script>

<template>
  <component
    :is="selectable || !to ? 'button' : 'a'"
    class="session-item"
    :class="{ active, 'batch-mode': selectable, 'missing-models': profileModelsMissing }"
    :aria-current="active ? 'page' : undefined"
    :href="!selectable ? to : undefined"
    :type="selectable || !to ? 'button' : undefined"
    @click="onClick"
    @contextmenu="emit('contextmenu', $event)"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
    @touchmove="onTouchMove"
  >
    <div v-if="selectable" class="session-item-checkbox">
      <NCheckbox :checked="selected" @click.stop="emit('toggle-select')" />
    </div>
    <div class="session-item-content">
      <span class="session-item-title-row">
        <span class="session-item-title-main">
          <span v-if="pinned" class="session-item-pin" aria-hidden="true">
            <PinIcon width="13" height="13" filled />
          </span>
          <span v-if="completedUnread" class="session-item-unread-dot" aria-hidden="true" />
          <span class="session-item-title" dir="auto">
            {{ session.title }}
          </span>
          <NTooltip v-if="profileModelsMissing" trigger="click" placement="top">
            <template #trigger>
              <button class="session-item-warning" type="button" @click.stop.prevent>
                !
              </button>
            </template>
            {{ t('chat.profileMissingModelsTip', { profile: profileName }) }}
          </NTooltip>
        </span>
        <span class="session-item-time">{{ formatTimestampMs(session.createdAt) }}</span>
      </span>

        <span v-if="props.showProfile" class="session-item-profile">
          <span class="session-item-profile-name">{{ profileName }}</span>
        </span>
        <span
          v-if="props.categoryLabel"
          class="session-item-category-tag"
          :title="props.categoryLabel"
        >
          {{ props.categoryLabel }}
        </span>
      </span>
    </div>
    <svg
      v-if="isGlobalAgentSession"
      class="session-item-global-icon"
      :aria-label="t('sidebar.globalAgent')"
      :title="t('sidebar.globalAgent')"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" />
      <path d="M10 10h4v4h-4z" />
    </svg>
    <NPopconfirm v-if="canDelete && !selectable" @positive-click="emit('delete')">
      <template #trigger>
        <button class="session-item-delete" @click.stop.prevent>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </template>
      {{ t('chat.deleteSession') }}
    </NPopconfirm>
  </component>
</template>

<style scoped>
.session-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: calc(8px * var(--spacing-scale, 1)) calc(10px * var(--spacing-scale, 1));
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: start;
  text-decoration: none;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  margin-bottom: 2px;
}

.session-item:hover {
  background: rgba(var(--accent-primary-rgb), 0.06);
  color: var(--text-primary);
}

.session-item:hover .session-item-delete {
  opacity: 1;
  pointer-events: auto;
}

.session-item:focus-within .session-item-delete {
  opacity: 1;
  pointer-events: auto;
}

.session-item.active {
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: var(--text-primary);
  font-weight: 500;
  border-radius: var(--radius-component, 6px);
}

.session-item.active .session-item-title {
  color: var(--text-primary);
}

.session-item.missing-models {
  color: #b42318;
  background: rgba(220, 38, 38, 0.08);
}

.session-item.missing-models .session-item-title,
.session-item.missing-models .session-item-profile-name,
.session-item.missing-models .session-item-time {
  color: #b42318;
}

.session-item.missing-models:hover {
  background: rgba(220, 38, 38, 0.12);
}

.session-item-content {
  flex: 1;
  min-width: 0;
  overflow: visible;
}

.session-item-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(10px * var(--spacing-scale, 1));
  min-width: 0;
}

.session-item-title-main {
  display: flex;
  align-items: center;
  gap: calc(6px * var(--spacing-scale, 1));
  flex: 1 1 auto;
  min-width: 0;
}

.session-item-title {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  font-size: calc(var(--font-size-base, 14px) * 13 / 14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item-pin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--accent-primary);
}

.session-item-unread-dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.12);
}

.session-item-time {
  flex: 0 0 auto;
  font-size: calc(var(--font-size-base, 14px) * 11 / 14);
  color: var(--text-muted);
}

.session-item-global-icon {
  position: absolute;
  top: 5px;
  right: 5px;
  color: #d6a019;
  pointer-events: none;
}

.session-item-delete {
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  padding: calc(2px * var(--spacing-scale, 1));
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-component, 3px);
  transition: all var(--transition-fast);
}

.session-item-delete:hover {
  color: var(--error);
  background: rgba(var(--error-rgb), 0.1);
}

@media (hover: none) {
  .session-item-delete {
    opacity: 0.5;
    pointer-events: auto;
  }
}

.session-item-profile {
  display: flex;
  align-items: center;
  gap: calc(5px * var(--spacing-scale, 1));
  flex: 0 1 auto;
  min-width: 0;
}

.session-item-profile-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: calc(var(--font-size-base, 14px) * 11 / 14);
  line-height: var(--line-height, calc(var(--font-size-base, 14px) * 16 / 14));
  color: var(--text-muted);
}

.session-item-category-tag {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 45%;
  overflow: hidden;
  padding: calc(1px * var(--spacing-scale, 1)) calc(6px * var(--spacing-scale, 1));
  border-radius: var(--radius-component, 4px);
  background: rgba(127, 127, 127, 0.12);
  color: var(--text-muted);
  font-size: calc(var(--font-size-base, 14px) * 10 / 14);
  line-height: var(--line-height, calc(var(--font-size-base, 14px) * 16 / 14));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item-warning {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: var(--border-width, 1px) solid rgba(180, 35, 24, 0.35);
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.1);
  color: #b42318;
  font-size: calc(var(--font-size-base, 14px) * 11 / 14);
  font-weight: 700;
  line-height: var(--line-height, calc(var(--font-size-base, 14px) * 14 / 14));
  cursor: pointer;
}

.session-item-agent-row {
  display: flex;
  align-items: center;
  gap: calc(4px * var(--spacing-scale, 1));
  min-width: 0;
  margin-top: 3px;
  padding: calc(3px * var(--spacing-scale, 1)) 0;
}

</style>
