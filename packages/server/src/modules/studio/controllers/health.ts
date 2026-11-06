import type { StudioHealthService } from '../services/health'
import { resolveClientIp } from '../public/client-ip'

let service: StudioHealthService | null = null

export function configureHealthController(nextService: StudioHealthService): void {
  service = nextService
}

function requireService(): StudioHealthService {
  if (!service) throw new Error('Studio health controller is not configured')
  return service
}

export function livenessCheck(ctx: any) {
  ctx.body = { status: 'ok' }
}

/**
 * Full diagnostics are only meaningful to an operator. Publishing them to the
 * Internet hands an attacker the exact build to target plus the internal
 * agent-bridge PID, so unauthenticated callers get a minimal liveness document
 * while authenticated or loopback callers keep the complete snapshot.
 */
function isPrivilegedCaller(ctx: any): boolean {
  if (ctx.state?.user) return true
  const ip = String(resolveClientIp(ctx).ip || '')
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.')
}

export async function healthCheck(ctx: any) {
  const snapshot = await requireService().snapshot()
  if (isPrivilegedCaller(ctx)) {
    ctx.body = snapshot
    return
  }
  ctx.body = { status: snapshot.status === 'ok' ? 'ok' : snapshot.status }
}

export async function checkLatestVersion(): Promise<void> {
  await requireService().checkLatestVersion()
}

export function startVersionCheck(): void {
  requireService().startVersionCheck()
}
