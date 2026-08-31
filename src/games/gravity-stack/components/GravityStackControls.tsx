import { useEffect, useRef } from 'react'
import type { GameCommand, GameStatus } from '../core/types'

interface ControlSpec {
  command: GameCommand
  label: string
  glyph: string
  repeat?: boolean
}

const controls: readonly ControlSpec[] = [
  { command: 'left', label: '왼쪽 이동', glyph: '←', repeat: true },
  { command: 'rotate', label: '시계 방향 회전', glyph: '↻' },
  { command: 'right', label: '오른쪽 이동', glyph: '→', repeat: true },
  { command: 'down', label: '한 칸 아래', glyph: '↓', repeat: true },
  { command: 'hardDrop', label: '즉시 낙하', glyph: '⇊' },
  { command: 'pauseToggle', label: '일시정지 또는 계속', glyph: 'Ⅱ' },
]

function isUnavailable(control: ControlSpec, status: GameStatus): boolean {
  return control.command === 'pauseToggle'
    ? status === 'ready' || status === 'gameOver'
    : status !== 'playing'
}

interface GravityStackControlsProps {
  onCommand: (command: GameCommand) => void
  status: GameStatus
}

export function GravityStackControls({ onCommand, status }: GravityStackControlsProps) {
  const timers = useRef<{ delay?: number; interval?: number }>({})

  const stopRepeat = () => {
    if (timers.current.delay) window.clearTimeout(timers.current.delay)
    if (timers.current.interval) window.clearInterval(timers.current.interval)
    timers.current = {}
  }

  useEffect(() => stopRepeat, [])

  const begin = (event: React.PointerEvent<HTMLButtonElement>, control: ControlSpec) => {
    if (isUnavailable(control, status)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    stopRepeat()
    onCommand(control.command)
    if (control.repeat) {
      timers.current.delay = window.setTimeout(() => {
        timers.current.interval = window.setInterval(() => onCommand(control.command), 90)
      }, 220)
    }
  }

  return (
    <div className="touch-controls" aria-label="모바일 게임 조작">
      {controls.map((control) => {
        const unavailable = isUnavailable(control, status)
        return (
        <button
          type="button"
          key={control.command}
          aria-label={control.label}
          data-testid={`control-${control.command}`}
          disabled={unavailable}
          onPointerDown={(event) => begin(event, control)}
          onPointerUp={stopRepeat}
          onPointerCancel={stopRepeat}
          onPointerLeave={stopRepeat}
          onLostPointerCapture={stopRepeat}
        >
          <span aria-hidden="true">{control.glyph}</span>
        </button>
        )
      })}
    </div>
  )
}
