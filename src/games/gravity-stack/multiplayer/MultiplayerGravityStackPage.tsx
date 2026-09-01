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
import type { BotDifficulty, ItemEvent, MultiplayerMode } from './types'
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
          <p>2~4명이 같은 seed로 동시에 시작합니다. 조작은 서버 공통 엔진이 판정하며, 각자 보드에서 더 높은 점수를 만드세요.</p>
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
        <MultiplayerLobby room={multiplayer.room} me={me} error={multiplayer.error} onReady={multiplayer.setReady} onStart={multiplayer.startMatch} onAddBot={multiplayer.addBot} onRemoveBot={multiplayer.removeBot} />
      )}
      {multiplayer.room && multiplayer.match && me && (
        <MultiplayerMatch room={multiplayer.room} me={me} match={multiplayer.match} itemEvent={multiplayer.itemEvent} authoritativeState={multiplayer.authoritativeState} onUseItem={multiplayer.useItem} sendInput={multiplayer.sendInput} onForfeit={multiplayer.forfeit} onRematch={multiplayer.rematch} />
      )}
    </main>
  )
}

function MultiplayerLobby({ room, me, error, onReady, onStart, onAddBot, onRemoveBot }: { room: MultiplayerRoom; me: MultiplayerPlayer; error: string; onReady: (ready: boolean) => boolean; onStart: () => boolean; onAddBot: (difficulty: BotDifficulty) => boolean; onRemoveBot: (id: string) => boolean }) {
  const [difficulty, setDifficulty] = useState<BotDifficulty>('pilot')
  const allReady = room.players.length >= 2 && room.players.every((player) => player.connected && player.ready)
  return (
    <section className="multiplayer-lobby" data-testid="multiplayer-lobby">
      <p className="kicker">ROOM LINK</p>
      <h1>방 코드 <strong data-testid="room-code">{room.code}</strong></h1>
      <p className="mode-badge">{room.mode === 'items' ? '아이템 모드' : '일반 모드'}</p>
      <p>코드를 함께 플레이할 사람에게 전달하세요. 최대 4명까지 참가할 수 있습니다.</p>
      <PlayerStandings players={room.players} onRemoveBot={me.isHost ? onRemoveBot : undefined} />
      {me.isHost && <div className="bot-controls"><label>AI 난이도<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)}><option value="rookie">루키 · 여유롭게</option><option value="pilot">파일럿 · 균형</option><option value="ace">에이스 · 빠르게</option></select></label><button className="secondary-action" type="button" disabled={room.players.length >= 4} onClick={() => onAddBot(difficulty)}>Atlas AI 추가</button></div>}
      <div className="lobby-actions">
        <button className={me.ready ? 'secondary-action' : 'primary-action'} type="button" onClick={() => onReady(!me.ready)}>{me.ready ? '준비 취소' : '준비 완료'}</button>
        {me.isHost && <button className="primary-action" type="button" disabled={!allReady} onClick={onStart}>동시 시작</button>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

function MultiplayerMatch({ room, me, match, itemEvent, authoritativeState, onUseItem, sendInput, onForfeit, onRematch }: { room: MultiplayerRoom; me: MultiplayerPlayer; match: MatchStart; itemEvent: ItemEvent | null; authoritativeState: import('../core/types').EngineCheckpoint | null; onUseItem: (item: 'pulse' | 'shield', targetId?: string) => boolean; sendInput: (command: GameCommand) => boolean; onForfeit: () => boolean; onRematch: () => boolean }) {
  const engine = useMemo(() => new GravityStackEngine(match.seed), [match.seed])
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot())
  const itemEventRef = useRef('')

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
  }, [itemEvent])

  const target = room.players.filter((player) => player.id !== me.id && player.connected && player.gameStatus === 'playing').sort((a, b) => b.score - a.score)[0]
  const winner = [...room.players].sort((a, b) => b.score - a.score || b.maxChain - a.maxChain || b.cleared - a.cleared)[0]
  const boardSignature = JSON.stringify(snapshot.board.map((row) => row.map((cell) => cell?.energy?.[0] ?? '-')))

  return (
    <div className="multiplayer-match" data-testid="multiplayer-match" data-game-status={snapshot.status} data-score={snapshot.score} data-revision={snapshot.revision} data-board-signature={boardSignature} data-active-piece={snapshot.activePiece?.id ?? ''} data-next-piece={snapshot.nextPiece.id}>
      <section className="gravity-stage">
        <div className="gravity-stage__heading"><div><p className="kicker">ROOM {room.code}</p><h1>실시간 에너지 대전</h1></div><p>모든 참가자가 같은 seed로 시작했습니다.</p></div>
        <GravityStackHud snapshot={snapshot} bestScore={0} />
        <div className="board-frame" tabIndex={0} aria-label="멀티플레이 Gravity Stack 게임 보드">
          <GravityStackCanvas engine={engine} onSnapshot={publish} simulationEnabled={false} onCommand={command} />
          {snapshot.status === 'ready' && <div className="game-overlay"><p className="kicker">SYNC COUNTDOWN</p><h2>동시 시작 준비 중</h2></div>}
          {room.status === 'finished' ? <div className="game-overlay" role="dialog" aria-label="대전 종료"><p className="kicker">MATCH COMPLETE</p><h2>대전 종료</h2><p>MVP {winner.name} · {winner.score.toLocaleString()}점 · {winner.cleared}셀 · 최대 {winner.maxChain}연쇄</p><div className="overlay-actions">{me.isHost && <button className="primary-action" type="button" onClick={onRematch}>다시 대전 준비</button>}<Link className="secondary-action" to="/">Arcade 홈</Link></div></div> : snapshot.status === 'gameOver' && <div className="game-overlay" role="dialog" aria-label="내 플레이 종료"><p className="kicker">RUN COMPLETE</p><h2>{me.forfeited ? '대전 기권' : '내 플레이 종료'}</h2><p>다른 참가자의 최종 기록을 기다리는 중입니다.</p><Link className="secondary-action" to="/">Arcade 홈</Link></div>}
        </div>
        <GravityStackControls onCommand={command} status={snapshot.status} allowPause={false} />
        {room.status === 'playing' && snapshot.status === 'playing' && <button className="secondary-action" type="button" onClick={onForfeit}>대전 포기</button>}
      </section>
      <aside className="multiplayer-scoreboard" aria-label="실시간 순위">
        <p className="kicker">LIVE STANDINGS</p><h2>실시간 순위</h2>
        <PlayerStandings players={room.players} currentPlayerId={me.id} />
        {room.mode === 'items' && <section className="item-panel" aria-label="아이템"><h3>아이템</h3><p>각 플레이어가 12셀 방전마다 펄스와 방어막을 번갈아 획득합니다.</p><button type="button" disabled={me.items.shield < 1 || me.shielded} onClick={() => onUseItem('shield')}>방어막 × {me.items.shield}</button><button type="button" disabled={me.items.pulse < 1 || !target} onClick={() => onUseItem('pulse', target?.id)}>중력 펄스 × {me.items.pulse}</button>{me.shielded && <strong>방어막 활성</strong>}</section>}
        <p className="seed-readout">MATCH SEED <code>{match.seed}</code></p>
      </aside>
    </div>
  )
}

