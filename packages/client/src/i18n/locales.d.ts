// Virtual modules provided by the `locale-merge` vite plugin (see vite.config.ts).
// Each `@locales/<locale>` module is the locale's messages merged with the
// English fallback at build time, so the runtime never fetches two locale chunks.
declare module '@locales/*' {
  import type { LocaleMessages } from './messages'
  const messages: LocaleMessages
  export default messages
}
