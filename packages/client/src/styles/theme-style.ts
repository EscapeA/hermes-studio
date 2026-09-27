// Theme style metadata shared by the first-paint bootstrap (main.ts), the
// theme composable and the settings page.
//
// A style is applied as a class on <html> next to the brightness class
// (`light` / `dark`), exactly like the original ink/comic pair. This file is
// the single source of truth: every other module reads the tables below, so
// adding a style means one entry per table here plus its palette in
// variables.scss / styles/theme.ts — never another `if` in main.ts or
// useTheme.ts (see STYLE_CLASS / STYLE_CLASSES).
//
// Styles listed as forced-dark ship a dark-only palette: their CSS variables
// live under `.dark.<style>` in styles/variables.scss, so STYLE_FORCES_DARK has
// to stay in sync with those selectors — a style listed here as forced-dark
// must always be rendered with the `dark` class.
// `blueprint` is the opposite case: it is light-first and therefore ships both
// a `.blueprint` (light) and a `.dark.blueprint` (dark) block.

export const THEME_STYLES = [
  'ink',
  'comic',
  'tech',
  'terminal',
  'neon',
  'aurora',
  'blueprint',
] as const

export type ThemeStyle = typeof THEME_STYLES[number]

export const DEFAULT_THEME_STYLE: ThemeStyle = 'ink'

/** `<html>` class per style. `ink` is the classless default — every other
 *  style carries a class named after itself. */
export const STYLE_CLASS: Record<ThemeStyle, string | null> = {
  ink: null,
  comic: 'comic',
  tech: 'tech',
  terminal: 'terminal',
  neon: 'neon',
  aurora: 'aurora',
  blueprint: 'blueprint',
}

/** Every style class that can appear on `<html>`. The first-paint bootstrap
 *  and the theme composable both iterate this list, so a new style needs no
 *  edit in either of them. */
export const STYLE_CLASSES: string[] = THEME_STYLES
  .map((style) => STYLE_CLASS[style])
  .filter((className): className is string => className !== null)

/** Styles whose palette is only legible on a dark background. */
export const STYLE_FORCES_DARK: Record<ThemeStyle, boolean> = {
  ink: false,
  comic: false,
  tech: true,
  terminal: true,
  neon: true,
  aurora: true,
  blueprint: false,
}

/** I18n keys for the style labels — kept next to the style list so a new
 *  style cannot be added without its label. */
export const STYLE_LABEL_KEYS: Record<ThemeStyle, string> = {
  ink: 'theme.styleInk',
  comic: 'theme.styleComic',
  tech: 'theme.styleTech',
  terminal: 'theme.styleTerminal',
  neon: 'theme.styleNeon',
  aurora: 'theme.styleAurora',
  blueprint: 'theme.styleBlueprint',
}

// Status bar / browser chrome color per style, mirroring the static
// <meta name="theme-color"> tags in index.html so standalone PWA chrome
// follows the style as well as the brightness setting.
export const STYLE_THEME_COLOR: Record<ThemeStyle, { light: string; dark: string }> = {
  ink: { light: '#f7f7f4', dark: '#1a1a1a' },
  comic: { light: '#f7f7f4', dark: '#1a1a1a' },
  tech: { light: '#070a12', dark: '#070a12' },
  terminal: { light: '#000000', dark: '#000000' },
  neon: { light: '#05060a', dark: '#05060a' },
  aurora: { light: '#0a0a14', dark: '#0a0a14' },
  blueprint: { light: '#f4f7fb', dark: '#0d1b2a' },
}

/** Preview chip shown next to each option in the style picker: the style's
 *  signature accent plus the surface it sits on. Kept here so a new style
 *  cannot ship without a pickable preview. */
export const STYLE_SWATCH: Record<ThemeStyle, { accent: string; surface: string }> = {
  ink: { accent: '#c9c9c9', surface: '#1a1a1a' },
  comic: { accent: '#1a1a1a', surface: '#fbf6e9' },
  tech: { accent: '#22d3ee', surface: '#070a12' },
  terminal: { accent: '#63d96b', surface: '#000000' },
  neon: { accent: '#00e5ff', surface: '#05060a' },
  aurora: { accent: '#8b5cf6', surface: '#0a0a14' },
  blueprint: { accent: '#0b6bcb', surface: '#f4f7fb' },
}

export function isThemeStyle(value: unknown): value is ThemeStyle {
  return typeof value === 'string' && (THEME_STYLES as readonly string[]).includes(value)
}

/** Any persisted value that is not a known style falls back to ink. */
export function normalizeThemeStyle(value: unknown): ThemeStyle {
  return isThemeStyle(value) ? value : DEFAULT_THEME_STYLE
}
