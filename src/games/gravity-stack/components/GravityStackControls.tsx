import { useEffect, useRef } from 'react'
import type { GameCommand, GameStatus } from '../core/types'
import { useI18n } from '../../../i18n/I18nProvider'

interface ControlSpec {
  command: GameCommand
  labelKey: string
  fallback: string
  glyph: string
  repeat?: boolean
}

const controls: readonly ControlSpec[] = [
  { command: 'left', labelKey: 'controls.left', fallback: '왼쪽 이동', glyph: '←', repeat: true },
  { command: 'rotate', labelKey: 'controls.rotate', fallback: '시계 방향 회전', glyph: '↻' },
  { command: 'right', labelKey: 'controls.right', fallback: '오른쪽 이동', glyph: '→', repeat: true },
  { command: 'down', labelKey: 'controls.down', fallback: '한 칸 아래', glyph: '↓', repeat: true },
  { command: 'hardDrop', labelKey: 'controls.hardDrop', fallback: '즉시 낙하', glyph: '⇊' },
  { command: 'pauseToggle', labelKey: 'controls.pause', fallback: '일시정지 또는 계속', glyph: 'Ⅱ' },
]

function isUnavailable(control: ControlSpec, status: GameStatus): boolean {
  return control.command === 'pauseToggle'
    ? status === 'ready' || status === 'gameOver'
    : status !== 'playing'
}

interface GravityStackControlsProps {
  onCommand: (command: GameCommand) => void
  status: GameStatus
  allowPause?: boolean
}

export function GravityStackControls({ onCommand, status, allowPause = true }: GravityStackControlsProps) {
  const { t } = useI18n()
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
    <div className="touch-controls" aria-label={t('controls.mobile', '모바일 게임 조작')}>
      {controls.filter((control) => allowPause || control.command !== 'pauseToggle').map((control) => {
        const unavailable = isUnavailable(control, status)
        return (
        <button
          type="button"
          key={control.command}
          aria-label={t(control.labelKey, control.fallback)}
          data-testid={`control-${control.command}`}
          disabled={unavailable}
          onPointerDown={(event) => begin(event, control)}
          onClick={(event) => { if (event.detail === 0 && !unavailable) onCommand(control.command) }}
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
