import type { EngineSnapshot } from '../core/types'
import { useI18n } from '../../../i18n/I18nProvider'

interface GravityStackHudProps {
  snapshot: EngineSnapshot
  bestScore: number
  hideNext?: boolean
}

export function GravityStackHud({ snapshot, bestScore, hideNext = false }: GravityStackHudProps) {
  const { t, locale } = useI18n()
  return (
    <section className="gravity-hud" aria-label={t('hud.scoreboard', '게임 점수판')}>
      <div><span>SCORE</span><strong data-testid="score">{snapshot.score.toLocaleString(locale)}</strong></div>
      <div><span>LEVEL</span><strong data-testid="level">{snapshot.level}</strong></div>
      <div><span>BEST</span><strong>{bestScore.toLocaleString(locale)}</strong></div>
      <div className="next-module" aria-label={t('hud.next', '다음 조각')}>
        <span>NEXT</span>
        <div className="next-module__cells" data-hidden={hideNext || undefined}>
          {hideNext ? <strong aria-label={t('hud.previewJammed', '다음 조각 센서 교란 중')}>???</strong> : snapshot.nextPiece.cells.map((cell, index) => (
            <i key={`${cell.x}:${cell.y}:${index}`} data-energy={cell.energy} title={cell.energy}>{cell.symbol}</i>
          ))}
        </div>
      </div>
    </section>
  )
}
