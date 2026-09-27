import type { GlobalThemeOverrides } from 'naive-ui'
import { DEFAULT_THEME_STYLE, type ThemeStyle } from './theme-style'
import {
  resolveThemeCustomization,
  type ThemeCustomization,
} from './theme-customization'

export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#333333',
    primaryColorHover: '#1a1a1a',
    primaryColorPressed: '#000000',
    primaryColorSuppl: '#333333',
    bodyColor: '#fafafa',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    inputColor: '#ffffff',
    actionColor: '#f0f0f0',
    textColorBase: '#1a1a1a',
    textColor1: '#1a1a1a',
    textColor2: '#666666',
    textColor3: '#999999',
    dividerColor: '#e0e0e0',
    borderColor: '#e0e0e0',
    hoverColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    fontSize: '14px',
    fontSizeMedium: '14px',
    heightMedium: '36px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontFamilyMono: 'JetBrains Mono, Fira Code, Consolas, monospace',
  },
  Layout: {
    color: '#fafafa',
    siderColor: '#f5f5f5',
    headerColor: '#fafafa',
  },
  Menu: {
    itemTextColorActive: '#1a1a1a',
    itemTextColorActiveHover: '#1a1a1a',
    itemTextColorChildActive: '#1a1a1a',
    itemIconColorActive: '#1a1a1a',
    itemIconColorActiveHover: '#000000',
    itemColorActive: 'rgba(0, 0, 0, 0.06)',
    itemColorActiveHover: 'rgba(0, 0, 0, 0.1)',
    arrowColorActive: '#1a1a1a',
  },
  Button: {
    textColorPrimary: '#ffffff',
    colorPrimary: '#333333',
    colorHoverPrimary: '#1a1a1a',
    colorPressedPrimary: '#000000',
  },
  Input: {
    color: '#ffffff',
    colorFocus: '#ffffff',
    border: '1px solid #e0e0e0',
    borderHover: '1px solid #999999',
    borderFocus: '1px solid #333333',
    borderDisabled: '1px solid #ebebeb',
    groupLabelBorder: '1px solid #e0e0e0',
    placeholderColor: '#999999',
    caretColor: '#1a1a1a',
  },
  InternalSelection: {
    border: '1px solid #e0e0e0',
    borderHover: '1px solid #999999',
    borderActive: '1px solid #333333',
    borderFocus: '1px solid #333333',
  },
  Card: {
    color: '#ffffff',
    borderColor: '#e0e0e0',
  },
  Modal: {
    color: '#ffffff',
  },
  Tag: {
    borderRadius: '6px',
  },
}

export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#e0e0e0',
    primaryColorHover: '#f5f5f5',
    primaryColorPressed: '#ffffff',
    primaryColorSuppl: '#e0e0e0',
    bodyColor: '#1a1a1a',
    cardColor: '#2a2a2a',
    modalColor: '#2a2a2a',
    popoverColor: '#2a2a2a',
    tableColor: '#2a2a2a',
    inputColor: '#2a2a2a',
    actionColor: '#252525',
    textColorBase: '#e0e0e0',
    textColor1: '#e0e0e0',
    textColor2: '#a0a0a0',
    textColor3: '#666666',
    dividerColor: '#3a3a3a',
    borderColor: '#3a3a3a',
    hoverColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    fontSize: '14px',
    fontSizeMedium: '14px',
    heightMedium: '36px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontFamilyMono: 'JetBrains Mono, Fira Code, Consolas, monospace',
  },
  Layout: {
    color: '#1a1a1a',
    siderColor: '#202020',
    headerColor: '#1a1a1a',
  },
  Menu: {
    itemTextColorActive: '#e0e0e0',
    itemTextColorActiveHover: '#e0e0e0',
    itemTextColorChildActive: '#e0e0e0',
    itemIconColorActive: '#e0e0e0',
    itemIconColorActiveHover: '#ffffff',
    itemColorActive: 'rgba(255, 255, 255, 0.08)',
    itemColorActiveHover: 'rgba(255, 255, 255, 0.12)',
    arrowColorActive: '#e0e0e0',
  },
  Button: {
    textColorPrimary: '#1a1a1a',
    colorPrimary: '#e0e0e0',
    colorHoverPrimary: '#f5f5f5',
    colorPressedPrimary: '#ffffff',
  },
  Input: {
    color: '#2a2a2a',
    colorFocus: '#2a2a2a',
    border: '1px solid #555555',
    borderHover: '1px solid #777777',
    borderFocus: '1px solid #e0e0e0',
    borderDisabled: '1px solid #3a3a3a',
    groupLabelBorder: '1px solid #555555',
    placeholderColor: '#666666',
    caretColor: '#e0e0e0',
  },
  InternalSelection: {
    border: '1px solid #555555',
    borderHover: '1px solid #777777',
    borderActive: '1px solid #e0e0e0',
    borderFocus: '1px solid #e0e0e0',
  },
  Card: {
    color: '#2a2a2a',
    borderColor: '#3a3a3a',
  },
  Modal: {
    color: '#2a2a2a',
  },
  Tag: {
    borderRadius: '6px',
  },
  Switch: {
    railColor: '#3a3a3a',
    railColorActive: '#e0e0e0',
    loadingColor: '#e0e0e0',
    opacityDisabled: 0.4,
  },
}

