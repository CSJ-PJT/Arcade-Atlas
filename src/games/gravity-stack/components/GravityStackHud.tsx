import type { EngineSnapshot } from '../core/types'

interface GravityStackHudProps {
  snapshot: EngineSnapshot
  bestScore: number
}

export function GravityStackHud({ snapshot, bestScore }: GravityStackHudProps) {
  return (
    <section className="gravity-hud" aria-label="게임 점수판">
      <div><span>SCORE</span><strong data-testid="score">{snapshot.score.toLocaleString()}</strong></div>
      <div><span>LEVEL</span><strong data-testid="level">{snapshot.level}</strong></div>
      <div><span>BEST</span><strong>{bestScore.toLocaleString()}</strong></div>
      <div className="next-module" aria-label="다음 조각">
        <span>NEXT</span>
        <div className="next-module__cells">
          {snapshot.nextPiece.cells.map((cell, index) => (
            <i key={`${cell.x}:${cell.y}:${index}`} data-energy={cell.energy} title={cell.energy}>{cell.symbol}</i>
          ))}
        </div>
      </div>
    </section>
  )
}
