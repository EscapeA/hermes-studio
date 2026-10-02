<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NTooltip } from 'naive-ui'
import { isStoredSuperAdmin } from '@/api/client'
import RouteLinkItem from '@/components/common/RouteLinkItem.vue'
import PageSidebarFooter from './PageSidebarFooter.vue'
import { useMobileNavigation } from '@/composables/usePageSidebar'

/** One shape of an icon; entries declare their parts so a multi-part glyph needs
 *  no v-html and stays lint-clean. */
interface RailIconPart {
  d?: string
  pts?: string
  l?: [string, string, string, string]
  c?: [string, string, string]
  r?: [string, string, string, string, string]
}
interface RailEntry {
  key: string
  route: string
  label: string
  admin?: boolean
  icon: RailIconPart[]
}

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
const canManageAgents = computed(() => isStoredSuperAdmin())

const chatEntry: RailEntry = {
  key: 'chat',
  route: 'hermes.chat',
  label: 'sidebar.chat',
  icon: [{ d: 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }],
}
const historyEntry: RailEntry = {
  key: 'history',
  route: 'hermes.history',
  label: 'sidebar.history',
  icon: [{ d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2' }],
}
const agentsEntry: RailEntry = {
  key: 'agents',
  route: 'hermes.agentManager',
  label: 'sidebar.agentManager',
  admin: true,
  icon: [{ d: 'M12 8V4H8M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3M2 14h2M20 14h2M9 13v2M15 13v2' }],
}
const modelsEntry: RailEntry = {
  key: 'models',
  route: 'hermes.models',
  label: 'sidebar.models',
  icon: [{ d: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1' }],
}

/** The app-level destinations, same routes/icons/labels as AppSidebar's nav list.
 *  Only rendered in the mobile drawer (`withAppEntries`), because the desktop rail
 *  is an icon-only column whose siblings are reachable from AppSidebar. */
const appEntries: RailEntry[] = [
  { key: 'logs', route: 'hermes.logs', label: 'sidebar.logs', icon: [{ d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }, { pts: '14 2 14 8 20 8' }, { l: ['16', '13', '8', '13'] }, { l: ['16', '17', '8', '17'] }, { pts: '10 9 9 9 8 9' }] },
  { key: 'usage', route: 'hermes.usage', label: 'sidebar.usage', icon: [{ r: ['3', '12', '4', '9', '1'] }, { r: ['10', '7', '4', '14', '1'] }, { r: ['17', '3', '4', '18', '1'] }] },
  { key: 'performance', route: 'hermes.performance', label: 'sidebar.performance', admin: true, icon: [{ pts: '22 12 18 12 15 21 9 3 6 12 2 12' }] },
  { key: 'skillsUsage', route: 'hermes.skillsUsage', label: 'sidebar.skillsUsage', icon: [{ d: 'M21.21 15.89A10 10 0 1 1 8.11 2.79' }, { d: 'M22 12A10 10 0 0 0 12 2v10z' }] },
  { key: 'versionPreview', route: 'hermes.versionPreview', label: 'sidebar.versionPreview', admin: true, icon: [{ d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }, { pts: '7.5 4.21 12 6.81 16.5 4.21' }, { pts: '7.5 19.79 7.5 14.6 3 12' }, { pts: '21 12 16.5 14.6 16.5 19.79' }, { pts: '3.27 6.96 12 12.01 20.73 6.96' }, { l: ['12', '22.08', '12', '12'] }] },
  { key: 'theme', route: 'hermes.theme', label: 'sidebar.theme', icon: [{ c: ['13.5', '6.5', '2.5'] }, { c: ['17.5', '10.5', '2.5'] }, { c: ['8.5', '7.5', '2.5'] }, { d: 'M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-1.2a2.8 2.8 0 0 1-2.8-2.8V5c0-1.1-.9-2-2-2h-1z' }] },
  { key: 'petdex', route: 'hermes.petdex', label: 'sidebar.petdex', icon: [{ d: 'M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z' }, { d: 'M9 11h.01' }, { d: 'M15 11h.01' }, { d: 'M9.5 15c1.6 1.1 3.4 1.1 5 0' }] },
  { key: 'profiles', route: 'hermes.profiles', label: 'sidebar.profiles', admin: true, icon: [{ d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }, { c: ['12', '7', '4'] }] },
  { key: 'settings', route: 'hermes.settings', label: 'sidebar.settings', icon: [{ c: ['12', '12', '3'] }, { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }] },
]

const entries = computed(() => [
  chatEntry,
  historyEntry,
  ...(canManageAgents.value ? [agentsEntry] : []),
  modelsEntry,
  ...(props.withAppEntries ? appEntries.filter(entry => !entry.admin || canManageAgents.value) : []),
])

const activeKey = computed(() => {
  const name = String(route.name || '')
  if (route.meta.hermesConfig || route.meta.ekkoConfig || route.meta.codingAgentConfig) return 'agents'
  if (['hermes.chat', 'hermes.session', 'hermes.globalAgent', 'hermes.globalAgentSession'].includes(name)) return 'chat'
  if (name.startsWith('hermes.history')) return 'history'
  return entries.value.find(entry => entry.route === name)?.key || 'settings'
})
const mobileNavigation = useMobileNavigation()
function handleNavigate(key: string) {
  if (mobileNavigation && ['agents', 'models'].includes(key)) {
    mobileNavigation.open.value = false
  }
}
</script>

<template>
  <aside class="studio-navigation-rail" :class="{ 'studio-navigation-rail--labeled': labeled }">
    <PageSidebarFooter rail collapsed />
    <nav class="studio-navigation-rail__nav">
      <NTooltip v-for="entry in entries" :key="entry.key" placement="right" trigger="hover">
        <template #trigger>
          <RouteLinkItem
            class="studio-navigation-rail__item"
            :to="{ name: entry.route }"
            :active="activeKey === entry.key"
            :aria-label="t(entry.label)"
            @click="handleNavigate(entry.key)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <template v-for="(part, index) in entry.icon" :key="index">
                <path v-if="part.d" :d="part.d" />
                <polyline v-else-if="part.pts" :points="part.pts" />
                <line v-else-if="part.l" :x1="part.l[0]" :y1="part.l[1]" :x2="part.l[2]" :y2="part.l[3]" />
                <circle v-else-if="part.c" :cx="part.c[0]" :cy="part.c[1]" :r="part.c[2]" />
                <rect v-else-if="part.r" :x="part.r[0]" :y="part.r[1]" :width="part.r[2]" :height="part.r[3]" :rx="part.r[4]" />
              </template>
            </svg>
            <span v-if="labeled" class="studio-navigation-rail__label">{{ t(entry.label) }}</span>
          </RouteLinkItem>
        </template>
        {{ t(entry.label) }}
      </NTooltip>
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
  padding: 12px 8px;
  background: $bg-sidebar;

  :deep(.page-sidebar-bottom) { width: 100%; padding: 0 0 16px; }
  :deep(.page-sidebar-account-btn) { height: 44px; padding: 4px; }
}
.studio-navigation-rail__nav {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  overflow-y: auto;
  scrollbar-width: none;
}
.studio-navigation-rail__bottom { display: flex; flex-direction: column; gap: 8px; padding-top: 12px; }.studio-navigation-rail__item {
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
