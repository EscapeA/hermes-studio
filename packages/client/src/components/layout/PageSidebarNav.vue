<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { isStoredSuperAdmin } from '@/api/client'
import { useSessionSearch } from '@/composables/useSessionSearch'
import { getAgentManagerEntry, resolveAgentManagerEntryRoute } from '@/utils/agent-manager-entry'
import DesktopUpdateDownloadTab from './DesktopUpdateDownloadTab.vue'
import { useNavigationRail } from '@/composables/useNavigationRail'

type ActiveSection = 'chat' | 'history' | 'connections' | 'agents' | 'models' | 'global'

const props = defineProps<{
  active: ActiveSection
  primaryLabel?: string
}>()

const emit = defineEmits<{
  primary: []
}>()

const { t } = useI18n()
const router = useRouter()
const { openSessionSearch } = useSessionSearch()
const canManageAgents = computed(() => isStoredSuperAdmin())
const hasNavigationRail = useNavigationRail()

const primaryText = computed(() => props.primaryLabel || t('chat.newChat'))
const historyButtonLabel = computed(() =>
  props.active === 'history' ? t('chat.sessions') : t('sidebar.history'),
)

function openHistory() {
  if (props.active === 'history') {
    void router.push({ name: 'hermes.chat' })
    return
  }
  void router.push({ name: 'hermes.history' })
}

function openAgentManager() {
  if (props.active === 'agents') return
  void router.push(
    resolveAgentManagerEntryRoute(getAgentManagerEntry()) ?? { name: 'hermes.agentManager' },
  )
}

function openModels() {
  if (props.active === 'models') return
  void router.push({ name: 'hermes.models' })
}
</script>

<template>
  <div class="page-sidebar-nav" :class="{ 'page-sidebar-nav--compact': hasNavigationRail }">
    <DesktopUpdateDownloadTab />
    <div class="page-sidebar-tabs" role="tablist" aria-label="Chat actions">
      <div class="page-sidebar-search-row">
        <button
          v-if="active !== 'history'"
          class="page-sidebar-tab page-sidebar-primary"
          type="button"
          :title="primaryText"
          :aria-label="primaryText"
          @click="emit('primary')"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{{ primaryText }}</span>
        </button>
        <button class="page-sidebar-tab page-sidebar-search" type="button" @click="openSessionSearch">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span>{{ t('sidebar.search') }}</span>
        </button>
        <div v-if="$slots.actions" class="page-sidebar-search-actions">
          <slot name="actions" />
        </div>
      </div>
      <button
        v-if="active === 'history' || !hasNavigationRail"
        class="page-sidebar-tab"
        type="button"
        @click="openHistory"
      >
        <svg
          v-if="active === 'history'"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <svg
          v-else
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span>{{ historyButtonLabel }}</span>
      </button>
      <button
        v-if="canManageAgents && !hasNavigationRail"
        class="page-sidebar-tab"
        :class="{ active: active === 'agents' }"
        type="button"
        :aria-current="active === 'agents' ? 'page' : undefined"
        @click="openAgentManager"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 8V4H8" />
          <rect x="4" y="8" width="16" height="12" rx="3" />
          <path d="M2 14h2M20 14h2M9 13v2M15 13v2" />
        </svg>
        <span>{{ t('sidebar.agentManager') }}</span>
      </button>
      <button
        v-if="!hasNavigationRail"
        class="page-sidebar-tab"
        :class="{ active: active === 'models' }"
        type="button"
        :aria-current="active === 'models' ? 'page' : undefined"
        @click="openModels"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
        </svg>
        <span>{{ t('sidebar.models') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.page-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-sidebar-tabs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-sidebar-search-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;

  .page-sidebar-primary { flex: 0 0 100%; }
  .page-sidebar-search { flex: 1; }
}

.page-sidebar-search-actions {
  order: 2;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
}

.page-sidebar-nav--compact {
  .page-sidebar-search { order: 1; flex: 1; background: rgba(var(--accent-primary-rgb), 0.05); }
}

.page-sidebar-tab {
  width: 100%;
  min-width: 0;
  height: 34px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-secondary;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  transition:
    background-color $transition-fast,
    color $transition-fast;

  svg {
    flex-shrink: 0;
  }

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    line-height: 18px;
  }

  &:hover,
  &.active {
    background: rgba(var(--accent-primary-rgb), 0.06);
    color: $text-primary;
  }
}
</style>
