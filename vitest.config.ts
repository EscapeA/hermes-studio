import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'packages/client/src'),
      // messages.ts loads locales through the build-time merge plugin in
      // vite.config.ts; vitest uses this bare config, so map the specifier to
      // the raw locale files to keep transforms of messages.ts resolvable.
      '@locales': resolve(__dirname, 'packages/client/src/i18n/locales'),
      electron: resolve(__dirname, 'tests/mocks/electron.ts'),
      'electron-updater': resolve(__dirname, 'tests/mocks/electron-updater.ts'),
      '/logo.png': resolve(__dirname, 'packages/client/public/logo.png'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      exclude: [
        '**/dist/**',
        'packages/desktop/release/**',
      ],
    },
  },
})
