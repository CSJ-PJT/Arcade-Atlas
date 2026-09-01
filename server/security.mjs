import { isIP } from 'node:net'

export const MAX_CONNECTIONS = 256
export const MAX_CONNECTIONS_PER_ADDRESS = 8
export const MAX_ROOMS = 200
export const MAX_TOTAL_BOTS = 128
export const ROOM_CREATION_WINDOW_MS = 10 * 60 * 1000
export const MAX_ROOM_CREATIONS_PER_WINDOW = 20

export function clientAddress(request) {
  const realIp = String(request.headers['x-real-ip'] ?? '').trim()
  if (isIP(realIp)) return realIp
  return request.socket.remoteAddress || 'unknown'
}

export class SlidingWindowLimiter {
  constructor({ windowMs, limit, now = Date.now }) { this.windowMs = windowMs; this.limit = limit; this.now = now; this.entries = new Map() }
  allow(key) {
    const cutoff = this.now() - this.windowMs
    const recent = (this.entries.get(key) ?? []).filter((time) => time > cutoff)
    if (recent.length >= this.limit) { this.entries.set(key, recent); return false }
    recent.push(this.now()); this.entries.set(key, recent); return true
  }
  sweep() {
    const cutoff = this.now() - this.windowMs
    for (const [key, times] of this.entries) {
      const recent = times.filter((time) => time > cutoff)
      if (recent.length) this.entries.set(key, recent); else this.entries.delete(key)
    }
  }
}
