<script setup lang="ts">
import { computed, h } from 'vue'
import { NDropdown, type DropdownOption } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useTheme, type ThemeStyle } from '@/composables/useTheme'
import { STYLE_LABEL_KEYS, STYLE_SWATCH, THEME_STYLES } from '@/styles/theme-style'

const { t } = useI18n()
const { isDark, style, styleForcesDark, setStyle, toggleBrightness } = useTheme()

function checkIcon() {
  return h(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2.4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [h('polyline', { points: '20 6 9 17 4 12' })],
  )
}

// Seven styles no longer fit a two-state toggle, so the palette button opens
// the full list and marks the active one instead of cycling through them.
// Each row carries a swatch (the style's accent on its own surface) so the
// list stays scannable on a phone without previewing every style in turn.
// Inline styles on purpose: the dropdown menu is teleported out of this
// component's scoped-style scope.
function swatch(value: ThemeStyle) {
  const { accent, surface } = STYLE_SWATCH[value]
  return h(
    'span',
    {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '14px',
        height: '14px',
        borderRadius: '4px',
        backgroundColor: surface,
        border: `1px solid ${accent}`,
        marginRight: '8px',
        verticalAlign: '-2px',
        flexShrink: '0',
      },
    },
    [h('span', {
      style: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: accent,
      },
    })],
  )
}

const styleOptions = computed<DropdownOption[]>(() =>
  THEME_STYLES.map(value => ({
    key: value,
    label: () => h(
      'span',
      { style: { display: 'inline-flex', alignItems: 'center' } },
      [swatch(value), t(STYLE_LABEL_KEYS[value])],
    ),
    icon: value === style.value ? checkIcon : undefined,
  })),
)

function selectStyle(key: string) {
  setStyle(key as ThemeStyle)
}
</script>

<template>
  <div class="theme-switch-container" style="display: flex; gap: 4px; align-items: center;">
    <NDropdown
      trigger="click"
      placement="top-start"
      :options="styleOptions"
      @select="selectStyle"
    >
      <button class="theme-switch" :title="t(STYLE_LABEL_KEYS[style])">
        <!-- Palette icon -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      </button>
    </NDropdown>
    <button
      class="theme-switch"
      :disabled="styleForcesDark"
      :title="isDark ? 'Light mode' : 'Dark mode'"
      @click="toggleBrightness"
    >
      <!-- Sun icon (shown in dark mode) -->
      <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <!-- Moon icon (shown in light mode) -->
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
.theme-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.15s ease, background-color 0.15s ease;

  &:hover {
    color: var(--text-primary);
    background: rgba(var(--accent-primary-rgb), 0.06);
  }

  // Brightness is pinned by dark-locked styles (tech / terminal).
  &:disabled {
    cursor: default;
    opacity: 0.35;

    &:hover {
      color: var(--text-muted);
      background: transparent;
    }
  }
}
</style>
