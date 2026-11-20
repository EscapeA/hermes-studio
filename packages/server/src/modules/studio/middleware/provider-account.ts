import { providerProfiles } from '../public/provider-account'
import type { Context, Next } from 'koa'
import { importAccountProviders, withProviderAccount } from '../public/provider-account'

export async function providerAccountMiddleware(ctx: Context, next: Next): Promise<void> {
  if (!ctx.state.user) return next()
  return withProviderAccount(ctx.state.user.id, async () => {
    await importAccountProviders()
    await next()
  }, ctx.state.profile?.name)
}