const COMIC_FONT_FAMILY = "'Comic Neue', 'ZCOOL KuaiLe', 'Zen Maru Gothic', 'Gaegu', cursive, sans-serif"
const MONO_FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
const DEFAULT_FONT_FAMILY = 'Inter, system-ui, -apple-system, sans-serif'

/**
 * Styles share one override shape and differ only in color, so they are
 * described by one palette instead of a hand-written override tree per style
 * (those drift apart). A palette is brightness-agnostic: forced-dark styles
 * use a single palette, `blueprint` pairs a light and a dark one.
 * Keep every value in sync with the matching block in variables.scss.
 */
interface StylePalette {
  /** Accent ramp — buttons, switches, focused borders, active menu items. */
  primary: string
  primaryHover: string
  primaryPressed: string
  /** Text that sits on top of an accent fill. */
  textOnPrimary: string
  /** Page background. */
  body: string
  /** Raised surfaces: cards, modals, popovers, tables, inputs. */
  surface: string
  /** Muted surface behind menus/actions. */
  action: string
  sider: string
  /** Body text ramp. */
  text1: string
  text2: string
  text3: string
  border: string
  /** Input/selection outlines, one step brighter than `border`. */
  borderStrong: string
  borderHover: string
  hover: string
  menuActive: string
  menuActiveHover: string
  fontFamily?: string
  /** Opt out of the focus halo — the T1 "cold engineering" register uses a
   *  crisp ring instead, matching its no-glow reference sites. */
  noFocusGlow?: boolean
  /** Corner radius for naive-ui surfaces; defaults to the ink values. The
   *  global SCSS radii are compile-time constants shared by 61 components, so
   *  a style can only re-shape the naive-ui layer — layer-level sharpness is
   *  expressed with borders instead. */
  borderRadius?: string
  borderRadiusSmall?: string
}

