import { Link } from 'react-router-dom'
import type { EngineSnapshot } from '../core/types'
import { useI18n } from '../../../i18n/I18nProvider'

interface GravityStackResultsProps {
  snapshot: EngineSnapshot
  onRestart: () => void
}

export function GravityStackResults({ snapshot, onRestart }: GravityStackResultsProps) {
  const { t, locale } = useI18n()
  return (
    <div className="game-overlay game-overlay--result" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <p className="kicker">MISSION COMPLETE</p>
      <h2 id="game-over-title">{t('result.gameOver', '게임 오버')}</h2>
      <dl className="result-grid">
        <div><dt>{t('result.finalScore', '최종 점수')}</dt><dd>{snapshot.score.toLocaleString(locale)}</dd></div>
        <div><dt>{t('result.level', '도달 레벨')}</dt><dd>{snapshot.level}</dd></div>
        <div><dt>{t('result.cleared', '제거한 셀')}</dt><dd>{snapshot.totalClearedCells}</dd></div>
        <div><dt>{t('result.maxChain', '최대 연쇄')}</dt><dd>{snapshot.maxChain}</dd></div>
      </dl>
      <p className="seed-readout">PLAY SEED <code>{snapshot.seed}</code></p>
      <div className="overlay-actions">
        <button className="primary-action" type="button" onClick={onRestart} autoFocus>{t('common.restart', '다시 시작')}</button>
        <Link className="secondary-action" to="/">{t('common.arcadeHome', 'Arcade 홈으로')}</Link>
      </div>
    </div>
  )
}
