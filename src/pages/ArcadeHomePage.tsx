import { Link } from 'react-router-dom'
import { gameCatalog } from '../app/gameCatalog'
import { AtlasBrand } from '../components/AtlasBrand'
import { readBestScore } from '../games/gravity-stack/localBest'
import { useMusicScope } from '../audio/MusicProvider'
import { useI18n } from '../i18n/I18nProvider'
import { AtlasAccountButton } from '../auth/AtlasAccountButton'

export function ArcadeHomePage() {
  useMusicScope('lobby')
  const { t } = useI18n()
  const bestScore = readBestScore()
  return (
    <main className="arcade-shell" data-testid="arcade-home">
      <header className="home-hero">
        <div className="home-hero__topbar">
          <AtlasBrand />
          <div className="home-account-cluster">
            <span className="online-pill"><i aria-hidden="true" />{t('home.online', '바로 플레이 가능')}</span>
            <AtlasAccountButton />
          </div>
        </div>
        <div className="home-hero__copy">
          <p className="kicker">ARCADE PLAYGROUND</p>
          <h1>{t('home.title', '짧게 시작하고,\n끝까지 플레이하세요.').split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1>
          <p>{t('home.description', '설치 없이 브라우저에서 즐기는 Atlas 아케이드 실험실입니다.')}</p>
          <div className="hero-tags" aria-label={t('home.features', '게임 특징')}>
            <span>⚡ {t('home.quick', '바로 시작')}</span>
            <span>🎮 {t('home.controlsShort', '키보드 · 터치')}</span>
            <span>🤖 {t('home.ai', 'Atlas AI 대전')}</span>
          </div>
        </div>
        <figure className="home-hero__art">
          <span className="art-spark art-spark--one" aria-hidden="true">✦</span>
          <span className="art-spark art-spark--two" aria-hidden="true">●</span>
          <img src="/arcade/images/arcade-energy-crew.png" alt={t('home.mascotAlt', '함께 비행하는 귀여운 에너지 탐사대')} />
        </figure>
        <div className="mission-readout" aria-label={t('home.inputs', '지원 입력 방식')}>
          <span><small>{t('home.best', '이 기기 최고 점수')}</small><strong>🏆 {bestScore.toLocaleString()}</strong></span>
          <span><small>{t('home.players', '플레이 방식')}</small><strong>{t('home.singleMulti', '혼자 또는 함께')}</strong></span>
        </div>
      </header>

      <section className="sso-notice" aria-labelledby="sso-notice-title">
        <span className="sso-notice__icon" aria-hidden="true">🔐</span>
        <div>
          <p className="kicker">ONE ATLAS ACCOUNT</p>
          <h2 id="sso-notice-title">{t('auth.noticeTitle', 'Sketchfy 계정으로 멀티플레이까지')}</h2>
          <p>{t('auth.noticeHelp', '기존 Atlas 계정과 로그인 세션을 그대로 사용합니다. 싱글플레이는 로그인 없이 체험할 수 있습니다.')}</p>
        </div>
        <Link className="secondary-action" to="/login">{t('auth.readGuide', '로그인 안내 보기')}</Link>
      </section>

      <section className="game-grid" aria-labelledby="game-grid-title">
        <div className="section-heading">
          <p className="kicker">PICK YOUR GAME</p>
          <h2 id="game-grid-title">{t('home.games', '게임 선택')}</h2>
          <p>{t('home.gamesHelp', '오늘 즐길 게임을 골라 바로 시작하세요.')}</p>
        </div>
        <div className="game-grid__cards">
          {gameCatalog.map((game, index) => (
            <article className={`game-card game-card--${game.status}`} key={game.id} data-testid={`game-card-${game.id}`}>
              <div className="game-card__index" aria-hidden="true">0{index + 1}</div>
              <div className={`game-card__icon game-card__icon--${game.id}`} aria-hidden="true">
                {game.id === 'gravity-stack' ? '✦' : game.id === 'orbit-snake' ? '◎' : '◆'}
              </div>
              <p className="kicker">{game.eyebrow}</p>
              <h3>{game.title}</h3>
              <p>{t(`catalog.${game.id}.description`, game.description)}</p>
              <div className="game-card__meta">
                <span>{t(`catalog.${game.id}.controls`, game.controls)}</span>
                {game.status === 'playable' && game.route ? (
                  <div className="game-card__actions">
                    <Link className="primary-action" to={game.route}><span aria-hidden="true">▶</span>{t('home.play', '싱글 플레이')}</Link>
                    <Link className="secondary-action" to="/stack/multi"><span aria-hidden="true">●●</span>{t('home.multiplayer', '멀티 플레이')}</Link>
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
