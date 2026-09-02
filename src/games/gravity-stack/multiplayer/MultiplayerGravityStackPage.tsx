import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtlasBrand } from '../../../components/AtlasBrand'
import { GravityStackCanvas } from '../components/GravityStackCanvas'
import { GravityStackControls } from '../components/GravityStackControls'
import { GravityStackHud } from '../components/GravityStackHud'
import { ArcadeFxOverlay, type ArcadeFxCue } from '../components/ArcadeFxOverlay'
import { GravityStackEngine } from '../core/engine'
import type { EngineSnapshot, GameCommand } from '../core/types'
import { useMultiplayerRoom } from './useMultiplayerRoom'
import type { MatchStart, MultiplayerPlayer, MultiplayerRoom } from './types'
import type { BotDifficulty, ItemEvent, ItemType, MultiplayerMode } from './types'
import { useMusicScope } from '../../../audio/MusicProvider'
import { useI18n } from '../../../i18n/I18nProvider'
import { useAtlasAuth } from '../../../auth/AuthProvider'
import '../gravity-stack.css'
import './multiplayer.css'

export function MultiplayerGravityStackPage() {
  const { t } = useI18n()
  const auth = useAtlasAuth()
  const multiplayer = useMultiplayerRoom()
  const [name, setName] = useState(() => auth.profile?.nickname?.slice(0, 16) ?? '')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<MultiplayerMode>('normal')
  const me = multiplayer.room?.players.find((player) => player.id === multiplayer.playerId)
  useMusicScope(multiplayer.match ? 'game' : 'lobby')

  const rememberName = () => {
    const next = name.trim().slice(0, 16)
    if (!next) return false
    return true
  }

  return (
    <main className="multiplayer-page" data-testid="multiplayer-page" data-connection={multiplayer.connection}>
      <header className="gravity-topbar">
        <AtlasBrand compact />
        <Link className="text-link" to="/">{t('common.missionSelect', '미션 선택')}</Link>
      </header>
      {multiplayer.connection === 'reconnecting' && <p className="reconnect-banner" role="status">{t('multi.reconnecting', '연결이 잠시 끊겼습니다. 방을 유지한 채 자동 복구 중입니다.')}</p>}
      {!multiplayer.room && multiplayer.playerId && (
        <section className="multiplayer-entry reconnect-panel" aria-live="polite"><p className="kicker">LINK RECOVERY</p><h1>{t('multi.recoveryTitle', '이전 방으로 복귀 중')}</h1><p>{t('multi.recoveryHelp', '30초 안에 연결이 돌아오면 진행 상태를 그대로 이어갑니다.')}</p></section>
      )}
      {!multiplayer.room && !multiplayer.playerId && (
        <section className="multiplayer-entry" aria-labelledby="multi-title">
          <p className="kicker">LIVE ENERGY RACE</p>
          <h1 id="multi-title">{t('multi.title', 'Gravity Stack 실시간 대전')}</h1>
          <p>{t('multi.description', '2~4명이 같은 seed로 동시에 시작합니다. 조작은 서버 공통 엔진이 판정하며, 각자 보드에서 더 높은 점수를 만드세요.')}</p>
          <label>{t('multi.name', '표시 이름')}<input value={name} maxLength={16} autoComplete="nickname" readOnly={import.meta.env.MODE !== 'e2e'} aria-readonly={import.meta.env.MODE !== 'e2e'} onChange={(event) => setName(event.target.value)} /></label>
          <p className="connection-note">{t('multi.sharedProfileName', 'Sketchfy Atlas 프로필의 닉네임을 사용합니다.')}</p>
          <fieldset className="mode-selector"><legend>{t('multi.mode', '게임 모드')}</legend><label><input type="radio" name="mode" value="normal" checked={mode === 'normal'} onChange={() => setMode('normal')} /><span><strong>{t('multi.normal', '일반 모드')}</strong>{t('multi.normalHelp', '같은 조건으로 순수 점수 대결')}</span></label><label><input type="radio" name="mode" value="items" checked={mode === 'items'} onChange={() => setMode('items')} /><span><strong>{t('multi.items', '아이템 모드')}</strong>{t('multi.itemsHelp', '방전으로 방어막과 중력 펄스 획득')}</span></label></fieldset>
          <div className="multiplayer-entry__actions">
            <button className="primary-action" type="button" disabled={multiplayer.connection !== 'open' || !name.trim()} onClick={() => rememberName() && multiplayer.createRoom(name, mode)}>{t('multi.create', '새 방 만들기')}</button>
            <div className="join-controls">
              <label>{t('multi.code', '방 코드')}<input value={code} maxLength={6} autoCapitalize="characters" onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} /></label>
              <button className="secondary-action" type="button" disabled={multiplayer.connection !== 'open' || !name.trim() || code.length !== 6} onClick={() => rememberName() && multiplayer.joinRoom(code, name)}>{t('multi.join', '참가')}</button>
            </div>
          </div>
          <p className="connection-note" aria-live="polite">{t('multi.connection', `실시간 연결: ${multiplayer.connection}`, { state: multiplayer.connection })}</p>
          {multiplayer.error && <p className="form-error" role="alert">{multiplayer.error}</p>}
        </section>
      )}
      {multiplayer.room && !multiplayer.match && me && (
        <MultiplayerLobby room={multiplayer.room} me={me} error={multiplayer.error} onReady={multiplayer.setReady} onStart={multiplayer.startMatch} onAddBot={multiplayer.addBot} onRemoveBot={multiplayer.removeBot} />
      )}
      {multiplayer.room && multiplayer.match && me && (
        <MultiplayerMatch room={multiplayer.room} me={me} match={multiplayer.match} itemEvent={multiplayer.itemEvent} authoritativeState={multiplayer.authoritativeState} onUseItem={multiplayer.useItem} sendInput={multiplayer.sendInput} onForfeit={multiplayer.forfeit} onRematch={multiplayer.rematch} />
      )}
    </main>
  )
}

