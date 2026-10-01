<script setup lang="ts">
import { NDrawer } from 'naive-ui'
import StudioNavigationRail from './StudioNavigationRail.vue'

defineProps<{ show: boolean; hasSidebar: boolean }>()
const emit = defineEmits<{
  'update:show': [show: boolean]
  target: [element: HTMLElement | null]
}>()
</script>

<template>
  <NDrawer
    :show="show"
    :width="hasSidebar ? 'var(--studio-drawer-width)' : 64"
    placement="left"
    display-directive="show"
    class="studio-mobile-drawer"
    @update:show="emit('update:show', $event)"
  >
    <div class="studio-mobile-navigation">
      <StudioNavigationRail />
      <section v-show="hasSidebar" class="studio-mobile-navigation__panel">
        <div :ref="element => emit('target', element as HTMLElement | null)" class="studio-mobile-navigation__content" />
      </section>
    </div>
  </NDrawer>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.studio-mobile-navigation {
  // Top inset shared by the drawer's two columns. The K60 WebView shell reports
  // ~99px of top safe-area while drawing nothing in it, which read as a dead band
  // above the session list; Aries settled on 0 (fully flush). Raise this single
  // value if a device ever renders under the system bar / camera cutout.
  --drawer-top-inset: 0px;
  display: flex;
  height: 100%;
  min-height: 0;
  background: $bg-sidebar-surface;
  border-top-right-radius: 5px;
  border-bottom-right-radius: 5px;
  overflow: hidden;

  :deep(.studio-navigation-rail) {
    padding-top: var(--drawer-top-inset);
    padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
  }
}
.studio-mobile-navigation__panel {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  // Same shared inset as the rail, so the search row and the rail's first icon
  // stay on one axis.
  padding-top: var(--drawer-top-inset);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-inline-start: 1px solid $border-color;
}

.studio-mobile-navigation .studio-mobile-navigation__content {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;

  // Page-owned sidebars become the second column inside the shared drawer.
  > :deep(*) {
    position: static;
    inset: auto;
    flex: 1;
    width: 100%;
    min-width: 0;
    height: 100%;
    max-height: none;
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    transform: none;
    transition: none;
    opacity: 1;
    pointer-events: auto;
  }

  // Keep each page sidebar's own close control working inside the drawer (it is
  // the single close affordance now that the drawer's own X row is gone); only
  // the desktop-only collapse toggles are suppressed.
  :deep(.workflow-sidebar-close),
  :deep(.collapse-btn),
  :deep(.hermes-config-collapse),
  :deep(.ekko-config-collapse),
  :deep(.coding-agent-config-collapse) { display: none; }
}
</style>
