import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtlasBrand } from '../../../components/AtlasBrand'
import { GravityStackCanvas } from '../components/GravityStackCanvas'
import { GravityStackControls } from '../components/GravityStackControls'
import { GravityStackHud } from '../components/GravityStackHud'
import { GravityStackEngine } from '../core/engine'
import type { EngineSnapshot, GameCommand } from '../core/types'
import { useMultiplayerRoom } from './useMultiplayerRoom'
import type { MatchStart, MultiplayerPlayer, MultiplayerRoom } from './types'
import type { ItemEvent, MultiplayerMode } from './types'
import { useMusicScope } from '../../../audio/MusicProvider'
import '../gravity-stack.css'
import './multiplayer.css'

export function MultiplayerGravityStackPage() {
  const multiplayer = useMultiplayerRoom()
  const [name, setName] = useState(() => sessionStorage.getItem('arcade:player-name') || '')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<MultiplayerMode>('normal')
  const me = multiplayer.room?.players.find((player) => player.id === multiplayer.playerId)
  useMusicScope(multiplayer.match ? 'game' : 'lobby')

  const rememberName = () => {
    const next = name.trim().slice(0, 16)
    if (!next) return false
    sessionStorage.setItem('arcade:player-name', next)
    return true
  }

  return (
    <main className="multiplayer-page" data-testid="multiplayer-page" data-connection={multiplayer.connection}>
      <header className="gravity-topbar">
        <AtlasBrand compact />
        <Link className="text-link" to="/">미션 선택</Link>
      </header>
      {multiplayer.connection === 'reconnecting' && <p className="reconnect-banner" role="status">연결이 잠시 끊겼습니다. 방을 유지한 채 자동 복구 중입니다.</p>}
      {!multiplayer.room && multiplayer.playerId && (
        <section className="multiplayer-entry reconnect-panel" aria-live="polite"><p className="kicker">LINK RECOVERY</p><h1>이전 방으로 복귀 중</h1><p>30초 안에 연결이 돌아오면 진행 상태를 그대로 이어갑니다.</p></section>
      )}
      {!multiplayer.room && !multiplayer.playerId && (
        <section className="multiplayer-entry" aria-labelledby="multi-title">
          <p className="kicker">LIVE ENERGY RACE</p>
          <h1 id="multi-title">Gravity Stack 실시간 대전</h1>
          <p>2~4명이 같은 seed로 동시에 시작합니다. 각자 보드에서 더 높은 점수를 만드세요.</p>
          <label>표시 이름<input value={name} maxLength={16} autoComplete="nickname" onChange={(event) => setName(event.target.value)} /></label>
          <fieldset className="mode-selector"><legend>게임 모드</legend><label><input type="radio" name="mode" value="normal" checked={mode === 'normal'} onChange={() => setMode('normal')} /><span><strong>일반 모드</strong>같은 조건으로 순수 점수 대결</span></label><label><input type="radio" name="mode" value="items" checked={mode === 'items'} onChange={() => setMode('items')} /><span><strong>아이템 모드</strong>방전으로 방어막과 중력 펄스 획득</span></label></fieldset>
          <div className="multiplayer-entry__actions">
            <button className="primary-action" type="button" disabled={multiplayer.connection !== 'open' || !name.trim()} onClick={() => rememberName() && multiplayer.createRoom(name, mode)}>새 방 만들기</button>
            <div className="join-controls">
              <label>방 코드<input value={code} maxLength={6} autoCapitalize="characters" onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} /></label>
              <button className="secondary-action" type="button" disabled={multiplayer.connection !== 'open' || !name.trim() || code.length !== 6} onClick={() => rememberName() && multiplayer.joinRoom(code, name)}>참가</button>
            </div>
          </div>
          <p className="connection-note" aria-live="polite">실시간 연결: {multiplayer.connection}</p>
          {multiplayer.error && <p className="form-error" role="alert">{multiplayer.error}</p>}
        </section>
      )}
      {multiplayer.room && !multiplayer.match && me && (
        <MultiplayerLobby room={multiplayer.room} me={me} error={multiplayer.error} onReady={multiplayer.setReady} onStart={multiplayer.startMatch} />
      )}
      {multiplayer.room && multiplayer.match && me && (
        <MultiplayerMatch room={multiplayer.room} me={me} match={multiplayer.match} itemEvent={multiplayer.itemEvent} onUseItem={multiplayer.useItem} sendProgress={multiplayer.sendProgress} onRematch={multiplayer.rematch} />
      )}
    </main>
  )
}

