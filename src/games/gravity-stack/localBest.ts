export const GRAVITY_STACK_BEST_KEY = 'arcade:gravity-stack:best:v1'

export function readBestScore(storage: Pick<Storage, 'getItem'> = localStorage): number {
  try {
    const raw = storage.getItem(GRAVITY_STACK_BEST_KEY)
    if (raw === null) return 0
    const value = Number(raw)
    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

export function writeBestScore(score: number, storage: Pick<Storage, 'setItem'> = localStorage): void {
  if (!Number.isSafeInteger(score) || score < 0) return
  try {
    storage.setItem(GRAVITY_STACK_BEST_KEY, String(score))
  } catch {
    // Storage can be disabled; the game must remain playable.
  }
}
