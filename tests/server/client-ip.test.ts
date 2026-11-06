import { describe, expect, it } from 'vitest'
import {
  isTrustedProxy,
  parseTrustedProxies,
  resolveClientIp,
} from '../../packages/server/src/modules/studio/public/client-ip'

function ctxWith(peer: string, headers: Record<string, string> = {}) {
  return {
    ip: peer,
    req: { socket: { remoteAddress: peer }, headers },
    get: (name: string) => headers[name.toLowerCase()] || '',
  } as any
}

describe('parseTrustedProxies', () => {
  it('trusts loopback by default so a local tunnel is honoured', () => {
    const policy = parseTrustedProxies(undefined)
    expect(policy.loopback).toBe(true)
    expect(policy.addresses.size).toBe(0)
  })

  it('accepts an explicit allowlist of proxy addresses', () => {
    const policy = parseTrustedProxies('10.0.0.5, 192.168.1.10')
    expect(policy.addresses.has('10.0.0.5')).toBe(true)
    expect(policy.addresses.has('192.168.1.10')).toBe(true)
    // An explicit list must not silently keep trusting loopback.
    expect(policy.loopback).toBe(false)
  })

  it('can disable trust entirely', () => {
    const policy = parseTrustedProxies('none')
    expect(policy.loopback).toBe(false)
    expect(policy.addresses.size).toBe(0)
  })
})

describe('resolveClientIp', () => {
  it('uses the forwarded client address when the peer is a trusted proxy', () => {
    const result = resolveClientIp(ctxWith('127.0.0.1', { 'cf-connecting-ip': '203.0.113.7' }))
    expect(result.ip).toBe('203.0.113.7')
    expect(result.viaProxy).toBe(true)
  })

  it('ignores forwarded headers when the peer is not trusted', () => {
    // A LAN or Tailnet client speaks to the process directly and can forge any
    // header it likes, so its socket address must win.
    const result = resolveClientIp(ctxWith('100.107.130.128', { 'cf-connecting-ip': '203.0.113.7' }))
    expect(result.ip).toBe('100.107.130.128')
    expect(result.viaProxy).toBe(false)
  })

  it('takes the last x-forwarded-for hop appended by the trusted proxy', () => {
    const result = resolveClientIp(ctxWith('127.0.0.1', {
      'x-forwarded-for': '1.1.1.1, 8.8.8.8, 198.51.100.4',
    }))
    expect(result.ip).toBe('198.51.100.4')
  })

  it('strips a port from the forwarded value', () => {
    const result = resolveClientIp(ctxWith('127.0.0.1', { 'x-real-ip': '198.51.100.9:44321' }))
    expect(result.ip).toBe('198.51.100.9')
  })

  it('falls back to the peer when a trusted proxy sends no address header', () => {
    const result = resolveClientIp(ctxWith('127.0.0.1'))
    expect(result.ip).toBe('127.0.0.1')
    expect(result.viaProxy).toBe(false)
  })

  it('gives distinct buckets to distinct external clients behind one tunnel', () => {
    const a = resolveClientIp(ctxWith('127.0.0.1', { 'cf-connecting-ip': '203.0.113.1' }))
    const b = resolveClientIp(ctxWith('127.0.0.1', { 'cf-connecting-ip': '203.0.113.2' }))
    expect(a.ip).not.toBe(b.ip)
  })
})

describe('isTrustedProxy', () => {
  it('treats v4-mapped loopback as loopback', () => {
    const policy = parseTrustedProxies(undefined)
    expect(isTrustedProxy('::ffff:127.0.0.1', policy)).toBe(true)
    expect(isTrustedProxy('::1', policy)).toBe(true)
  })

  it('rejects a public address when only loopback is trusted', () => {
    const policy = parseTrustedProxies(undefined)
    expect(isTrustedProxy('203.0.113.7', policy)).toBe(false)
  })
})
