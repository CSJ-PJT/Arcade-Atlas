import { Link } from 'react-router-dom'
import type { EngineSnapshot } from '../core/types'

interface GravityStackResultsProps {
  snapshot: EngineSnapshot
  onRestart: () => void
}

export function GravityStackResults({ snapshot, onRestart }: GravityStackResultsProps) {
  return (
    <div className="game-overlay game-overlay--result" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <p className="kicker">MISSION COMPLETE</p>
      <h2 id="game-over-title">게임 오버</h2>
      <dl className="result-grid">
        <div><dt>최종 점수</dt><dd>{snapshot.score.toLocaleString()}</dd></div>
        <div><dt>도달 레벨</dt><dd>{snapshot.level}</dd></div>
        <div><dt>제거한 셀</dt><dd>{snapshot.totalClearedCells}</dd></div>
        <div><dt>최대 연쇄</dt><dd>{snapshot.maxChain}</dd></div>
      </dl>
      <p className="seed-readout">PLAY SEED <code>{snapshot.seed}</code></p>
      <div className="overlay-actions">
        <button className="primary-action" type="button" onClick={onRestart} autoFocus>다시 시작</button>
        <Link className="secondary-action" to="/">Arcade 홈으로</Link>
      </div>
    </div>
  )
}