function MultiplayerLobby({ room, me, error, onReady, onStart }: { room: MultiplayerRoom; me: MultiplayerPlayer; error: string; onReady: (ready: boolean) => boolean; onStart: () => boolean }) {
  const allReady = room.players.length >= 2 && room.players.every((player) => player.connected && player.ready)
  return (
    <section className="multiplayer-lobby" data-testid="multiplayer-lobby">
      <p className="kicker">ROOM LINK</p>
      <h1>방 코드 <strong data-testid="room-code">{room.code}</strong></h1>
      <p className="mode-badge">{room.mode === 'items' ? '아이템 모드' : '일반 모드'}</p>
      <p>코드를 함께 플레이할 사람에게 전달하세요. 최대 4명까지 참가할 수 있습니다.</p>
      <PlayerStandings players={room.players} />
      <div className="lobby-actions">
        <button className={me.ready ? 'secondary-action' : 'primary-action'} type="button" onClick={() => onReady(!me.ready)}>{me.ready ? '준비 취소' : '준비 완료'}</button>
        {me.isHost && <button className="primary-action" type="button" disabled={!allReady} onClick={onStart}>동시 시작</button>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

function MultiplayerMatch({ room, me, match, itemEvent, onUseItem, sendProgress, onRematch }: { room: MultiplayerRoom; me: MultiplayerPlayer; match: MatchStart; itemEvent: ItemEvent | null; onUseItem: (item: 'pulse' | 'shield', targetId?: string) => boolean; sendProgress: (progress: { matchId: string; score: number; level: number; cleared: number; gameStatus: string }) => boolean; onRematch: () => boolean }) {
  const engine = useMemo(() => new GravityStackEngine(match.seed), [match.seed])
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot())
  const sentRef = useRef({ at: 0, score: -1, status: '' })
  const itemEventRef = useRef('')

  useEffect(() => {
    const delay = Math.max(0, match.startsAt - Date.now())
    const timer = window.setTimeout(() => {
      engine.start()
      setSnapshot(engine.getSnapshot())
    }, delay)
    return () => window.clearTimeout(timer)
  }, [engine, match.startsAt])

  useEffect(() => {
    if (room.status === 'finished') engine.pause()
  }, [engine, room.status])

  const publish = useCallback((next: EngineSnapshot) => {
    setSnapshot(next)
    const now = Date.now()
    const meaningful = next.score !== sentRef.current.score || next.status !== sentRef.current.status
    if (meaningful && (now - sentRef.current.at >= 100 || next.status === 'gameOver')) {
      sentRef.current = { at: now, score: next.score, status: next.status }
      sendProgress({ matchId: match.matchId, score: next.score, level: next.level, cleared: next.totalClearedCells, gameStatus: next.status })
    }
  }, [match.matchId, sendProgress])

  const command = useCallback((next: GameCommand) => {
    if (engine.execute(next)) publish(engine.getSnapshot())
  }, [engine, publish])

  useEffect(() => {
    if (!itemEvent || itemEvent.eventId === itemEventRef.current) return
    itemEventRef.current = itemEvent.eventId
    if (itemEvent.targetId === me.id && itemEvent.itemType === 'pulse' && !itemEvent.blocked) {
      const timer = window.setTimeout(() => { engine.execute('down'); engine.execute('down'); publish(engine.getSnapshot()) }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [engine, itemEvent, me.id, publish])

  const target = room.players.filter((player) => player.id !== me.id && player.connected && player.gameStatus === 'playing').sort((a, b) => b.score - a.score)[0]

  return (
    <div className="multiplayer-match" data-testid="multiplayer-match" data-game-status={snapshot.status}>
      <section className="gravity-stage">
        <div className="gravity-stage__heading"><div><p className="kicker">ROOM {room.code}</p><h1>실시간 에너지 대전</h1></div><p>모든 참가자가 같은 seed로 시작했습니다.</p></div>
        <GravityStackHud snapshot={snapshot} bestScore={0} />
        <div className="board-frame" tabIndex={0} aria-label="멀티플레이 Gravity Stack 게임 보드">
          <GravityStackCanvas engine={engine} onSnapshot={publish} />
          {snapshot.status === 'ready' && <div className="game-overlay"><p className="kicker">SYNC COUNTDOWN</p><h2>동시 시작 준비 중</h2></div>}
          {room.status === 'finished' ? <div className="game-overlay" role="dialog" aria-label="대전 종료"><p className="kicker">MATCH COMPLETE</p><h2>대전 종료</h2><p>최종 순위가 확정되었습니다.</p><div className="overlay-actions">{me.isHost && <button className="primary-action" type="button" onClick={onRematch}>다시 대전 준비</button>}<Link className="secondary-action" to="/">Arcade 홈</Link></div></div> : snapshot.status === 'gameOver' && <div className="game-overlay" role="dialog" aria-label="내 플레이 종료"><p className="kicker">RUN COMPLETE</p><h2>내 플레이 종료</h2><p>다른 참가자의 최종 기록을 기다리는 중입니다.</p><Link className="secondary-action" to="/">Arcade 홈</Link></div>}
        </div>
        <GravityStackControls onCommand={command} status={snapshot.status} />
      </section>
      <aside className="multiplayer-scoreboard" aria-label="실시간 순위">
        <p className="kicker">LIVE STANDINGS</p><h2>실시간 순위</h2>
        <PlayerStandings players={room.players} currentPlayerId={me.id} />
        {room.mode === 'items' && <section className="item-panel" aria-label="아이템"><h3>아이템</h3><p>12셀 방전마다 번갈아 획득합니다.</p><button type="button" disabled={me.items.shield < 1 || me.shielded} onClick={() => onUseItem('shield')}>방어막 × {me.items.shield}</button><button type="button" disabled={me.items.pulse < 1 || !target} onClick={() => onUseItem('pulse', target?.id)}>중력 펄스 × {me.items.pulse}</button>{me.shielded && <strong>방어막 활성</strong>}</section>}
        <p className="seed-readout">MATCH SEED <code>{match.seed}</code></p>
      </aside>
    </div>
  )
}

function PlayerStandings({ players, currentPlayerId }: { players: MultiplayerPlayer[]; currentPlayerId?: string }) {
  const ordered = [...players].sort((a, b) => b.score - a.score || b.cleared - a.cleared || a.name.localeCompare(b.name))
  return <ol className="player-standings">{ordered.map((player) => <li key={player.id} data-self={player.id === currentPlayerId} data-connected={player.connected}><span><strong>{player.name}</strong>{player.isHost && <small>HOST</small>}</span><span>{player.score.toLocaleString()}점 · Lv.{player.level}</span><em>{!player.connected ? 'OFFLINE' : player.gameStatus === 'gameOver' ? 'OUT' : player.gameStatus === 'playing' ? 'PLAY' : player.ready ? 'READY' : 'WAIT'}</em></li>)}</ol>
}
