import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import {
  getThemeOverrides,
  techThemeOverrides,
  terminalThemeOverrides,
  neonThemeOverrides,
  auroraThemeOverrides,
  blueprintLightThemeOverrides,
} from '@/styles/theme'
import {
  DEFAULT_THEME_STYLE,
  STYLE_CLASS,
  STYLE_CLASSES,
  STYLE_FORCES_DARK,
  STYLE_LABEL_KEYS,
  STYLE_SWATCH,
  STYLE_THEME_COLOR,
  THEME_STYLES,
  normalizeThemeStyle,
} from '@/styles/theme-style'

const readClientFile = (path: string) => readFileSync(`packages/client/src/${path}`, 'utf8')

const LOCALES = ['en', 'zh', 'zh-TW', 'ja', 'ko', 'fr', 'es', 'de', 'pt', 'ru', 'ar']

describe('theme styles', () => {
  it('describes every style: brightness lock, label key and chrome color', () => {
    for (const style of THEME_STYLES) {
      expect(typeof STYLE_FORCES_DARK[style], style).toBe('boolean')
      expect(STYLE_LABEL_KEYS[style], style).toMatch(/^theme\.style[A-Z]/)
      expect(STYLE_THEME_COLOR[style].light, style).toMatch(/^#[0-9a-f]{6}$/)
      expect(STYLE_THEME_COLOR[style].dark, style).toMatch(/^#[0-9a-f]{6}$/)
      expect(STYLE_SWATCH[style].accent, style).toMatch(/^#[0-9a-f]{6}$/)
      expect(STYLE_SWATCH[style].surface, style).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(STYLE_FORCES_DARK.tech).toBe(true)
    expect(STYLE_FORCES_DARK.terminal).toBe(true)
    expect(STYLE_FORCES_DARK.neon).toBe(true)
    expect(STYLE_FORCES_DARK.aurora).toBe(true)
    expect(STYLE_FORCES_DARK.ink).toBe(false)
    expect(STYLE_FORCES_DARK.comic).toBe(false)
    // Blueprint ships both a light and a dark block, so it follows the
    // brightness setting instead of pinning it.
    expect(STYLE_FORCES_DARK.blueprint).toBe(false)
    // The two "restrained" registers are dark-locked as well.
    expect(STYLE_FORCES_DARK.graphite).toBe(true)
    expect(STYLE_FORCES_DARK.warm).toBe(true)
  })

  it('derives the <html> class list from the style table', () => {
    // ink is the classless default; every other style carries its own class.
    expect(STYLE_CLASS.ink).toBe(null)
    for (const style of THEME_STYLES) {
      if (style === 'ink') continue
      expect(STYLE_CLASS[style], style).toBe(style)
    }
    expect(STYLE_CLASSES).not.toContain(null)
    expect(new Set(STYLE_CLASSES).size).toBe(STYLE_CLASSES.length)
    expect(STYLE_CLASSES).toEqual([
      'comic', 'tech', 'terminal', 'neon', 'aurora', 'blueprint', 'graphite', 'warm',
    ])
  })

  it('falls back to ink for unknown or missing persisted styles', () => {
    expect(normalizeThemeStyle('tech')).toBe('tech')
    expect(normalizeThemeStyle('comic')).toBe('comic')
    expect(normalizeThemeStyle('neon')).toBe('neon')
    expect(normalizeThemeStyle('vaporwave')).toBe(DEFAULT_THEME_STYLE)
    expect(normalizeThemeStyle(null)).toBe(DEFAULT_THEME_STYLE)
    expect(normalizeThemeStyle('')).toBe(DEFAULT_THEME_STYLE)
  })

  it('ships a palette block in variables.scss for every style', () => {
    const variables = readClientFile('styles/variables.scss')
    // Anchored at line start so `.dark.blueprint {` cannot satisfy a check for
    // the plain `.blueprint {` light block.
    const block = (selector: string) => new RegExp(`^${selector.replace('.', '\\.')} \\{`, 'm')

    for (const style of THEME_STYLES) {
      if (style === 'ink') continue
      if (STYLE_FORCES_DARK[style]) {
        expect(variables, style).toMatch(block(`.dark.${style}`))
      } else {
        expect(variables, `${style} light`).toMatch(block(`.${style}`))
        expect(variables, `${style} dark`).toMatch(block(`.dark.${style}`))
      }
    }
  })

  it('builds the naive UI overrides from the matching palette', () => {
    expect(getThemeOverrides(true, 'tech').common?.bodyColor).toBe('#070a12')
    expect(getThemeOverrides(true, 'tech').common?.primaryColor).toBe('#22d3ee')
    expect(getThemeOverrides(true, 'terminal').common?.bodyColor).toBe('#000000')
    expect(getThemeOverrides(true, 'terminal').common?.primaryColor).toBe('#63d96b')
    expect(getThemeOverrides(true, 'neon').common?.bodyColor).toBe('#05060a')
    expect(getThemeOverrides(true, 'aurora').common?.bodyColor).toBe('#0a0a14')
    // Blueprint is the only style with two palettes; brightness picks one.
    expect(getThemeOverrides(false, 'blueprint').common?.bodyColor).toBe('#f4f7fb')
    expect(getThemeOverrides(true, 'blueprint').common?.bodyColor).toBe('#0d1b2a')
    expect(getThemeOverrides(true, 'graphite').common?.bodyColor).toBe('#08090a')
    expect(getThemeOverrides(true, 'graphite').common?.primaryColor).toBe('#5e6ad2')
    // Graphite sharpens the naive-ui corner radius; warm keeps the ink default
    // because its primary is paper-white, not a chromatic accent.
    expect(getThemeOverrides(true, 'graphite').common?.borderRadius).toBe('6px')
    expect(getThemeOverrides(true, 'graphite').common?.borderRadiusSmall).toBe('4px')
    expect(getThemeOverrides(true, 'warm').common?.bodyColor).toBe('#201d1d')
    expect(getThemeOverrides(true, 'warm').common?.primaryColor).toBe('#e6dccd')
    expect(getThemeOverrides(true, 'warm').common?.borderRadius).toBe('8px')
    expect(techThemeOverrides.Switch?.railColorActive).toBe('#22d3ee')
    expect(terminalThemeOverrides.Switch?.railColorActive).toBe('#63d96b')
    expect(neonThemeOverrides.Switch?.railColorActive).toBe('#00e5ff')
    expect(auroraThemeOverrides.Switch?.railColorActive).toBe('#8b5cf6')
    expect(blueprintLightThemeOverrides.Switch?.railColorActive).toBe('#0b6bcb')
    expect(terminalThemeOverrides.Button?.textColorPrimary).toBe('#000000')
    // Terminal carries the monospace UI font through its palette.
    expect(getThemeOverrides(true, 'terminal').common?.fontFamily).toContain('JetBrains Mono')
    // Ink keeps the original light/dark pair.
    expect(getThemeOverrides(false, 'ink').common?.bodyColor).toBe('#fafafa')
    expect(getThemeOverrides(true, 'ink').common?.bodyColor).toBe('#1a1a1a')
  })

  it('keeps the new style labels in every locale', () => {
    for (const locale of LOCALES) {
      const source = readClientFile(`i18n/locales/${locale}.ts`)

      for (const style of THEME_STYLES) {
        const key = STYLE_LABEL_KEYS[style].split('.')[1]
        expect(source, `${locale}: ${key}`).toMatch(new RegExp(`\\b${key}: '[^']+'`))
      }
      expect(source, locale).toMatch(/\bmodeLockedHint: '[^']+'/)
    }
  })

  it('keeps the style layers scoped to a style class', () => {
    const layers = readClientFile('styles/style-layers.scss')

    // Every ambient/material block must be keyed off the <html> style class,
    // otherwise it would leak into the default ink theme.
    for (const style of ['tech', 'neon', 'aurora', 'blueprint', 'graphite', 'warm']) {
      expect(layers, style).toContain(`html.${style}`)
    }
    // Graphite's whole point is having no ambient layer, so it must not
    // register a full-viewport overlay.
    expect(layers).not.toContain('html.graphite body::after')
    // A user background image owns the page background.
    expect(layers).toContain('html.theme-has-custom-background .app-layout')
  })
})