function PlayerStandings({ players, currentPlayerId, onRemoveBot }: { players: MultiplayerPlayer[]; currentPlayerId?: string; onRemoveBot?: (id: string) => boolean }) {
  const ordered = [...players].sort((a, b) => b.score - a.score || b.cleared - a.cleared || a.name.localeCompare(b.name))
  return <ol className="player-standings">{ordered.map((player) => <li key={player.id} data-self={player.id === currentPlayerId} data-connected={player.connected} data-bot={player.isBot} data-bot-moves={player.botMoves ?? undefined}><span><strong>{player.name}</strong>{player.isHost && <small>HOST</small>}{player.isBot && <small>AI · {difficultyLabel(player.botDifficulty)}</small>}</span><span>{player.score.toLocaleString()}점 · Lv.{player.level} · {player.cleared}셀</span>{player.boardPreview && <span className="opponent-mini" role="img" aria-label={`${player.name} 보드 위험도 ${player.dangerHeight}/18, 최근 ${player.lastWaveCount}연쇄`} style={{ '--danger': `${Math.min(100, player.dangerHeight / 18 * 100)}%` } as React.CSSProperties}><i />{player.lastWaveCount > 1 && <b>{player.lastWaveCount} CHAIN</b>}</span>}<em>{!player.connected ? 'OFFLINE' : player.forfeited ? 'FORFEIT' : player.gameStatus === 'gameOver' ? 'OUT' : player.gameStatus === 'playing' ? 'PLAY' : player.ready ? 'READY' : 'WAIT'}</em>{player.isBot && onRemoveBot && <button className="bot-remove" type="button" aria-label={`${player.name} 제거`} onClick={() => onRemoveBot(player.id)}>제거</button>}</li>)}</ol>
}

function difficultyLabel(value: BotDifficulty | null) { return value === 'rookie' ? '루키' : value === 'ace' ? '에이스' : '파일럿' }
