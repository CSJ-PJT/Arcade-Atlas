export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0 || 0x9e3779b9
}

export class SeededRng {
  private state: number

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
    if (this.state === 0) this.state = 0x9e3779b9
  }

  nextUint32(): number {
    let value = this.state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state
  }

  next(): number {
    return this.nextUint32() / 0x1_0000_0000
  }

  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive integer')
    }
    return Math.floor(this.next() * maxExclusive)
  }

  getState(): number {
    return this.state
  }

  setState(state: number): void {
    if (!Number.isSafeInteger(state)) throw new RangeError('state must be an integer')
    this.state = state >>> 0 || 0x9e3779b9
  }
}
