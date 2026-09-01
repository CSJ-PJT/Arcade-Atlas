import Phaser from 'phaser'
import type { GravityStackEngine } from '../core/engine'
import { BOARD_HEIGHT, BOARD_WIDTH, type EngineSnapshot, type GameCommand } from '../core/types'

const ENERGY_COLORS = {
  nova: 0x58d7ff,
  solar: 0xffc857,
  ion: 0x8b7cff,
  plasma: 0xff6ca8,
  terra: 0x65d49a,
} as const

interface SceneOptions {
  engine: GravityStackEngine
  onSnapshot: (snapshot: EngineSnapshot) => void
  reducedMotion: boolean
  simulationEnabled?: boolean
  onCommand?: (command: GameCommand) => void
}

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
  )
}

export class GravityStackScene extends Phaser.Scene {
  private readonly engine: GravityStackEngine
  private readonly onSnapshot: SceneOptions['onSnapshot']
  private readonly reducedMotion: boolean
  private readonly simulationEnabled: boolean
  private readonly onCommand?: (command: GameCommand) => void
  private boardGraphics?: Phaser.GameObjects.Graphics
  private lastRevision = -1
  private previousWaveCount = 0
  private keyboardHandler?: (event: KeyboardEvent) => void

  constructor(options: SceneOptions) {
    super({ key: 'GravityStackScene' })
    this.engine = options.engine
    this.onSnapshot = options.onSnapshot
    this.reducedMotion = options.reducedMotion
    this.simulationEnabled = options.simulationEnabled ?? true
    this.onCommand = options.onCommand
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(3, 13, 25, 0)')
    this.boardGraphics = this.add.graphics()
    this.keyboardHandler = (event) => this.handleKeyboard(event)
    this.input.keyboard?.on('keydown', this.keyboardHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keyboardHandler) this.input.keyboard?.off('keydown', this.keyboardHandler)
    })
    this.publishAndRender(true)
  }

  update(_time: number, delta: number): void {
    const tickChanged = this.simulationEnabled ? this.engine.tick(delta) : false
    if (tickChanged || this.engine.getSnapshot().revision !== this.lastRevision) {
      this.publishAndRender()
    }
  }

  private handleKeyboard(event: KeyboardEvent): void {
    if (isTextInput(event.target)) return
    const key = event.key
    const map: Record<string, GameCommand | undefined> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'rotate',
      ArrowDown: 'down',
      ' ': 'hardDrop',
      p: 'pauseToggle',
      P: 'pauseToggle',
      Escape: 'pauseToggle',
      r: 'restart',
      R: 'restart',
    }
    const command = map[key]
    if (!command) return
    const status = this.engine.getSnapshot().status
    if ((key.startsWith('Arrow') || key === ' ') && status === 'playing') event.preventDefault()
    if (this.onCommand) this.onCommand(command)
    else if (this.engine.execute(command)) this.publishAndRender()
  }

  private publishAndRender(force = false): void {
    const snapshot = this.engine.getSnapshot()
    if (!force && snapshot.revision === this.lastRevision) return
    this.lastRevision = snapshot.revision
    this.renderBoard(snapshot)
    this.onSnapshot(snapshot)
    if (!this.reducedMotion && snapshot.lastWaveCount > 0 && snapshot.lastWaveCount !== this.previousWaveCount) {
      this.cameras.main.flash(110, 88, 215, 255, false)
    }
    this.previousWaveCount = snapshot.lastWaveCount
  }

  private renderBoard(snapshot: EngineSnapshot): void {
    const graphics = this.boardGraphics
    if (!graphics) return
    graphics.clear()
    const cellSize = 28
    const originX = 12
    const originY = 16
    const cells = snapshot.board.map((row) => row.map((cell) => cell && { ...cell }))
    if (snapshot.activePiece) {
      for (const cell of snapshot.activePiece.cells) {
        const x = snapshot.activePiece.x + cell.x
        const y = snapshot.activePiece.y + cell.y
        if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) cells[y][x] = cell
      }
    }

    graphics.lineStyle(1, 0x26445f, 0.48)
    graphics.fillStyle(0x071523, 0.92)
    graphics.fillRoundedRect(originX - 6, originY - 6, BOARD_WIDTH * cellSize + 12, BOARD_HEIGHT * cellSize + 12, 12)

    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const px = originX + x * cellSize
        const py = originY + y * cellSize
        graphics.lineStyle(1, 0x28445d, 0.42)
        graphics.strokeRect(px, py, cellSize, cellSize)
        const cell = cells[y][x]
        if (!cell) continue
        const color = ENERGY_COLORS[cell.energy]
        graphics.fillStyle(color, 0.92)
        graphics.fillRoundedRect(px + 3, py + 3, cellSize - 6, cellSize - 6, 6)
        graphics.lineStyle(2, 0xffffff, 0.58)
        if (cell.symbol === '◆') {
          graphics.beginPath()
          graphics.moveTo(px + 14, py + 7)
          graphics.lineTo(px + 21, py + 14)
          graphics.lineTo(px + 14, py + 21)
          graphics.lineTo(px + 7, py + 14)
          graphics.closePath()
          graphics.strokePath()
        }
        else if (cell.symbol === '●') graphics.strokeCircle(px + 14, py + 14, 5)
        else if (cell.symbol === '▲') graphics.strokeTriangle(px + 14, py + 8, px + 8, py + 20, px + 20, py + 20)
        else if (cell.symbol === '■') graphics.strokeRect(px + 9, py + 9, 10, 10)
        else {
          graphics.beginPath()
          graphics.moveTo(px + 14, py + 7)
          graphics.lineTo(px + 17, py + 12)
          graphics.lineTo(px + 22, py + 14)
          graphics.lineTo(px + 17, py + 17)
          graphics.lineTo(px + 14, py + 22)
          graphics.lineTo(px + 11, py + 17)
          graphics.lineTo(px + 6, py + 14)
          graphics.lineTo(px + 11, py + 12)
          graphics.closePath()
          graphics.strokePath()
        }
      }
    }
  }
}
