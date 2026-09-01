import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtlasBrand } from '../../components/AtlasBrand'
import { GravityStackEngine } from './core/engine'
import type { EngineSnapshot, GameCommand } from './core/types'
import { GravityStackCanvas } from './components/GravityStackCanvas'
import { GravityStackControls } from './components/GravityStackControls'
import { GravityStackHud } from './components/GravityStackHud'
import { GravityStackResults } from './components/GravityStackResults'
import { readBestScore, writeBestScore } from './localBest'
import './gravity-stack.css'
import { useMusicScope } from '../../audio/MusicProvider'

function createSeed(): string {
  try {
    const values = new Uint32Array(2)
    crypto.getRandomValues(values)
    return `GS-${values[0].toString(36)}-${values[1].toString(36)}`
  } catch {
    return `GS-${Date.now().toString(36)}`
  }
}

function statusMessage(snapshot: EngineSnapshot): string {
  if (snapshot.status === 'ready') return 'Gravity Stack 준비 완료'
  if (snapshot.status === 'paused') return '게임이 일시정지되었습니다.'
  if (snapshot.status === 'gameOver') return `게임 오버. 최종 점수 ${snapshot.score}점`
  if (snapshot.lastWaveCount > 0) return `${snapshot.lastWaveCount}연쇄 방전`
  return `게임 진행 중. 레벨 ${snapshot.level}, 점수 ${snapshot.score}`
}

export function GravityStackPage() {
  const engine = useMemo(() => new GravityStackEngine(createSeed()), [])
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot())
  const [bestScore, setBestScore] = useState(() => readBestScore())
  useMusicScope(snapshot.status === 'ready' ? 'lobby' : 'game')
  const readyButtonRef = useRef<HTMLButtonElement>(null)
  const pauseButtonRef = useRef<HTMLButtonElement>(null)

  const publish = useCallback((next: EngineSnapshot) => {
    setSnapshot(next)
    if (next.status === 'gameOver' && next.score > readBestScore()) {
      writeBestScore(next.score)
      setBestScore(next.score)
    }
  }, [])

  const command = useCallback((nextCommand: GameCommand) => {
    if (engine.execute(nextCommand)) publish(engine.getSnapshot())
  }, [engine, publish])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && engine.pause()) publish(engine.getSnapshot())
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [engine, publish])

  useEffect(() => {
    if (snapshot.status === 'ready') readyButtonRef.current?.focus({ preventScroll: true })
    if (snapshot.status === 'paused') pauseButtonRef.current?.focus({ preventScroll: true })
  }, [snapshot.status])

  const restart = () => command('restart')

  return (
    <main className="gravity-page" data-testid="gravity-stack-page" data-game-status={snapshot.status} data-active-x={snapshot.activePiece?.x ?? ''}>
      <header className="gravity-topbar">
        <AtlasBrand compact />
        <Link className="text-link" to="/">미션 선택</Link>
      </header>

      <div className="gravity-layout">
        <section className="gravity-stage" aria-labelledby="gravity-title">
          <div className="gravity-stage__heading">
            <div>
              <p className="kicker">ENERGY ARRAY 01</p>
              <h1 id="gravity-title">Gravity Stack</h1>
            </div>
            <p>같은 에너지 6개를 상하좌우로 연결해 연쇄 방전을 만드세요.</p>
          </div>

          <GravityStackHud snapshot={snapshot} bestScore={bestScore} />

          <div className="board-frame" tabIndex={0} aria-label="Gravity Stack 게임 보드. 방향키와 스페이스로 조작합니다.">
            <GravityStackCanvas engine={engine} onSnapshot={publish} />
            {snapshot.status === 'ready' && (
              <div className="game-overlay" role="dialog" aria-modal="true" aria-labelledby="ready-title">
                <p className="kicker">CONTROL LINK READY</p>
                <h2 id="ready-title">에너지 배열을 시작할까요?</h2>
                <p>방향키 또는 아래의 터치 패널로 조작할 수 있습니다.</p>
                <button ref={readyButtonRef} className="primary-action" type="button" onClick={() => command('start')}>게임 시작</button>
              </div>
            )}
            {snapshot.status === 'paused' && (
              <div className="game-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
                <p className="kicker">ARRAY HOLD</p>
                <h2 id="pause-title">일시정지</h2>
                <p>자동으로 재개하지 않습니다. 준비되면 직접 계속하세요.</p>
                <div className="overlay-actions">
                  <button ref={pauseButtonRef} className="primary-action" type="button" onClick={() => command('pauseToggle')}>계속하기</button>
                  <button className="secondary-action" type="button" onClick={restart}>다시 시작</button>
                </div>
              </div>
            )}
            {snapshot.status === 'gameOver' && <GravityStackResults snapshot={snapshot} onRestart={restart} />}
          </div>

          <GravityStackControls onCommand={command} status={snapshot.status} />
          <div className="screen-reader-status" aria-live="polite" aria-atomic="true">{statusMessage(snapshot)}</div>
        </section>

        <aside className="gravity-briefing" aria-label="Gravity Stack 조작 및 상태">
          <section>
            <p className="kicker">CONTROL MAP</p>
            <h2>조작</h2>
            <dl className="key-map">
              <div><dt>← →</dt><dd>좌우 이동</dd></div>
              <div><dt>↑</dt><dd>회전</dd></div>
              <div><dt>↓</dt><dd>한 칸 낙하</dd></div>
              <div><dt>SPACE</dt><dd>즉시 낙하</dd></div>
              <div><dt>P / ESC</dt><dd>일시정지</dd></div>
              <div><dt>R</dt><dd>정지 상태에서 재시작</dd></div>
            </dl>
          </section>
          <section>
            <p className="kicker">MISSION DATA</p>
            <dl className="mission-data">
              <div><dt>제거 셀</dt><dd>{snapshot.totalClearedCells}</dd></div>
              <div><dt>최대 연쇄</dt><dd>{snapshot.maxChain}</dd></div>
              <div><dt>낙하 간격</dt><dd>{snapshot.dropIntervalMs} ms</dd></div>
              <div><dt>상태</dt><dd>{snapshot.status}</dd></div>
            </dl>
          </section>
          <button className="pause-control" type="button" onClick={() => command('pauseToggle')} disabled={snapshot.status === 'ready' || snapshot.status === 'gameOver'}>
            {snapshot.status === 'paused' ? '계속하기' : '일시정지'}
          </button>
          <p className="seed-readout">PLAY SEED <code>{snapshot.seed}</code></p>
        </aside>
      </div>
    </main>
  )
}
