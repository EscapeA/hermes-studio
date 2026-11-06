import type { Context } from 'koa'

/**
 * Resolve the address that should be used for per-client policy decisions
 * (login throttling, audit, lockout).
 *
 * The Web UI is commonly fronted by an edge reverse proxy (Cloudflare Tunnel,
 * nginx, Caddy). Without `app.proxy` the Koa `ctx.ip` is always the proxy
 * socket address, which collapses every external visitor into one bucket: a
 * single anonymous client that fails 10 logins locks the whole installation.
 *
 * We cannot simply trust every forwarded header, though, because a client can
 * forge them whenever it reaches the process directly (LAN or Tailnet binds).
 * The rule is therefore: only honour the proxy-supplied address when the TCP
 * peer is a proxy we are configured to trust.
 *
 * - `HERMES_WEB_UI_TRUSTED_PROXIES`: comma/space separated addresses or
 *   `loopback`. Defaults to `loopback`, which is correct for Cloudflare Tunnel
 *   (cloudflared dials 127.0.0.1) and for a co-located nginx/Caddy.
 * - `HERMES_WEB_UI_CLIENT_IP_HEADER`: header carrying the real client address.
 *   Defaults to `cf-connecting-ip`, then falls back to the last
 *   `x-forwarded-for` hop, then `x-real-ip`.
 *
 * `cf-connecting-ip` is used first because Cloudflare overwrites it at the
 * edge, so a client cannot spoof it through the tunnel.
 */

const DEFAULT_PROXY_HEADERS = ['cf-connecting-ip', 'x-real-ip'] as const

function normalizeAddress(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withoutV4Mapped = trimmed.toLowerCase().startsWith('::ffff:')
    ? trimmed.slice('::ffff:'.length)
    : trimmed
  return withoutV4Mapped.toLowerCase()
}

function stripPort(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  // [::1]:443
  if (trimmed.startsWith('[')) {
    const closing = trimmed.indexOf(']')
    return closing > 0 ? trimmed.slice(1, closing) : trimmed
  }
  // 1.2.3.4:5678 — only strip when there is exactly one colon (IPv6 has many)
  const colonCount = (trimmed.match(/:/g) || []).length
  if (colonCount === 1) return trimmed.slice(0, trimmed.indexOf(':'))
  return trimmed
}

function isLoopback(address: string): boolean {
  const normalized = normalizeAddress(address)
  return normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized.startsWith('127.')
}

export interface TrustedProxyPolicy {
  loopback: boolean
  addresses: Set<string>
}

export function parseTrustedProxies(raw: string | undefined): TrustedProxyPolicy {
  const policy: TrustedProxyPolicy = { loopback: true, addresses: new Set() }
  const value = String(raw ?? '').trim()
  // An explicit empty string means "trust loopback only", which is the safe
  // default. Only an explicit opt-out disables that.
  const tokens = (value || 'loopback')
    .split(/[\s,]+/)
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)

  if (tokens.includes('none')) {
    policy.loopback = false
    return policy
  }

  policy.loopback = tokens.includes('loopback') || tokens.includes('*')
  for (const token of tokens) {
    if (token === 'loopback' || token === '*') continue
    const normalized = normalizeAddress(stripPort(token))
    if (normalized) policy.addresses.add(normalized)
  }
  return policy
}

export function isTrustedProxy(address: string, policy: TrustedProxyPolicy): boolean {
  const normalized = normalizeAddress(stripPort(address))
  if (!normalized) return false
  if (policy.loopback && isLoopback(normalized)) return true
  return policy.addresses.has(normalized)
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (!value) return ''
  const raw = Array.isArray(value) ? value[0] : value
  return stripPort(String(raw || '').split(',')[0] || '')
}

function lastForwardedHop(value: string | string[] | undefined): string {
  if (!value) return ''
  const raw = Array.isArray(value) ? value.join(',') : String(value)
  const hops = raw.split(',').map(hop => stripPort(hop)).filter(Boolean)
  // The right-most hop is the one appended by the trusted proxy we just spoke
  // to; anything to its left is client-controlled.
  return hops.length ? hops[hops.length - 1] : ''
}

export interface ClientIpResolution {
  /** Address to use for per-client policy. Never empty. */
  ip: string
  /** True when `ip` came from a trusted proxy header rather than the socket. */
  viaProxy: boolean
  /** Raw socket peer address. */
  peer: string
}

export function resolveClientIp(
  ctx: Pick<Context, 'ip' | 'req' | 'get'>,
  options: {
    trustedProxies?: TrustedProxyPolicy
    headerName?: string
  } = {},
): ClientIpResolution {
  const policy = options.trustedProxies ?? parseTrustedProxies(process.env.HERMES_WEB_UI_TRUSTED_PROXIES)
  const peerRaw = ctx.req?.socket?.remoteAddress || ''
  const peer = normalizeAddress(stripPort(peerRaw)) || 'unknown'

  if (!isTrustedProxy(peer, policy)) {
    return { ip: peer, viaProxy: false, peer }
  }

  const configuredHeader = String(options.headerName ?? process.env.HERMES_WEB_UI_CLIENT_IP_HEADER ?? '')
    .trim()
    .toLowerCase()

  const candidates = configuredHeader
    ? [configuredHeader, ...DEFAULT_PROXY_HEADERS]
    : [...DEFAULT_PROXY_HEADERS]

  for (const header of candidates) {
    const value = firstHeaderValue(ctx.req?.headers?.[header] as string | string[] | undefined)
    if (value) return { ip: normalizeAddress(value), viaProxy: true, peer }
  }

  const forwarded = lastForwardedHop(ctx.req?.headers?.['x-forwarded-for'] as string | string[] | undefined)
  if (forwarded) return { ip: normalizeAddress(forwarded), viaProxy: true, peer }

  // Trusted proxy but no usable header: fall back to the socket address so the
  // limiter still has a stable key instead of collapsing to 'unknown'.
  return { ip: peer, viaProxy: false, peer }
}
