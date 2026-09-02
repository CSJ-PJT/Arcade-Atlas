import type { CSSProperties } from 'react'

export type ArcadeFxKind = 'start' | 'chain' | 'pulse' | 'shield' | 'blocked' | 'garbage' | 'rotationLock' | 'previewJam' | 'speedUp' | 'finish'

export interface ArcadeFxCue {
  id: string
  kind: ArcadeFxKind
  eyebrow: string
  title: string
  detail?: string
}

export function ArcadeFxOverlay({ cue }: { cue: ArcadeFxCue | null }) {
  if (!cue) return null
  return (
    <div key={cue.id} className="arcade-fx-layer" data-kind={cue.kind} role="status" aria-live="polite" aria-atomic="true">
      <div className="arcade-fx-rings" aria-hidden="true"><i /><i /><i /></div>
      <div className="arcade-fx-particles" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => (
          <i key={index} style={{ '--particle': index } as CSSProperties} />
        ))}
      </div>
      <div className="arcade-fx-copy">
        <small>{cue.eyebrow}</small>
        <strong>{cue.title}</strong>
        {cue.detail && <span>{cue.detail}</span>}
      </div>
    </div>
  )
}
