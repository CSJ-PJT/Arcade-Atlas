export function scoreGroup(groupSize: number): number {
  return groupSize * 10 + Math.max(0, groupSize - 6) * 20
}

export function calculateLevel(totalClearedCells: number): number {
  return 1 + Math.floor(Math.max(0, totalClearedCells) / 30)
}

export function calculateDropInterval(level: number): number {
  return Math.max(160, 900 - (Math.max(1, level) - 1) * 70)
}