function styleOverrides(palette: StylePalette): GlobalThemeOverrides {
  return {
    common: {
      primaryColor: palette.primary,
      primaryColorHover: palette.primaryHover,
      primaryColorPressed: palette.primaryPressed,
      primaryColorSuppl: palette.primary,
      bodyColor: palette.body,
      cardColor: palette.surface,
      modalColor: palette.surface,
      popoverColor: palette.surface,
      tableColor: palette.surface,
      inputColor: palette.surface,
      actionColor: palette.action,
      textColorBase: palette.text1,
      textColor1: palette.text1,
      textColor2: palette.text2,
      textColor3: palette.text3,
      dividerColor: palette.border,
      borderColor: palette.border,
      hoverColor: palette.hover,
      borderRadius: palette.borderRadius ?? '8px',
      borderRadiusSmall: palette.borderRadiusSmall ?? '6px',
      fontSize: '14px',
      fontSizeMedium: '14px',
      heightMedium: '36px',
      fontFamily: palette.fontFamily ?? DEFAULT_FONT_FAMILY,
      fontFamilyMono: MONO_FONT_FAMILY,
    },
    Layout: {
      color: palette.body,
      siderColor: palette.sider,
      headerColor: palette.body,
    },
    Menu: {
      itemTextColorActive: palette.text1,
      itemTextColorActiveHover: palette.text1,
      itemTextColorChildActive: palette.text1,
      itemIconColorActive: palette.text1,
      itemIconColorActiveHover: palette.primaryHover,
      itemColorActive: palette.menuActive,
      itemColorActiveHover: palette.menuActiveHover,
      arrowColorActive: palette.text1,
    },
    Button: {
      textColorPrimary: palette.textOnPrimary,
      colorPrimary: palette.primary,
      colorHoverPrimary: palette.primaryHover,
      colorPressedPrimary: palette.primaryPressed,
    },
    Input: {
      color: palette.surface,
      colorFocus: palette.surface,
      border: `1px solid ${palette.borderStrong}`,
      borderHover: `1px solid ${palette.borderHover}`,
      borderFocus: `1px solid ${palette.primary}`,
      borderDisabled: `1px solid ${palette.border}`,
      groupLabelBorder: `1px solid ${palette.borderStrong}`,
      placeholderColor: palette.text3,
      caretColor: palette.primary,
      // 8-digit hex keeps the accent's alpha in one value; the halo is skipped
      // for styles that opt out (see noFocusGlow).
      boxShadowFocus: palette.noFocusGlow
        ? `0 0 0 2px ${palette.primary}9e`
        : `0 0 0 2px ${palette.primary}33, 0 0 16px ${palette.primary}47`,
      boxShadowActive: `0 0 0 2px ${palette.primary}33`,
    },
    InternalSelection: {
      border: `1px solid ${palette.borderStrong}`,
      borderHover: `1px solid ${palette.borderHover}`,
      borderActive: `1px solid ${palette.primary}`,
      borderFocus: `1px solid ${palette.primary}`,
      boxShadowActive: palette.noFocusGlow
        ? `0 0 0 2px ${palette.primary}9e`
        : `0 0 0 2px ${palette.primary}33, 0 0 16px ${palette.primary}47`,
      boxShadowFocus: palette.noFocusGlow
        ? `0 0 0 2px ${palette.primary}9e`
        : `0 0 0 2px ${palette.primary}33, 0 0 16px ${palette.primary}47`,
    },
    Card: {
      color: palette.surface,
      borderColor: palette.border,
    },
    Modal: {
      color: palette.surface,
    },
    Tag: {
      borderRadius: '6px',
    },
    Switch: {
      railColor: palette.border,
      railColorActive: palette.primary,
      loadingColor: palette.primary,
      opacityDisabled: 0.4,
    },
  }
}

// 科技蓝 · 深空 HUD — near-black navy surfaces, a cyan accent and glassy
// raised panels. Paired with the `.dark.tech` block and the tech layers in
// styles/style-layers.scss.
const TECH_PALETTE: StylePalette = {
  primary: '#22d3ee',
  primaryHover: '#67e8f9',
  primaryPressed: '#0ea5c4',
  textOnPrimary: '#04121a',
  body: '#070a12',
  surface: '#0c111c',
  action: '#121a29',
  sider: '#0a0f1a',
  text1: '#e6edf7',
  text2: '#9fb0c9',
  text3: '#64748b',
  border: '#1a2438',
  borderStrong: '#22304a',
  borderHover: '#2f4a6b',
  hover: 'rgba(148, 190, 255, 0.08)',
  menuActive: 'rgba(34, 211, 238, 0.14)',
  menuActiveHover: 'rgba(34, 211, 238, 0.24)',
}

