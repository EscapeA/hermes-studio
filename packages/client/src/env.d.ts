/// <reference types="vite/client" />

declare const __APP_VERSION__: string
/** Content hashes for brand files, injected at build time (see vite.config.ts). */
declare const __BRAND_VERSIONS__: Record<string, string> | undefined

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
