import { useEffect, useRef } from 'react'
import type { GravityStackEngine } from '../core/engine'
import type { EngineSnapshot } from '../core/types'
import { createGravityStackGame } from '../phaser/createGravityStackGame'

interface GravityStackCanvasProps {
  engine: GravityStackEngine
  onSnapshot: (snapshot: EngineSnapshot) => void
}

export function GravityStackCanvas({ engine, onSnapshot }: GravityStackCanvasProps) {
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
    })
    return () => game.destroy(true)
  }, [engine])

  return <div className="gravity-canvas" ref={hostRef} data-testid="gravity-canvas" aria-hidden="true" />
}
