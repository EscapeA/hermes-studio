<script setup lang="ts">
import { computed, ref } from 'vue'
import { NDrawer } from 'naive-ui'
import StudioNavigationRail from './StudioNavigationRail.vue'

const props = defineProps<{ show: boolean; hasSidebar: boolean }>()
const emit = defineEmits<{
  'update:show': [show: boolean]
  target: [element: HTMLElement | null]
}>()

/** Rail widths — keep in sync with $rail-labeled-width in StudioNavigationRail.vue
 *  and $navigation-rail-width (styles/variables.scss) for the collapsed rail. */
const RAIL_WIDTH = { collapsed: 52, labeled: 140 } as const
const LABELS_STORAGE_KEY = 'hermes_mobile_drawer_labels'

function storedLabelsOpen(): boolean {
  try {
    return window.localStorage.getItem(LABELS_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

const labelsOpen = ref(storedLabelsOpen())

function toggleLabels() {
  labelsOpen.value = !labelsOpen.value
  try {
    window.localStorage.setItem(LABELS_STORAGE_KEY, labelsOpen.value ? '1' : '0')
  } catch {
    /* private mode: keep the session-only state */
  }
}

/** The drawer column plus a ≥70px strip of mask that stays tappable on the right:
 *  tapping that strip is the only close affordance now (the panel's × is gone), so
 *  the width must leave enough mask visible to hit on a phone. */
const drawerWidth = computed(() =>
  props.hasSidebar
    ? `min(320px, calc(100vw - 70px))`
    : `${labelsOpen.value ? RAIL_WIDTH.labeled : RAIL_WIDTH.collapsed}px`,
)
</script>

<template>
  <NDrawer
    :show="show"
    :width="drawerWidth"
    placement="left"
    display-directive="show"
    class="studio-mobile-drawer"
    @update:show="emit('update:show', $event)"
  >
    <div class="studio-mobile-navigation">
      <StudioNavigationRail :labeled="labelsOpen" with-app-entries @toggle-labels="toggleLabels" />
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
  // Frosted drawer surface. This container is the only glass layer: the rail and
  // the page column inside are transparent (below), because two translucent
  // columns would double-tint the backdrop. Same recipe as the app's other glass
  // sidebars so the strength follows the theme (`--glass-sidebar-bg`).
  background-color: var(--glass-sidebar-bg);
  -webkit-backdrop-filter: blur(12px) saturate(110%);
  backdrop-filter: blur(12px) saturate(110%);

  :deep(.studio-navigation-rail) {
    // Drop the rail's own opaque column so the container's glass shows through.
    background-color: transparent;
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
    // Transparent so the drawer's frosted surface (on the container) is the one
    // visible layer instead of an opaque panel sitting on it.
    background-color: transparent;
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

<!-- Unscoped on purpose: naive-ui renders the drawer root and its mask as siblings
     outside this component's DOM subtree (the mask is not a descendant of the
     root), so a scoped selector cannot reach either. `:has()` keeps the override
     tied to THIS drawer — the app's other NDrawers (new chat, voice, kanban) keep
     naive's defaults. -->
<style lang="scss">
.n-drawer-container:has(.studio-mobile-drawer) {
  // naive's drawer paints the modal colour opaque; left in place it covers the
  // frosted surface inside it.
  .studio-mobile-drawer {
    --n-color: transparent;
    background-color: transparent;
  }

  // Lighter scrim than naive's 0.3: a heavy mask under a translucent panel reads
  // as dirty grey, and the strip right of the drawer is the close target, so what
  // shows through it stays legible.
  > .n-drawer-mask {
    background-color: rgba(0, 0, 0, 0.18);
  }
}
</style>
