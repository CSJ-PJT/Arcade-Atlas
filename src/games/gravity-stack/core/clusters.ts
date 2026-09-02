import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type Cell, type DischargeGroup, type ResolutionResult } from './types'
import { scoreGroup } from './scoring'

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<Cell | null>(BOARD_WIDTH).fill(null))
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
}

export function findDischargeGroups(board: Board): DischargeGroup[] {
  const visited = Array.from({ length: BOARD_HEIGHT }, () => Array<boolean>(BOARD_WIDTH).fill(false))
  const groups: DischargeGroup[] = []
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const origin = board[y]?.[x]
      if (!origin || origin.obstacle || visited[y][x]) continue
      const cells = [{ x, y }]
      visited[y][x] = true
      for (let cursor = 0; cursor < cells.length; cursor += 1) {
        const current = cells[cursor]
        for (const [dx, dy] of directions) {
          const nextX = current.x + dx
          const nextY = current.y + dy
          if (nextX < 0 || nextX >= BOARD_WIDTH || nextY < 0 || nextY >= BOARD_HEIGHT) continue
          if (visited[nextY][nextX] || board[nextY][nextX]?.obstacle || board[nextY][nextX]?.energy !== origin.energy) continue
          visited[nextY][nextX] = true
          cells.push({ x: nextX, y: nextY })
        }
      }
      if (cells.length >= 6) groups.push({ kind: 'energy', energy: origin.energy, cells })
    }
  }
  return groups
}

export function findFullRows(board: Board): DischargeGroup[] {
  const rows: DischargeGroup[] = []
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    if (board[y].every(Boolean)) {
      rows.push({ kind: 'fullRow', cells: Array.from({ length: BOARD_WIDTH }, (_, x) => ({ x, y })) })
    }
  }
  return rows
}

export function applyColumnGravity(board: Board): Board {
  const result = createEmptyBoard()
  for (let x = 0; x < BOARD_WIDTH; x += 1) {
    let writeY = BOARD_HEIGHT - 1
    for (let y = BOARD_HEIGHT - 1; y >= 0; y -= 1) {
      const cell = board[y][x]
      if (cell) {
        result[writeY][x] = { ...cell }
        writeY -= 1
      }
    }
  }
  return result
}

export function resolveCascades(source: Board): ResolutionResult {
  let board = cloneBoard(source)
  const waves: ResolutionResult['waves'] = []

  for (let waveIndex = 1; ; waveIndex += 1) {
    const fullRows = findFullRows(board)
    const groups = fullRows.length > 0 ? fullRows : findDischargeGroups(board)
    if (groups.length === 0) break
    const cleared = new Set(groups.flatMap((group) => group.cells.map(({ x, y }) => `${x}:${y}`)))
    for (const key of cleared) {
      const [x, y] = key.split(':').map(Number)
      board[y][x] = null
    }
    const score = groups.reduce((sum, group) => sum + scoreGroup(group.cells.length), 0) * waveIndex
    waves.push({ index: waveIndex, groups, clearedCells: cleared.size, score })
    board = applyColumnGravity(board)
  }

  return {
    board,
    waves,
    clearedCells: waves.reduce((sum, wave) => sum + wave.clearedCells, 0),
    score: waves.reduce((sum, wave) => sum + wave.score, 0),
  }
}
