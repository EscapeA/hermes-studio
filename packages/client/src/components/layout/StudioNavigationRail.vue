<script setup lang="ts">
import { deploymentUrl } from '@/utils/deployment-url'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NTooltip } from 'naive-ui'
import { isStoredSuperAdmin } from '@/api/client'
import RouteLinkItem from '@/components/common/RouteLinkItem.vue'
import PageSidebarFooter from './PageSidebarFooter.vue'
import { useMobileNavigation } from '@/composables/usePageSidebar'
import { pluginPages, pluginNavigation, pluginPageLocation, usePluginCatalog } from '@/composables/usePluginCatalog'
import PluginNavigationIcon from '@/components/plugins/PluginNavigationIcon.vue'
import PluginSymbol from '@/components/common/PluginIcon.vue'

const props = withDefaults(
  defineProps<{
    /** Mobile drawer: render icon + label rows instead of the icon-only rail. */
    labeled?: boolean
    /** Mobile drawer: also list the app-level destinations (logs … settings). */
    withAppEntries?: boolean
  }>(),
  { labeled: false, withAppEntries: false },
)
const emit = defineEmits<{ 'toggle-labels': [] }>()

const route = useRoute()
const { t } = useI18n()
const { snapshot } = usePluginCatalog()
const pluginEntries = computed(() => snapshot.value.plugins.filter(plugin => plugin.status === 'active').flatMap(plugin => pluginNavigation(plugin).map(view => ({ plugin, view }))))
function pluginActive(id: string, view: { id: string; slot: string }) {
  if (route.params.pluginId !== id) return false
  const plugin = snapshot.value.plugins.find(plugin => plugin.manifest.id === id)
  const current = plugin && pluginPages(plugin).find(item => item.id === (route.params.viewId || pluginNavigation(plugin)[0]?.id))
  const workspaceEntries = plugin ? pluginNavigation(plugin).filter(entry => entry.slot === 'workspace') : []
  return current?.slot === 'workspace' && workspaceEntries.length === 1 ? view.slot === 'workspace' : current?.id === view.id
}
const canManageAgents = computed(() => isStoredSuperAdmin())

interface RailEntry {
  key: string
  route: string
  label: string
  admin?: boolean
  avatar?: string
  path?: string
}

