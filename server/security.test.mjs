import { describe, expect, it } from 'vitest'
import { SlidingWindowLimiter, clientAddress } from './security.mjs'

describe('multiplayer security boundaries', () => {
  it('uses the nginx-authenticated real address instead of spoofable forwarded chains', () => {
    const request = { headers: { 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }, socket: { remoteAddress: '127.0.0.1' } }
    expect(clientAddress(request)).toBe('203.0.113.7')
    expect(clientAddress({ headers: { 'x-real-ip': 'not-an-ip' }, socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1')
  })

  it('limits repeated room creation and expires only after the window', () => {
    let now = 1000
    const limiter = new SlidingWindowLimiter({ windowMs: 100, limit: 2, now: () => now })
    expect(limiter.allow('source')).toBe(true)
    expect(limiter.allow('source')).toBe(true)
    expect(limiter.allow('source')).toBe(false)
    now += 101
    expect(limiter.allow('source')).toBe(true)
  })
})
