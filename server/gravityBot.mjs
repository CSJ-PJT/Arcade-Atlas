const WIDTH = 12
const HEIGHT = 18
const ENERGIES = ['nova', 'solar', 'ion', 'plasma', 'terra']
const SHAPES = [
  [[0, 0], [0, 1], [0, 2]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0]], [[0, 1], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]],
]

function hashSeed(seed) {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0 || 0x9e3779b9
}

class Rng {
  constructor(seed) { this.state = hashSeed(seed) }
  next() { let value = this.state; value ^= value << 13; value ^= value >>> 17; value ^= value << 5; this.state = value >>> 0; return this.state }
  int(max) { return Math.floor((this.next() / 0x1_0000_0000) * max) }
}

function emptyBoard() { return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null)) }
function cloneBoard(board) { return board.map((row) => [...row]) }
function normalize(cells) {
  const minX = Math.min(...cells.map((cell) => cell.x)); const minY = Math.min(...cells.map((cell) => cell.y))
  return cells.map((cell) => ({ ...cell, x: cell.x - minX, y: cell.y - minY }))
}
function rotate(cells) { return normalize(cells.map((cell) => ({ ...cell, x: -cell.y, y: cell.x }))) }
function signature(cells) { return cells.map(({ x, y }) => `${x}:${y}`).sort().join('|') }
function collides(board, cells, offsetX, offsetY) {
  return cells.some((cell) => {
    const x = offsetX + cell.x; const y = offsetY + cell.y
    return x < 0 || x >= WIDTH || y >= HEIGHT || (y >= 0 && board[y][x] !== null)
  })
}
function gravity(board) {
  const result = emptyBoard()
  for (let x = 0; x < WIDTH; x += 1) {
    let target = HEIGHT - 1
    for (let y = HEIGHT - 1; y >= 0; y -= 1) if (board[y][x]) result[target--][x] = board[y][x]
  }
  return result
}
function groups(board) {
  const seen = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(false)); const found = []
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    if (!board[y][x] || seen[y][x]) continue
    const energy = board[y][x]; const cells = [{ x, y }]; seen[y][x] = true
    for (let cursor = 0; cursor < cells.length; cursor += 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cells[cursor].x + dx; const ny = cells[cursor].y + dy
      if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT && !seen[ny][nx] && board[ny][nx] === energy) { seen[ny][nx] = true; cells.push({ x: nx, y: ny }) }
    }
    if (cells.length >= 6) found.push(cells)
  }
  return found
}
function resolve(source) {
  let board = cloneBoard(source); let score = 0; let cleared = 0; let waves = 0
  for (let wave = 1; ; wave += 1) {
    const found = groups(board); if (!found.length) break
    const cells = new Set(found.flatMap((group) => group.map(({ x, y }) => `${x}:${y}`)))
    for (const key of cells) { const [x, y] = key.split(':').map(Number); board[y][x] = null }
    score += found.reduce((sum, group) => sum + group.length * 10 + Math.max(0, group.length - 6) * 20, 0) * wave
    cleared += cells.size; waves = wave; board = gravity(board)
  }
  return { board, score, cleared, waves }
}
function boardPenalty(board) {
  const heights = []; let holes = 0
  for (let x = 0; x < WIDTH; x += 1) {
    let first = HEIGHT
    for (let y = 0; y < HEIGHT; y += 1) if (board[y][x]) { first = Math.min(first, y) } else if (first < HEIGHT) holes += 1
    heights.push(HEIGHT - first)
  }
  const bumpiness = heights.slice(1).reduce((sum, height, index) => sum + Math.abs(height - heights[index]), 0)
  return holes * 42 + Math.max(...heights) * 7 + bumpiness * 3 + heights.reduce((sum, height) => sum + height, 0)
}

export const BOT_MOVE_INTERVALS = { rookie: 1400, pilot: 900, ace: 560 }

export class GravityBotEngine {
  constructor(seed, difficulty = 'pilot') {
    this.seed = seed; this.difficulty = BOT_MOVE_INTERVALS[difficulty] ? difficulty : 'pilot'; this.rng = new Rng(seed)
    this.board = emptyBoard(); this.score = 0; this.cleared = 0; this.maxChain = 0; this.moves = 0; this.status = 'playing'; this.nextPiece = this.#piece()
  }
  #piece() {
    const shape = SHAPES[this.rng.int(SHAPES.length)]
    return shape.map(([x, y]) => ({ x, y, energy: ENERGIES[this.rng.int(ENERGIES.length)] }))
  }
  step() {
    if (this.status !== 'playing') return this.snapshot()
    const piece = this.nextPiece; this.nextPiece = this.#piece(); const rotations = []; let cells = piece
    for (let turn = 0; turn < 4; turn += 1) { const key = signature(cells); if (!rotations.some((entry) => signature(entry) === key)) rotations.push(cells); cells = rotate(cells) }
    let best = null
    for (const candidate of rotations) {
      const width = Math.max(...candidate.map((cell) => cell.x)) + 1
      for (let x = 0; x <= WIDTH - width; x += 1) {
        if (collides(this.board, candidate, x, 0)) continue
        let y = 0; while (!collides(this.board, candidate, x, y + 1)) y += 1
        const placed = cloneBoard(this.board); for (const cell of candidate) placed[y + cell.y][x + cell.x] = cell.energy
        const result = resolve(placed); const value = result.score * 80 + result.cleared * 25 - boardPenalty(result.board)
        if (!best || value > best.value) best = { ...result, value }
      }
    }
    if (!best) { this.status = 'gameOver'; return this.snapshot() }
    this.board = best.board; this.score += best.score; this.cleared += best.cleared; this.maxChain = Math.max(this.maxChain, best.waves); this.moves += 1
    return this.snapshot()
  }
  replay(count) { for (let index = 0; index < count && this.status === 'playing'; index += 1) this.step(); return this.snapshot() }
  snapshot() { return { score: this.score, level: 1 + Math.floor(this.cleared / 30), cleared: this.cleared, maxChain: this.maxChain, moves: this.moves, gameStatus: this.status } }
}