// 霓虹赛博 — near-black canvas with a cyan/magenta neon pair and scanlines.
const NEON_PALETTE: StylePalette = {
  primary: '#00e5ff',
  primaryHover: '#5cf0ff',
  primaryPressed: '#00b8cc',
  textOnPrimary: '#04121a',
  body: '#05060a',
  surface: '#0a0d14',
  action: '#080b11',
  sider: '#04050a',
  text1: '#d7f7ff',
  text2: '#90c7d4',
  text3: '#5f8894',
  border: '#10333d',
  borderStrong: '#1a4d5c',
  borderHover: '#2a7a90',
  hover: 'rgba(0, 229, 255, 0.09)',
  menuActive: 'rgba(0, 229, 255, 0.14)',
  menuActiveHover: 'rgba(0, 229, 255, 0.24)',
}

// 渐变空间舱 — deep indigo with aurora light behind glass panels.
const AURORA_PALETTE: StylePalette = {
  primary: '#8b5cf6',
  primaryHover: '#a78bfa',
  primaryPressed: '#7c3aed',
  textOnPrimary: '#ffffff',
  body: '#0a0a14',
  surface: '#14142a',
  action: '#101024',
  sider: '#0c0c1a',
  text1: '#eceaff',
  text2: '#a9a3cc',
  text3: '#6f6a8f',
  border: '#23233d',
  borderStrong: '#33335a',
  borderHover: '#4a4a7a',
  hover: 'rgba(139, 92, 246, 0.10)',
  menuActive: 'rgba(139, 92, 246, 0.16)',
  menuActiveHover: 'rgba(139, 92, 246, 0.26)',
}

// 蓝图 — light-first: grid paper with ink-blue line work. Unlike the other
// styled themes this one follows the user's brightness, so it ships a pair.
const BLUEPRINT_LIGHT_PALETTE: StylePalette = {
  primary: '#0b6bcb',
  primaryHover: '#0f82f0',
  primaryPressed: '#0955a3',
  textOnPrimary: '#ffffff',
  body: '#f4f7fb',
  surface: '#ffffff',
  action: '#eaf1f9',
  sider: '#eaf0f7',
  text1: '#10233a',
  text2: '#46617f',
  text3: '#7c93ab',
  border: '#cfdcea',
  borderStrong: '#b3c8dc',
  borderHover: '#8fadc9',
  hover: 'rgba(11, 107, 203, 0.06)',
  menuActive: 'rgba(11, 107, 203, 0.10)',
  menuActiveHover: 'rgba(11, 107, 203, 0.16)',
}

const BLUEPRINT_DARK_PALETTE: StylePalette = {
  primary: '#38bdf8',
  primaryHover: '#7dd3fc',
  primaryPressed: '#0ea5e9',
  textOnPrimary: '#04141f',
  body: '#0d1b2a',
  surface: '#122436',
  action: '#0f1f2f',
  sider: '#0b1725',
  text1: '#d7e6f5',
  text2: '#93aec7',
  text3: '#62809b',
  border: '#1e3448',
  borderStrong: '#2a4761',
  borderHover: '#3a5f80',
  hover: 'rgba(120, 180, 240, 0.08)',
  menuActive: 'rgba(56, 189, 248, 0.14)',
  menuActiveHover: 'rgba(56, 189, 248, 0.24)',
}

// 冷峻工程 (graphite) — Linear / Vercel / x.ai register: near-black, no
// shadows, no gradients, no glow. Separation comes from hairline translucent
// borders and a single indigo accent; the naive-ui layer is sharper too.
const GRAPHITE_PALETTE: StylePalette = {
  noFocusGlow: true,
  primary: '#5e6ad2',
  primaryHover: '#7170ff',
  primaryPressed: '#4f5ab8',
  textOnPrimary: '#ffffff',
  body: '#08090a',
  surface: '#101113',
  action: '#0c0d0f',
  sider: '#0a0b0c',
  text1: '#f7f8f8',
  text2: '#8a8f98',
  text3: '#62666d',
  border: '#1c1d20',
  borderStrong: '#26282c',
  borderHover: '#3a3d44',
  hover: 'rgba(255, 255, 255, 0.05)',
  menuActive: 'rgba(94, 106, 210, 0.16)',
  menuActiveHover: 'rgba(94, 106, 210, 0.24)',
  borderRadius: '6px',
  borderRadiusSmall: '4px',
}

