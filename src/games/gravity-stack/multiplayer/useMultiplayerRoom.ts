import { useCallback, useEffect, useRef, useState } from 'react'
import type { MatchStart, MultiplayerRoom } from './types'

type ClientMessage = Record<string, unknown> & { type: string }

function socketUrl(): string {
  const configured = import.meta.env.VITE_ARCADE_WS_URL as string | undefined
  if (configured) return configured
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/arcade/ws`
}

export function useMultiplayerRoom() {
  const socketRef = useRef<WebSocket | null>(null)
  const [connection, setConnection] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [room, setRoom] = useState<MultiplayerRoom | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [match, setMatch] = useState<MatchStart | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const socket = new WebSocket(socketUrl())
    socketRef.current = socket
    socket.addEventListener('open', () => setConnection('open'))
    socket.addEventListener('close', () => setConnection('closed'))
    socket.addEventListener('error', () => setError('실시간 서버에 연결하지 못했습니다.'))
    socket.addEventListener('message', (event) => {
      let message: { type?: string; [key: string]: unknown }
      try { message = JSON.parse(String(event.data)) as typeof message }
      catch { return }
      if (message.type === 'joined') {
        setPlayerId(String(message.playerId))
        setRoom(message.room as MultiplayerRoom)
        setError('')
      }
      else if (message.type === 'roomState') setRoom(message.room as MultiplayerRoom)
      else if (message.type === 'matchStart') setMatch(message as unknown as MatchStart)
      else if (message.type === 'error') setError(errorMessage(String(message.code)))
    })
    return () => {
      socket.close(1000, 'page closed')
      socketRef.current = null
    }
  }, [])

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      setError('실시간 서버 연결을 확인해 주세요.')
      return false
    }
    socket.send(JSON.stringify(message))
    return true
  }, [])

  return {
    connection, room, playerId, match, error,
    createRoom: (name: string) => send({ type: 'create', name }),
    joinRoom: (code: string, name: string) => send({ type: 'join', code, name }),
    setReady: (ready: boolean) => send({ type: 'ready', ready }),
    startMatch: () => send({ type: 'start' }),
    sendProgress: (progress: { matchId: string; score: number; level: number; cleared: number; gameStatus: string }) => send({ type: 'progress', ...progress }),
  }
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    ROOM_NOT_FOUND: '방 코드를 확인해 주세요.',
    ROOM_FULL: '방 인원이 가득 찼습니다.',
    MATCH_IN_PROGRESS: '이미 게임이 시작된 방입니다.',
    NOT_READY: '2명 이상 참가하고 모두 준비해야 합니다.',
    INVALID_PROGRESS: '게임 상태 동기화가 거부되었습니다.',
  }
  return messages[code] ?? '요청을 처리하지 못했습니다.'
}
