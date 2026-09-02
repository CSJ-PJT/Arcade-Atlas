import { GravityStackEngine } from '../src/games/gravity-stack/core/engine.ts'
import { SeededRng } from '../src/games/gravity-stack/core/rng.ts'

export const BOT_ENGINE_VERSION = 'atlas-bot-engine-v3'
export const BOT_MOVE_INTERVALS = { rookie: 1450, pilot: 1050, ace: 820 }

function boardPenalty(board) {
  const heights = []
  let holes = 0
  for (let x = 0; x < 12; x += 1) {
    let first = 18
    for (let y = 0; y < 18; y += 1) {
      if (board[y][x]) first = Math.min(first, y)
      else if (first < 18) holes += 1
    }
    heights.push(18 - first)
  }
  const bumpiness = heights.slice(1).reduce((sum, height, index) => sum + Math.abs(height - heights[index]), 0)
  return holes * 42 + Math.max(...heights) * 7 + bumpiness * 3 + heights.reduce((sum, height) => sum + height, 0)
}

function candidatePlacements(engine) {
  const origin = engine.getCheckpoint()
  const candidates = []
  for (let rotations = 0; rotations < 4; rotations += 1) {
    for (let shift = -11; shift <= 11; shift += 1) {
      const simulation = new GravityStackEngine(engine.seed)
      simulation.restoreCheckpoint(origin)
      for (let turn = 0; turn < rotations; turn += 1) simulation.execute('rotate')
      const command = shift < 0 ? 'left' : 'right'
      let valid = true
      for (let step = 0; step < Math.abs(shift); step += 1) if (!simulation.execute(command)) { valid = false; break }
      if (!valid || !simulation.execute('hardDrop')) continue
      const snapshot = simulation.getSnapshot()
      const deltaScore = snapshot.score - origin.score
      const deltaCleared = snapshot.totalClearedCells - origin.totalClearedCells
      const value = deltaScore * 80 + deltaCleared * 25 + snapshot.lastWaveCount * 180 - boardPenalty(snapshot.board)
      const signature = JSON.stringify([snapshot.board, snapshot.activePiece, snapshot.nextPiece])
      if (!candidates.some((entry) => entry.signature === signature)) candidates.push({ checkpoint: simulation.getCheckpoint(), value, signature })
    }
  }
  return candidates.sort((left, right) => right.value - left.value)
}

export class GravityBotEngine {
  constructor(seed, difficulty = 'pilot', decisionSeed = seed) {
    this.seed = seed
    this.difficulty = BOT_MOVE_INTERVALS[difficulty] ? difficulty : 'pilot'
    this.engine = new GravityStackEngine(seed)
    this.engine.start()
    this.decisionRng = new SeededRng(`${decisionSeed}:${this.difficulty}`)
    this.moves = 0
  }

  step() {
    if (this.engine.getSnapshot().status !== 'playing') return this.snapshot()
    const candidates = candidatePlacements(this.engine)
    if (candidates.length === 0) return this.snapshot()
    let pool = 1
    if (this.difficulty === 'rookie') pool = this.decisionRng.next() < 0.22 ? Math.min(5, candidates.length) : Math.min(3, candidates.length)
    else if (this.difficulty === 'pilot') pool = Math.min(2, candidates.length)
    const selected = candidates[this.decisionRng.int(pool)]
    this.engine.restoreCheckpoint(selected.checkpoint)
    this.moves += 1
    return this.snapshot()
  }

  forceDropCells(count) {
    this.engine.forceDropCells(count)
    return this.snapshot()
  }

  checkpoint() {
    return this.engine.getCheckpoint()
  }

  replay(count) {
    for (let index = 0; index < count && this.engine.getSnapshot().status === 'playing'; index += 1) this.step()
    return this.snapshot()
  }

  snapshot() {
    const snapshot = this.engine.getSnapshot()
    return {
      score: snapshot.score,
      level: snapshot.level,
      cleared: snapshot.totalClearedCells,
      maxChain: snapshot.maxChain,
      moves: this.moves,
      gameStatus: snapshot.status,
      board: snapshot.board,
      lastWaveCount: snapshot.lastWaveCount,
    }
  }
}