const mainEntries = computed<RailEntry[]>(() => [
  { key: 'person', route: 'hermes.person', label: 'person.subtitle', avatar: deploymentUrl('/person/idle.gif') },
  { key: 'chat', route: 'hermes.chat', label: 'sidebar.singleChat', path: 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { key: 'history', route: 'hermes.history', label: 'sidebar.history', path: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2' },
  ...(canManageAgents.value ? [{ key: 'agents', route: 'hermes.agentManager', label: 'sidebar.agentManager', path: 'M12 8V4H8M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3M2 14h2M20 14h2M9 13v2M15 13v2' }] : []),
  { key: 'models', route: 'hermes.models', label: 'sidebar.models', path: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1' },
  { key: 'usage', route: 'hermes.usage', label: 'sidebar.usage', path: 'M3 12h4v9H3zM10 7h4v14h-4zM17 3h4v18h-4z' },
  { key: 'studioPlugins', route: 'studio.plugins', label: 'studioPlugins.title' },
])

/** App-level destinations, only rendered in the mobile drawer (`withAppEntries`). */
const appEntries: RailEntry[] = [
  { key: 'logs', route: 'hermes.logs', label: 'sidebar.logs', path: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { key: 'performance', route: 'hermes.performance', label: 'sidebar.performance', admin: true, path: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { key: 'skillsUsage', route: 'hermes.skillsUsage', label: 'sidebar.skillsUsage', path: 'M21.21 15.89A10 10 0 1 1 8.11 2.79M22 12A10 10 0 0 0 12 2v10z' },
  { key: 'versionPreview', route: 'hermes.versionPreview', label: 'sidebar.versionPreview', admin: true, path: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM7.5 4.21 12 6.81l4.5-2.6M7.5 19.79V14.6L3 12M21 12l-4.5 2.6v5.19M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12' },
  { key: 'theme', route: 'hermes.theme', label: 'sidebar.theme', path: 'M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-1.2a2.8 2.8 0 0 1-2.8-2.8V5c0-1.1-.9-2-2-2h-1z' },
  { key: 'petdex', route: 'hermes.petdex', label: 'sidebar.petdex', path: 'M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4zM9 11h.01M15 11h.01M9.5 15c1.6 1.1 3.4 1.1 5 0' },
  { key: 'profiles', route: 'hermes.profiles', label: 'sidebar.profiles', admin: true, path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { key: 'settings', route: 'hermes.settings', label: 'sidebar.settings', path: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
]

const entries = computed<RailEntry[]>(() => [
  ...mainEntries.value,
  ...(props.withAppEntries ? appEntries.filter(entry => !entry.admin || canManageAgents.value) : []),
])

const activeKey = computed(() => {
  const name = String(route.name || '')
  if (route.meta.hermesConfig || route.meta.ekkoConfig || route.meta.codingAgentConfig || route.name === 'studio.pluginAgentSettings') return 'agents'
  if (['hermes.chat', 'hermes.session', 'hermes.globalAgent', 'hermes.globalAgentSession'].includes(name)) return 'chat'
  if (name.startsWith('hermes.history')) return 'history'
  if (name === 'studio.pluginPage') return 'plugin:' + String(route.params.pluginId)
  return entries.value.find(entry => entry.route === name)?.key || 'settings'
})
const mobileNavigation = useMobileNavigation()
function handleNavigate(key: string) {
  if (mobileNavigation && (key.startsWith('plugin:') || ['studioPlugins', 'connections', 'agents', 'models', 'usage'].includes(key))) {
    mobileNavigation.open.value = false
  }
}
</script>

<template>
  <aside class="studio-navigation-rail" :class="{ 'studio-navigation-rail--labeled': labeled }">
    <PageSidebarFooter rail collapsed />
    <nav class="studio-navigation-rail__nav">
      <template v-for="entry in entries" :key="entry.key">
        <NTooltip placement="right" trigger="hover">
          <template #trigger>
            <RouteLinkItem class="studio-navigation-rail__item" :to="{ name: entry.route }" :active="activeKey === entry.key" :aria-label="t(entry.label)" @click="handleNavigate(entry.key)">
              <PluginSymbol v-if="entry.key === 'studioPlugins'" :size="22" />
              <img v-else-if="entry.avatar" class="studio-navigation-rail__avatar" :src="entry.avatar" width="32" height="32" alt="" aria-hidden="true" />
              <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="entry.path" /></svg>
              <span v-if="labeled" class="studio-navigation-rail__label">{{ t(entry.label) }}</span>
            </RouteLinkItem>
          </template>
          {{ t(entry.label) }}
        </NTooltip>
        <div v-if="entry.key === 'studioPlugins' && pluginEntries.length" class="studio-navigation-rail__plugins" role="group" :aria-label="t('studioPlugins.workspace')">
          <NTooltip v-for="{ plugin, view } in pluginEntries" :key="plugin.manifest.id + ':' + view.id" placement="right" trigger="hover">
            <template #trigger>
              <RouteLinkItem class="studio-navigation-rail__item" :to="pluginPageLocation(plugin, view.id)" :active="pluginActive(plugin.manifest.id, view)" :aria-label="view.title" @click="handleNavigate('plugin:' + plugin.manifest.id)">
                <PluginNavigationIcon :icon="view.icon" :size="22" />
                <span v-if="labeled" class="studio-navigation-rail__label">{{ view.title }}</span>
              </RouteLinkItem>
            </template>
            {{ view.title }}
          </NTooltip>
        </div>
      </template>
    </nav>
    <div class="studio-navigation-rail__bottom">
      <!-- The mobile drawer lists Settings as a row, so the bottom icon becomes the
           label toggle (the familiar hamburger collapse control). -->
      <button
        v-if="withAppEntries"
        class="studio-navigation-rail__item studio-navigation-rail__toggle"
        type="button"
        :aria-label="labeled ? t('sidebar.collapse') : t('sidebar.expand')"
        :aria-expanded="labeled"
        @click="emit('toggle-labels')"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        <span v-if="labeled" class="studio-navigation-rail__label">{{ labeled ? t('sidebar.collapse') : t('sidebar.expand') }}</span>
      </button>
      <NTooltip v-else placement="right" trigger="hover">
        <template #trigger>
          <RouteLinkItem class="studio-navigation-rail__item" :to="{ name: 'hermes.settings' }" :active="activeKey === 'settings'" :aria-label="t('sidebar.settings')">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </RouteLinkItem>
        </template>
        {{ t('sidebar.settings') }}
      </NTooltip>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

/// Must stay in sync with the drawer's RAIL_WIDTH (MobileNavigationDrawer.vue),
/// which sizes the NDrawer itself.
$rail-labeled-width: 140px;

.studio-navigation-rail {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 0 0 $navigation-rail-width;
  flex-direction: column;
  align-items: center;
  width: $navigation-rail-width;
  min-height: 0;
  padding: calc(12px * var(--spacing-scale, 1)) calc(8px * var(--spacing-scale, 1));
  background: transparent;

  :deep(.page-sidebar-bottom) { width: 100%; padding: 0 0 calc(16px * var(--spacing-scale, 1)); }
  :deep(.page-sidebar-account-btn) { height: 44px; padding: calc(4px * var(--spacing-scale, 1)); }
}
.studio-navigation-rail__nav {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: calc(8px * var(--spacing-scale, 1));
  overflow-y: auto;
  scrollbar-width: none;
}
.studio-navigation-rail__bottom { display: flex; flex-direction: column; gap: calc(8px * var(--spacing-scale, 1)); padding-top: 12px; }
.studio-navigation-rail__plugins { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; margin-bottom: 4px; border-bottom: 1px solid $border-color; }
.studio-navigation-rail__avatar { aspect-ratio: 1; flex-shrink: 0; border-radius: 4px; object-fit: contain; }
.studio-navigation-rail__item {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  color: $text-muted;
  border-radius: $radius-sm;
  text-decoration: none;
  transition: background-color $transition-fast, color $transition-fast;
  -webkit-app-region: no-drag;

  // Same glyph size as the labelled rows (18px) — the icon rail used to render
  // the 22px svg attribute, which read oversized next to the labelled mode.
  svg {
    width: 18px;
    height: 18px;
  }

  &:hover { color: $text-primary; background: rgba(var(--accent-primary-rgb), 0.06); }
  &.active { color: $accent-primary; background: rgba(var(--accent-primary-rgb), 0.12); }
  &:focus-visible { outline: 2px solid $accent-primary; outline-offset: -2px; }
}
.studio-navigation-rail__label {
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.studio-navigation-rail__toggle {
  border: 0;
  padding: 0;
  font: inherit;
  background: transparent;
  cursor: pointer;
}

// ── labelled mode (mobile drawer) ────────────────────────────────────────────
// Icon + text rows in a wider column; the same component keeps the icon-only
// rail on desktop, where these props are not passed.
.studio-navigation-rail--labeled {
  flex: 0 0 $rail-labeled-width;
  width: $rail-labeled-width;
  align-items: stretch;

  .studio-navigation-rail__nav { align-items: stretch; gap: 2px; }
  .studio-navigation-rail__bottom { align-items: stretch; }
  .studio-navigation-rail__plugins { align-items: stretch; }
  .studio-navigation-rail__item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    width: 100%;
    height: 38px;
    flex: 0 0 38px;
    padding: 0 10px;

    svg { flex: none; width: 18px; height: 18px; }
  }

  :deep(.page-sidebar-account-btn) { height: 38px; }
}
</style>