function MultiplayerLobby({ room, me, error, onReady, onStart, onAddBot, onRemoveBot }: { room: MultiplayerRoom; me: MultiplayerPlayer; error: string; onReady: (ready: boolean) => boolean; onStart: () => boolean; onAddBot: (difficulty: BotDifficulty) => boolean; onRemoveBot: (id: string) => boolean }) {
  const { t } = useI18n()
  const [difficulty, setDifficulty] = useState<BotDifficulty>('pilot')
  const allReady = room.players.length >= 2 && room.players.every((player) => player.connected && player.ready)
  return (
    <section className="multiplayer-lobby" data-testid="multiplayer-lobby">
      <p className="kicker">ROOM LINK</p>
      <h1>{t('multi.code', '방 코드')} <strong data-testid="room-code">{room.code}</strong></h1>
      <p className="mode-badge">{room.mode === 'items' ? t('multi.items', '아이템 모드') : t('multi.normal', '일반 모드')}</p>
      <p>{t('multi.invite', '코드를 함께 플레이할 사람에게 전달하세요. 최대 4명까지 참가할 수 있습니다.')}</p>
      <PlayerStandings players={room.players} onRemoveBot={me.isHost ? onRemoveBot : undefined} />
      {me.isHost && <div className="bot-controls"><label>{t('multi.aiDifficulty', 'AI 난이도')}<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}><option value="rookie">{t('multi.rookie', '루키 · 여유롭게')}</option><option value="pilot">{t('multi.pilot', '파일럿 · 균형')}</option><option value="ace">{t('multi.ace', '에이스 · 빠르게')}</option></select></label><button className="secondary-action" type="button" disabled={room.players.length >= 4} onClick={() => onAddBot(difficulty)}>{t('multi.addAi', 'Atlas AI 추가')}</button></div>}
      <div className="lobby-actions">
        <button className={me.ready ? 'secondary-action' : 'primary-action'} type="button" onClick={() => onReady(!me.ready)}>{me.ready ? t('multi.cancelReady', '준비 취소') : t('multi.ready', '준비 완료')}</button>
        {me.isHost && <button className="primary-action" type="button" disabled={!allReady} onClick={onStart}>{t('multi.startTogether', '동시 시작')}</button>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

function MultiplayerMatch({ room, me, match, itemEvent, authoritativeState, onUseItem, sendInput, onForfeit, onRematch }: { room: MultiplayerRoom; me: MultiplayerPlayer; match: MatchStart; itemEvent: ItemEvent | null; authoritativeState: import('../core/types').EngineCheckpoint | null; onUseItem: (item: ItemType, targetId?: string) => boolean; sendInput: (command: GameCommand) => boolean; onForfeit: () => boolean; onRematch: () => boolean }) {
  const { t, locale } = useI18n()
  const engine = useMemo(() => new GravityStackEngine(match.seed), [match.seed])
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot())
  const [fxCue, setFxCue] = useState<ArcadeFxCue | null>(null)
  const itemEventRef = useRef('')
  const previousFxState = useRef({ status: snapshot.status, cleared: snapshot.totalClearedCells, roomStatus: room.status })

  useEffect(() => {
    if (authoritativeState && engine.restoreCheckpoint(authoritativeState)) {
      const next = engine.getSnapshot()
      queueMicrotask(() => setSnapshot(next))
    }
  }, [authoritativeState, engine])

  const publish = useCallback((next: EngineSnapshot) => setSnapshot(next), [])

  const command = useCallback((next: GameCommand) => {
    sendInput(next)
  }, [sendInput])

  useEffect(() => {
    if (!itemEvent || itemEvent.eventId === itemEventRef.current) return
    itemEventRef.current = itemEvent.eventId
    const source = room.players.find((player) => player.id === itemEvent.sourceId)
    const targetPlayer = room.players.find((player) => player.id === itemEvent.targetId)
    if (itemEvent.itemType === 'shield' && itemEvent.sourceId === me.id) {
      queueMicrotask(() => setFxCue({ id: itemEvent.eventId, kind: 'shield', eyebrow: t('fx.itemReady', 'ITEM ACTIVE'), title: t('fx.shieldOn', '방어막 발동!'), detail: t('fx.blockOne', '중력 펄스 1회 방어') }))
    }
    else if (itemEvent.targetId === me.id) {
      queueMicrotask(() => setFxCue(itemEvent.blocked
        ? { id: itemEvent.eventId, kind: 'blocked', eyebrow: t('fx.perfectGuard', 'PERFECT GUARD'), title: t('fx.blocked', '공격 방어!'), detail: t('fx.shieldSaved', '방어막이 보드를 지켰습니다') }
        : itemTargetCue(itemEvent, source?.name ?? 'RIVAL', t)))
    }
    else if (itemEvent.sourceId === me.id) {
      queueMicrotask(() => setFxCue(itemSourceCue(itemEvent, targetPlayer?.name ?? 'RIVAL', t)))
    }
  }, [itemEvent, me.id, room.players, t])

  useEffect(() => {
    const previous = previousFxState.current
    if (room.status === 'finished' && previous.roomStatus !== 'finished') {
      queueMicrotask(() => setFxCue({ id: `finish-${room.matchId}`, kind: 'finish', eyebrow: t('fx.matchComplete', 'MATCH COMPLETE'), title: t('fx.finish', '게임 종료!'), detail: t('fx.rankingReady', '최종 순위를 확인하세요') }))
    }
    else if (snapshot.totalClearedCells > previous.cleared) {
      const chain = Math.max(1, snapshot.lastWaveCount)
      queueMicrotask(() => setFxCue({ id: `chain-${snapshot.revision}`, kind: 'chain', eyebrow: t('fx.energyBurst', 'ENERGY BURST'), title: t('fx.chain', `${chain} CHAIN!`, { chain }), detail: t('fx.cellsCleared', `${snapshot.totalClearedCells - previous.cleared}셀 방전`, { count: snapshot.totalClearedCells - previous.cleared }) }))
    }
    else if (snapshot.status === 'playing' && previous.status !== 'playing') {
      queueMicrotask(() => setFxCue({ id: `start-${match.matchId}-${snapshot.revision}`, kind: 'start', eyebrow: t('fx.ready', 'READY'), title: t('fx.go', 'GO!'), detail: t('fx.outscore', '상대보다 높이 쌓으세요') }))
    }
    previousFxState.current = { status: snapshot.status, cleared: snapshot.totalClearedCells, roomStatus: room.status }
  }, [match.matchId, room.matchId, room.status, snapshot, t])

  const target = room.players.filter((player) => player.id !== me.id && player.connected && player.gameStatus === 'playing').sort((a, b) => b.score - a.score)[0]
  const winner = [...room.players].sort((a, b) => b.score - a.score || b.maxChain - a.maxChain || b.cleared - a.cleared)[0]
  const boardSignature = JSON.stringify(snapshot.board.map((row) => row.map((cell) => cell?.energy?.[0] ?? '-')))

  return (
    <div className="multiplayer-match" data-testid="multiplayer-match" data-game-status={snapshot.status} data-score={snapshot.score} data-revision={snapshot.revision} data-board-signature={boardSignature} data-active-piece={snapshot.activePiece?.id ?? ''} data-next-piece={snapshot.nextPiece.id}>
      <section className="gravity-stage">
        <div className="gravity-stage__heading"><div><p className="kicker">ROOM {room.code}</p><h1>{t('multi.matchTitle', '실시간 에너지 대전')}</h1></div><p>{t('multi.sameSeed', '모든 참가자가 같은 seed로 시작했습니다.')}</p></div>
        <GravityStackHud snapshot={snapshot} bestScore={0} hideNext={me.effects.previewJammed} />
        <div className="board-frame" data-fx={fxCue?.kind ?? ''} tabIndex={0} aria-label={t('multi.board', '멀티플레이 Gravity Stack 게임 보드')}>
          <GravityStackCanvas engine={engine} onSnapshot={publish} simulationEnabled={false} onCommand={command} />
          {snapshot.status === 'ready' && <div className="game-overlay"><p className="kicker">SYNC COUNTDOWN</p><h2>{t('multi.sync', '동시 시작 준비 중')}</h2></div>}
          {room.status === 'finished' ? <div className="game-overlay" role="dialog" aria-label={t('multi.finished', '대전 종료')}><p className="kicker">MATCH COMPLETE</p><h2>{t('multi.finished', '대전 종료')}</h2><p>{t('multi.mvp', `MVP ${winner.name} · ${winner.score.toLocaleString(locale)}점 · ${winner.cleared}셀 · 최대 ${winner.maxChain}연쇄`, { name: winner.name, score: winner.score.toLocaleString(locale), cleared: winner.cleared, chain: winner.maxChain })}</p><div className="overlay-actions">{me.isHost && <button className="primary-action" type="button" onClick={onRematch}>{t('multi.rematch', '다시 대전 준비')}</button>}<Link className="secondary-action" to="/">{t('common.arcadeHome', 'Arcade 홈')}</Link></div></div> : snapshot.status === 'gameOver' && <div className="game-overlay" role="dialog" aria-label={t('multi.myFinished', '내 플레이 종료')}><p className="kicker">RUN COMPLETE</p><h2>{me.forfeited ? t('multi.forfeited', '대전 기권') : t('multi.myFinished', '내 플레이 종료')}</h2><p>{t('multi.waiting', '다른 참가자의 최종 기록을 기다리는 중입니다.')}</p><Link className="secondary-action" to="/">{t('common.arcadeHome', 'Arcade 홈')}</Link></div>}
          <ArcadeFxOverlay cue={fxCue} />
        </div>
        <GravityStackControls onCommand={command} status={snapshot.status} allowPause={false} />
        {room.status === 'playing' && snapshot.status === 'playing' && <button className="secondary-action" type="button" onClick={onForfeit}>{t('multi.forfeit', '대전 포기')}</button>}
      </section>
      <aside className="multiplayer-scoreboard" aria-label={t('multi.standings', '실시간 순위')}>
        <p className="kicker">LIVE STANDINGS</p><h2>{t('multi.standings', '실시간 순위')}</h2>
        <PlayerStandings players={room.players} currentPlayerId={me.id} />
        {room.mode === 'items' && <section className="item-panel" aria-label={t('multi.item', '아이템')}><h3>{t('multi.item', '아이템')}</h3><p>{t('multi.itemHelpAll', '12셀마다 펄스 → 방어막 → 방해 블록 → 회전 잠금 → 센서 교란 → 속도 증가 순으로 획득합니다.')}</p><div className="item-grid"><button type="button" disabled={me.items.shield < 1 || me.shielded} onClick={() => onUseItem('shield')}>{t('multi.shield', `🛡 방어막 × ${me.items.shield}`, { count: me.items.shield })}</button>{(['pulse', 'garbage', 'rotationLock', 'previewJam', 'speedUp'] as ItemType[]).map((item) => <button key={item} type="button" disabled={me.items[item] < 1 || !target} onClick={() => onUseItem(item, target?.id)}>{itemButtonLabel(item, me.items[item], t)}</button>)}</div>{(me.shielded || Object.values(me.effects).some(Boolean)) && <div className="active-effects" aria-live="polite">{me.shielded && <strong>{t('multi.shieldActive', '방어막 활성')}</strong>}{me.effects.rotationLocked && <strong>{t('multi.rotationLocked', '회전 잠금')}</strong>}{me.effects.previewJammed && <strong>{t('multi.previewJammed', '센서 교란')}</strong>}{me.effects.speedUp && <strong>{t('multi.speedUpActive', '속도 증가')}</strong>}</div>}</section>}
        <p className="seed-readout">MATCH SEED <code>{match.seed}</code></p>
      </aside>
    </div>
  )
}

function PlayerStandings({ players, currentPlayerId, onRemoveBot }: { players: MultiplayerPlayer[]; currentPlayerId?: string; onRemoveBot?: (id: string) => boolean }) {
  const { t, locale } = useI18n()
  const ordered = [...players].sort((a, b) => b.score - a.score || b.cleared - a.cleared || a.name.localeCompare(b.name))
  return <ol className="player-standings">{ordered.map((player) => <li key={player.id} data-self={player.id === currentPlayerId} data-connected={player.connected} data-bot={player.isBot} data-bot-moves={player.botMoves ?? undefined}><span><strong>{player.name}</strong>{player.isHost && <small>HOST</small>}{player.isBot && <small>AI · {difficultyLabel(player.botDifficulty, t)}</small>}</span><span>{t('multi.points', `${player.score.toLocaleString(locale)}점 · Lv.${player.level} · ${player.cleared}셀`, { score: player.score.toLocaleString(locale), level: player.level, cleared: player.cleared })}</span>{player.boardPreview && <span className="opponent-mini" role="img" aria-label={t('multi.danger', `${player.name} 보드 위험도 ${player.dangerHeight}/18, 최근 ${player.lastWaveCount}연쇄`, { name: player.name, danger: player.dangerHeight, chain: player.lastWaveCount })} style={{ '--danger': `${Math.min(100, player.dangerHeight / 18 * 100)}%` } as React.CSSProperties}><i />{player.lastWaveCount > 1 && <b>{player.lastWaveCount} CHAIN</b>}</span>}<em>{!player.connected ? 'OFFLINE' : player.forfeited ? 'FORFEIT' : player.gameStatus === 'gameOver' ? 'OUT' : player.gameStatus === 'playing' ? 'PLAY' : player.ready ? 'READY' : 'WAIT'}</em>{player.isBot && onRemoveBot && <button className="bot-remove" type="button" aria-label={t('multi.removeAi', `${player.name} 제거`, { name: player.name })} onClick={() => onRemoveBot(player.id)}>×</button>}</li>)}</ol>
}

type Translate = (key: string, fallback: string, values?: Record<string, string | number>) => string

function itemButtonLabel(item: ItemType, count: number, t: Translate) {
  const labels: Record<ItemType, string> = {
    pulse: `⚡ 중력 펄스 × ${count}`,
    shield: `🛡 방어막 × ${count}`,
    garbage: `🧱 방해 블록 × ${count}`,
    rotationLock: `🔒 회전 잠금 × ${count}`,
    previewJam: `📡 센서 교란 × ${count}`,
    speedUp: `⏩ 속도 증가 × ${count}`,
  }
  return t(`multi.item.${item}`, labels[item], { count })
}

function itemTargetCue(event: ItemEvent, source: string, t: Translate): ArcadeFxCue {
  const titles: Record<Exclude<ItemType, 'shield'>, string> = { pulse: '중력 펄스!', garbage: '방해 블록 투입!', rotationLock: '회전 잠금!', previewJam: '센서 교란!', speedUp: '낙하 가속!' }
  return { id: event.eventId, kind: event.itemType as ArcadeFxCue['kind'], eyebrow: t('fx.warning', 'WARNING'), title: t(`fx.hit.${event.itemType}`, titles[event.itemType as Exclude<ItemType, 'shield'>]), detail: t('fx.attackedBy', `${source}의 공격`, { name: source }) }
}

function itemSourceCue(event: ItemEvent, target: string, t: Translate): ArcadeFxCue {
  const titles: Record<ItemType, string> = { pulse: '중력 펄스 발사!', shield: '방어막 발동!', garbage: '방해 블록 전송!', rotationLock: '회전 잠금 발동!', previewJam: '센서 교란 발동!', speedUp: '낙하 가속 발동!' }
  return { id: event.eventId, kind: event.itemType, eyebrow: t('fx.itemLaunch', 'ITEM LAUNCH'), title: t(`fx.sent.${event.itemType}`, titles[event.itemType]), detail: t('fx.targeted', `${target}에게 적중`, { name: target }) }
}

function difficultyLabel(value: BotDifficulty | null, t: (key: string, fallback: string) => string) { return value === 'rookie' ? t('multi.rookie', '루키') : value === 'ace' ? t('multi.ace', '에이스') : t('multi.pilot', '파일럿') }
