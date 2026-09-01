import { useCallback, useEffect, useRef, useState } from 'react'
import type { BotDifficulty, ItemEvent, ItemType, MatchStart, MultiplayerMode, MultiplayerRoom } from './types'

const PROTOCOL_VERSION = 1
const SESSION_KEY = 'arcade:gravity-stack:multiplayer-session:v1'
type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed'
type ClientMessage = Record<string, unknown> & { type: string }

interface ReconnectCredentials {
  code: string
  playerId: string
  reconnectToken: string
}

function socketUrl(): string {
  const configured = import.meta.env.VITE_ARCADE_WS_URL as string | undefined
  if (configured) return configured
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/arcade/ws`
}

function readCredentials(): ReconnectCredentials | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Partial<ReconnectCredentials> | null
    if (parsed?.code && parsed.playerId && parsed.reconnectToken) return parsed as ReconnectCredentials
  }
  catch { /* Ignore damaged device-local state. */ }
  return null
}

export function useMultiplayerRoom() {
  const socketRef = useRef<WebSocket | null>(null)
  const [initialCredentials] = useState<ReconnectCredentials | null>(readCredentials)
  const credentialsRef = useRef<ReconnectCredentials | null>(initialCredentials)
  const retryTimerRef = useRef<number | null>(null)
  const attemptRef = useRef(0)
  const pendingProgressRef = useRef<ClientMessage | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [room, setRoom] = useState<MultiplayerRoom | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(initialCredentials?.playerId ?? null)
  const [match, setMatch] = useState<MatchStart | null>(null)
  const [error, setError] = useState('')
  const [itemEvent, setItemEvent] = useState<ItemEvent | null>(null)

  useEffect(() => {
    let disposed = false
    const connect = () => {
      if (disposed) return
      setConnection(attemptRef.current === 0 ? 'connecting' : 'reconnecting')
      const socket = new WebSocket(socketUrl())
      socketRef.current = socket
      socket.addEventListener('open', () => {
        attemptRef.current = 0
        setConnection('open')
        setError('')
        const credentials = credentialsRef.current
        if (credentials) socket.send(JSON.stringify({ type: 'resume', protocol: PROTOCOL_VERSION, ...credentials }))
      })
      socket.addEventListener('close', () => {
        if (socketRef.current === socket) socketRef.current = null
        if (disposed) {
          setConnection('closed')
          return
        }
        setConnection('reconnecting')
        const delay = Math.min(8000, 400 * (2 ** Math.min(attemptRef.current, 5)))
        attemptRef.current += 1
        retryTimerRef.current = window.setTimeout(connect, delay)
      })
      socket.addEventListener('error', () => {
        if (!credentialsRef.current) setError('실시간 서버에 연결하지 못했습니다. 자동으로 다시 시도합니다.')
      })
      socket.addEventListener('message', (event) => {
        let message: { type?: string; [key: string]: unknown }
        try { message = JSON.parse(String(event.data)) as typeof message }
        catch { return }
        if (message.type === 'joined' || message.type === 'resumed') {
          const nextRoom = message.room as MultiplayerRoom
          const credentials = {
            code: nextRoom.code,
            playerId: String(message.playerId),
            reconnectToken: String(message.reconnectToken),
          }
          credentialsRef.current = credentials
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(credentials))
          setPlayerId(credentials.playerId)
          setRoom(nextRoom)
          setError('')
          if (pendingProgressRef.current && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(pendingProgressRef.current))
        }
        else if (message.type === 'roomState') {
          const nextRoom = message.room as MultiplayerRoom
          setRoom(nextRoom)
          if (nextRoom.status === 'lobby') setMatch(null)
        }
        else if (message.type === 'matchStart') setMatch(message as unknown as MatchStart)
        else if (message.type === 'matchEnd') setRoom(message.room as MultiplayerRoom)
        else if (message.type === 'rematch') {
          setRoom(message.room as MultiplayerRoom)
          setMatch(null)
        }
        else if (message.type === 'serverRestart') setConnection('reconnecting')
        else if (message.type === 'itemEvent') setItemEvent(message as unknown as ItemEvent)
        else if (message.type === 'error') {
          const code = String(message.code)
          if (code === 'RESUME_FAILED') {
            credentialsRef.current = null
            sessionStorage.removeItem(SESSION_KEY)
            setPlayerId(null)
            setRoom(null)
            setMatch(null)
          }
          setError(errorMessage(code))
        }
      })
    }
    connect()
    return () => {
      disposed = true
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
      const socket = socketRef.current
      socketRef.current = null
      socket?.close(1000, 'page closed')
    }
  }, [])

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      setError('연결 복구 중입니다. 잠시 후 자동으로 동기화됩니다.')
      return false
    }
    socket.send(JSON.stringify({ protocol: PROTOCOL_VERSION, ...message }))
    return true
  }, [])

  const createRoom = useCallback((name: string, mode: MultiplayerMode) => send({ type: 'create', name, mode }), [send])
  const joinRoom = useCallback((code: string, name: string) => send({ type: 'join', code, name }), [send])
  const setReady = useCallback((ready: boolean) => send({ type: 'ready', ready }), [send])
  const startMatch = useCallback(() => send({ type: 'start' }), [send])
  const rematch = useCallback(() => send({ type: 'rematch' }), [send])
  const addBot = useCallback((difficulty: BotDifficulty) => send({ type: 'addBot', difficulty }), [send])
  const removeBot = useCallback((botId: string) => send({ type: 'removeBot', botId }), [send])
  const useItem = useCallback((itemType: ItemType, targetId?: string) => send({ type: 'useItem', itemType, targetId }), [send])
  const sendProgress = useCallback((progress: { matchId: string; score: number; level: number; cleared: number; gameStatus: string }) => {
    const message = { type: 'progress', protocol: PROTOCOL_VERSION, ...progress }
    pendingProgressRef.current = message
    return send(message)
  }, [send])

  return { connection, room, playerId, match, itemEvent, error, createRoom, joinRoom, setReady, startMatch, rematch, addBot, removeBot, useItem, sendProgress }
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    ROOM_NOT_FOUND: '방 코드를 확인해 주세요.',
    ROOM_FULL: '방 인원이 가득 찼습니다.',
    MATCH_IN_PROGRESS: '이미 게임이 시작된 방입니다.',
    NOT_READY: '2명 이상 참가하고 모두 준비해야 합니다.',
    INVALID_PROGRESS: '게임 상태 동기화가 거부되었습니다.',
    PROTOCOL_MISMATCH: '게임 버전이 맞지 않습니다. 페이지를 새로고침해 주세요.',
    RATE_LIMITED: '요청이 너무 많아 연결을 잠시 쉬고 있습니다.',
    RESUME_FAILED: '이전 방의 복귀 시간이 만료되었습니다. 새 방에 참가해 주세요.',
    INVALID_ITEM: '지금은 해당 아이템을 사용할 수 없습니다.',
  }
  return messages[code] ?? '요청을 처리하지 못했습니다.'
}
