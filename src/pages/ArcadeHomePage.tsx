import { Link } from 'react-router-dom'
import { gameCatalog } from '../app/gameCatalog'
import { AtlasBrand } from '../components/AtlasBrand'
import { readBestScore } from '../games/gravity-stack/localBest'
import { useMusicScope } from '../audio/MusicProvider'
import { useI18n } from '../i18n/I18nProvider'

export function ArcadeHomePage() {
  useMusicScope('lobby')
  const { t } = useI18n()
  const bestScore = readBestScore()
  return (
    <main className="arcade-shell" data-testid="arcade-home">
      <header className="home-hero">
        <AtlasBrand />
        <div className="home-hero__copy">
          <p className="kicker">MISSION SELECT</p>
          <h1>{t('home.title', '짧게 시작하고,\n끝까지 플레이하세요.').split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1>
          <p>{t('home.description', '설치 없이 브라우저에서 즐기는 Atlas 아케이드 실험실입니다.')}</p>
        </div>
        <div className="mission-readout" aria-label={t('home.inputs', '지원 입력 방식')}>
          <span>LOCAL BEST <strong>{bestScore.toLocaleString()}</strong></span>
          <span>INPUT <strong>KEY + TOUCH</strong></span>
        </div>
      </header>

      <section className="game-grid" aria-labelledby="game-grid-title">
        <div className="section-heading">
          <p className="kicker">AVAILABLE MISSIONS</p>
          <h2 id="game-grid-title">{t('home.games', '게임 선택')}</h2>
        </div>
        <div className="game-grid__cards">
          {gameCatalog.map((game, index) => (
            <article className={`game-card game-card--${game.status}`} key={game.id} data-testid={`game-card-${game.id}`}>
              <div className="game-card__index" aria-hidden="true">0{index + 1}</div>
              <p className="kicker">{game.eyebrow}</p>
              <h3>{game.title}</h3>
              <p>{t(`catalog.${game.id}.description`, game.description)}</p>
              <div className="game-card__meta">
                <span>{t(`catalog.${game.id}.controls`, game.controls)}</span>
                {game.status === 'playable' && game.route ? (
                  <div className="game-card__actions">
                    <Link className="primary-action" to={game.route}>{t('home.play', 'Gravity Stack 플레이')}</Link>
                    <Link className="secondary-action" to="/stack/multi">{t('home.multiplayer', '실시간 대전')}</Link>
                  </div>
                ) : (
                  <span className="upcoming-badge" aria-disabled="true">{t('home.upcoming', '준비 중')}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
