import Phaser from 'phaser'
import type { GravityStackEngine } from '../core/engine'
import type { EngineSnapshot, GameCommand } from '../core/types'
import { GravityStackScene } from './GravityStackScene'

interface CreateGameOptions {
  parent: HTMLElement
  engine: GravityStackEngine
  onSnapshot: (snapshot: EngineSnapshot) => void
  reducedMotion: boolean
  simulationEnabled?: boolean
  onCommand?: (command: GameCommand) => void
}

export function createGravityStackGame(options: CreateGameOptions): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    width: 360,
    height: 548,
    transparent: true,
    render: { antialias: true, pixelArt: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new GravityStackScene(options)],
  })
}
