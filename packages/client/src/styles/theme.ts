import type { GlobalThemeOverrides } from 'naive-ui'
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
  Drawer: {
    borderRadius: '5px',
    closeBorderRadius: '5px',
    closeColorHover: 'transparent',
    closeColorPressed: 'transparent',
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
  Drawer: {
    borderRadius: '5px',
    closeBorderRadius: '5px',
    closeColorHover: 'transparent',
    closeColorPressed: 'transparent',
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


// ─── 蓝图 (blueprint) 调色板 ─────────────────────────────────────
// Light-first: 冷白纸面 + 墨蓝主色；暗色为深海军蓝纸面 + 天蓝主色。
const BLUEPRINT_LIGHT = {
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
  hover: 'rgba(11, 107, 203, 0.06)',
  menuActive: 'rgba(11, 107, 203, 0.10)',
  menuActiveHover: 'rgba(11, 107, 203, 0.16)',
}

const BLUEPRINT_DARK = {
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
  hover: 'rgba(120, 180, 240, 0.08)',
  menuActive: 'rgba(56, 189, 248, 0.14)',
  menuActiveHover: 'rgba(56, 189, 248, 0.24)',
}

function blueprintOverrides(isDark: boolean): GlobalThemeOverrides {
  const p = isDark ? BLUEPRINT_DARK : BLUEPRINT_LIGHT
  return {
    common: {
      primaryColor: p.primary,
      primaryColorHover: p.primaryHover,
      primaryColorPressed: p.primaryPressed,
      primaryColorSuppl: p.primary,
      bodyColor: p.body,
      cardColor: p.surface,
      modalColor: p.surface,
      popoverColor: p.surface,
      tableColor: p.surface,
      inputColor: p.surface,
      actionColor: p.action,
      textColorBase: p.text1,
      textColor1: p.text1,
      textColor2: p.text2,
      textColor3: p.text3,
      dividerColor: p.border,
      borderColor: p.border,
      hoverColor: p.hover,
    },
    Layout: { color: p.body, siderColor: p.sider, headerColor: p.body },
    Menu: {
      itemTextColorActive: p.text1,
      itemTextColorActiveHover: p.text1,
      itemColorActive: p.menuActive,
      itemColorActiveHover: p.menuActiveHover,
      itemIconColorActiveHover: p.primaryHover,
    },
    Button: {
      textColorPrimary: p.textOnPrimary,
      colorPrimary: p.primary,
      colorHoverPrimary: p.primaryHover,
      colorPressedPrimary: p.primaryPressed,
    },
    Input: { color: p.surface, border: `1px solid ${p.border}` },
  }
}

export function getThemeOverrides(
  isDark: boolean,
  isComic?: boolean,
  customization?: ThemeCustomization,
  isBlueprint?: boolean,
): GlobalThemeOverrides {
  const base = isBlueprint
    ? blueprintOverrides(isDark)
    : isDark ? darkThemeOverrides : lightThemeOverrides
  if (!isComic && !customization && !isBlueprint) return base
  const comicFont = "'Comic Neue', 'ZCOOL KuaiLe', 'Zen Maru Gothic', 'Gaegu', cursive, sans-serif"
  const custom = customization ? resolveThemeCustomization(customization, isDark) : null
  const common = {
    ...base.common!,
    ...(isComic ? { fontFamily: comicFont } : {}),
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
