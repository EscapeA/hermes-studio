import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import type { Plugin, ProxyOptions } from 'vite'
import { dirname, resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { transformSync } from 'esbuild'
import pkg from './package.json'

const FRONTEND_PORT = Number(process.env.HERMES_WEB_UI_FRONTEND_PORT || 8649)
const BACKEND_PORT = process.env.HERMES_WEB_UI_BACKEND_PORT || '8648'
const BACKEND = `http://127.0.0.1:${BACKEND_PORT}`

function createProxyConfig(): ProxyOptions {
  return {
    target: BACKEND,
    changeOrigin: true,
    ws: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
      })
      proxy.on('proxyReqWs', (proxyReq) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
      })
      proxy.on('proxyRes', (proxyRes) => {
        proxyRes.headers['cache-control'] = 'no-cache'
        proxyRes.headers['x-accel-buffering'] = 'no'
      })
    },
  }
}

// --- Locale merge plugin ---------------------------------------------------
// The i18n loader imports each locale plus English at runtime so that missing
// keys fall back to English. That forces two chunks per page load (e.g. en +
// zh) on every non-English client. This plugin performs the English fallback
// merge at BUILD time instead: `import('@locales/zh')` resolves to a virtual
// module whose content is already `mergeMessagesWithFallback(en, zh)`. Runtime
// then loads exactly one chunk per locale.
const LOCALES_DIR = resolve(__dirname, 'packages/client/src/i18n/locales')

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function mergeMessagesWithFallback(
  fallback: Record<string, unknown>,
  locale: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...fallback }
  for (const [key, value] of Object.entries(locale)) {
    const fallbackValue = fallback[key]
    merged[key] = isPlainObject(fallbackValue) && isPlainObject(value)
      ? mergeMessagesWithFallback(fallbackValue, value)
      : value
  }
  return merged
}

/**
 * Load a .ts module as CJS at build time, resolving relative imports from its
 * own directory (locale files import sibling modules like '../social-messages').
 * Node's native require cannot load .ts, so relative .ts dependencies are
 * transformed with esbuild and executed through the same loader.
 */
function loadTsModuleAsCjs(
  filePath: string,
  seen = new Set<string>(),
): Record<string, unknown> {
  const absPath = resolve(filePath)
  if (seen.has(absPath)) return {}
  seen.add(absPath)
  const source = readFileSync(absPath, 'utf8')
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
  const module = { exports: {} as Record<string, unknown> }
  const baseDir = dirname(absPath)
  const customRequire = (id: string): unknown => {
    if (id.startsWith('.')) {
      const candidates = [
        resolve(baseDir, id),
        `${resolve(baseDir, id)}.ts`,
        `${resolve(baseDir, id)}.js`,
        `${resolve(baseDir, id)}/index.ts`,
        `${resolve(baseDir, id)}/index.js`,
      ]
      for (const candidate of candidates) {
        if (existsSync(candidate)) return loadTsModuleAsCjs(candidate, seen)
      }
      throw new Error(`Cannot resolve '${id}' from ${baseDir}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(id)
  }
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, customRequire)
  return module.exports
}

function loadLocaleModule(locale: string): Record<string, unknown> {
  const moduleExports = loadTsModuleAsCjs(resolve(LOCALES_DIR, `${locale}.ts`))
  const exported = (moduleExports as { default?: Record<string, unknown> }).default as Record<string, unknown>
  return exported
}

function createLocaleMergePlugin(): Plugin {
  const cache = new Map<string, string>()
  return {
    name: 'locale-merge',
    resolveId(id: string) {
      if (id.startsWith('@locales/')) return '\0locales/' + id.slice('@locales/'.length)
      return null
    },
    load(id: string) {
      if (!id.startsWith('\0locales/')) return null
      const locale = id.slice('\0locales/'.length)
      if (!cache.has(locale)) {
        const messages = locale === 'en'
          ? loadLocaleModule('en')
          : mergeMessagesWithFallback(loadLocaleModule('en'), loadLocaleModule(locale))
        cache.set(locale, `export default ${JSON.stringify(messages)}`)
      }
      return cache.get(locale)
    },
  }
}

export default defineConfig({
  root: 'packages/client',
  plugins: [vue(), createLocaleMergePlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'packages/client/src'),
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    // Use esbuild for minification (much faster than terser)
    minify: 'esbuild',
    // Disable sourcemap generation for faster builds
    sourcemap: false,
    target: 'es2020',
    // Increase chunk size warning limit (default: 500KB)
    chunkSizeWarningLimit: 1000,
    // CSS code splitting for better caching
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Optimize chunk file names for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },
  optimizeDeps: {
    // Pre-bundle all large dependencies for faster builds
    include: [
      'monaco-editor',
      'mermaid',
      'vue',
      'vue-router',
      'pinia',
      'naive-ui',
    ],
  },
  server: {
    port: FRONTEND_PORT,
    strictPort: true,
    proxy: {
      '/api': createProxyConfig(),
      '/v1': createProxyConfig(),
      '/health': createProxyConfig(),
      '/upload': createProxyConfig(),
      '/socket.io': {
        target: BACKEND,
        ws: true,
      },
    },
  },
})