// 暖调暗 (warm) — Warp / OpenCode register: warm near-black, warm off-white
// text and no chromatic accent (the primary is warm paper-white, so buttons
// read as ink on paper). A single warm orange carries "info".
const WARM_PALETTE: StylePalette = {
  primary: '#e6dccd',
  primaryHover: '#f5ecdd',
  primaryPressed: '#d5c9b6',
  textOnPrimary: '#1f1b19',
  body: '#201d1d',
  surface: '#292525',
  action: '#252121',
  sider: '#1b1818',
  text1: '#fdfcfc',
  text2: '#b9b2ad',
  text3: '#8a817b',
  border: '#3a3433',
  borderStrong: '#4a4341',
  borderHover: '#6b615d',
  hover: 'rgba(255, 240, 220, 0.05)',
  menuActive: 'rgba(230, 220, 205, 0.14)',
  menuActiveHover: 'rgba(230, 220, 205, 0.22)',
}

// 终端黑 — pure black with phosphor-green text and a monospace UI font.
const TERMINAL_PALETTE: StylePalette = {
  primary: '#63d96b',
  primaryHover: '#7fe585',
  primaryPressed: '#4dbd55',
  textOnPrimary: '#000000',
  body: '#000000',
  surface: '#0a0f0a',
  action: '#070b07',
  sider: '#040604',
  text1: '#63d96b',
  text2: '#55c95d',
  text3: '#3f9d47',
  border: '#1f4d1f',
  borderStrong: '#2a6b2a',
  borderHover: '#3d8f3d',
  hover: 'rgba(99, 217, 107, 0.1)',
  menuActive: 'rgba(99, 217, 107, 0.14)',
  menuActiveHover: 'rgba(99, 217, 107, 0.22)',
  fontFamily: MONO_FONT_FAMILY,
}

export const techThemeOverrides: GlobalThemeOverrides = styleOverrides(TECH_PALETTE)
export const terminalThemeOverrides: GlobalThemeOverrides = styleOverrides(TERMINAL_PALETTE)
export const neonThemeOverrides: GlobalThemeOverrides = styleOverrides(NEON_PALETTE)
export const auroraThemeOverrides: GlobalThemeOverrides = styleOverrides(AURORA_PALETTE)
export const blueprintLightThemeOverrides: GlobalThemeOverrides = styleOverrides(BLUEPRINT_LIGHT_PALETTE)
export const blueprintDarkThemeOverrides: GlobalThemeOverrides = styleOverrides(BLUEPRINT_DARK_PALETTE)

/**
 * One entry per styled theme. Adding a style is a single line here plus its
 * palette above — `getThemeOverrides` never needs a new branch.
 * Forced-dark styles repeat the same palette for both brightnesses because
 * they are only ever rendered with the `dark` class (STYLE_FORCES_DARK).
 */
const STYLE_PALETTES: Partial<Record<ThemeStyle, { light: StylePalette; dark: StylePalette }>> = {
  tech: { light: TECH_PALETTE, dark: TECH_PALETTE },
  terminal: { light: TERMINAL_PALETTE, dark: TERMINAL_PALETTE },
  neon: { light: NEON_PALETTE, dark: NEON_PALETTE },
  aurora: { light: AURORA_PALETTE, dark: AURORA_PALETTE },
  blueprint: { light: BLUEPRINT_LIGHT_PALETTE, dark: BLUEPRINT_DARK_PALETTE },
  graphite: { light: GRAPHITE_PALETTE, dark: GRAPHITE_PALETTE },
  warm: { light: WARM_PALETTE, dark: WARM_PALETTE },
}

/** Base overrides for a style, falling back to the original ink pair. */
export function styleBaseOverrides(isDark: boolean, style: ThemeStyle): GlobalThemeOverrides {
  const pair = STYLE_PALETTES[style]
  if (pair) return styleOverrides(isDark ? pair.dark : pair.light)
  return isDark ? darkThemeOverrides : lightThemeOverrides
}

