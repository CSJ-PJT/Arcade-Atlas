import { useEffect, useRef } from 'react'
import type { GravityStackEngine } from '../core/engine'
import type { EngineSnapshot } from '../core/types'
import type { GameCommand } from '../core/types'
import { createGravityStackGame } from '../phaser/createGravityStackGame'

interface GravityStackCanvasProps {
  engine: GravityStackEngine
  onSnapshot: (snapshot: EngineSnapshot) => void
  simulationEnabled?: boolean
  onCommand?: (command: GameCommand) => void
}

export function GravityStackCanvas({ engine, onSnapshot, simulationEnabled = true, onCommand }: GravityStackCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onSnapshotRef = useRef(onSnapshot)

  useEffect(() => {
    onSnapshotRef.current = onSnapshot
  }, [onSnapshot])

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return undefined
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const game = createGravityStackGame({
      parent,
      engine,
      reducedMotion,
      onSnapshot: (next) => onSnapshotRef.current(next),
      simulationEnabled,
      onCommand,
    })
    return () => game.destroy(true)
  }, [engine, onCommand, simulationEnabled])

  return <div className="gravity-canvas" ref={hostRef} data-testid="gravity-canvas" aria-hidden="true" />
}