export function getThemeOverrides(
  isDark: boolean,
  style: ThemeStyle = DEFAULT_THEME_STYLE,
  customization?: ThemeCustomization,
): GlobalThemeOverrides {
  const base = styleBaseOverrides(isDark, style)
  // Comic swaps in a hand-drawn font family; the terminal palette already
  // carries its monospace font through `common.fontFamily`.
  const comicFont = style === 'comic' ? COMIC_FONT_FAMILY : undefined
  if (!comicFont && !customization) return base
  const custom = customization ? resolveThemeCustomization(customization, isDark) : null
  const common = {
    ...base.common!,
    ...(comicFont ? { fontFamily: comicFont } : {}),
    ...(custom ? {
      fontSize: `${custom.fontSize}px`,
      fontSizeMedium: `${custom.fontSize}px`,
    } : {}),
    ...(custom?.textPrimary ? {
      textColorBase: custom.textPrimary,
      textColor1: custom.textPrimary,
      textColor2: custom.textSecondary,
      textColor3: custom.textMuted,
    } : {}),
    ...(custom?.accentPrimary ? {
      primaryColor: custom.accentPrimary,
      primaryColorHover: custom.accentHover,
      primaryColorPressed: custom.accentHover,
      primaryColorSuppl: custom.accentPrimary,
    } : {}),
  }
  const input = custom?.textPrimary || custom?.accentPrimary
    ? {
        ...base.Input,
        ...(custom?.textPrimary ? {
          textColor: custom.textPrimary,
          placeholderColor: custom.textMuted,
          caretColor: custom.textPrimary,
        } : {}),
        ...(custom?.accentPrimary && custom.accentPrimaryRgb ? {
          border: `1px solid rgba(${custom.accentPrimaryRgb}, 0.18)`,
          borderHover: `1px solid rgba(${custom.accentPrimaryRgb}, 0.32)`,
          borderFocus: `1px solid ${custom.accentPrimary}`,
          groupLabelBorder: `1px solid rgba(${custom.accentPrimaryRgb}, 0.18)`,
        } : {}),
      }
    : null
  const internalSelection = custom?.textPrimary || custom?.accentPrimary
    ? {
        ...base.InternalSelection,
        ...(custom?.textPrimary ? {
          textColor: custom.textPrimary,
          placeholderColor: custom.textMuted,
          placeholderColorDisabled: custom.textMuted,
          caretColor: custom.textPrimary,
        } : {}),
        ...(custom?.accentPrimary && custom.accentPrimaryRgb ? {
          border: `1px solid rgba(${custom.accentPrimaryRgb}, 0.18)`,
          borderHover: `1px solid rgba(${custom.accentPrimaryRgb}, 0.32)`,
          borderActive: `1px solid ${custom.accentPrimary}`,
          borderFocus: `1px solid ${custom.accentPrimary}`,
          boxShadowActive: `0 0 0 2px rgba(${custom.accentPrimaryRgb}, 0.2)`,
          boxShadowFocus: `0 0 0 2px rgba(${custom.accentPrimaryRgb}, 0.2)`,
          loadingColor: custom.accentPrimary,
        } : {}),
      }
    : null

  return {
    ...base,
    common,
    ...(input ? { Input: input } : {}),
    ...(internalSelection ? { InternalSelection: internalSelection } : {}),
    ...(custom?.accentPrimary ? {
      Button: {
        ...base.Button,
        textColorPrimary: custom.textOnAccent,
        colorPrimary: custom.accentPrimary,
        colorHoverPrimary: custom.accentHover,
        colorPressedPrimary: custom.accentHover,
      },
      Switch: {
        ...base.Switch,
        railColorActive: custom.accentPrimary,
        loadingColor: custom.accentPrimary,
        boxShadowFocus: custom.accentPrimaryRgb
          ? `0 0 0 2px rgba(${custom.accentPrimaryRgb}, 0.3)`
          : base.Switch?.boxShadowFocus,
      },
    } : {}),
  }
}
