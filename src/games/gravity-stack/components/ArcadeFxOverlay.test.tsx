import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArcadeFxOverlay } from './ArcadeFxOverlay'

describe('ArcadeFxOverlay', () => {
  it('renders an accessible item cue without adding controls', () => {
    const { container } = render(<ArcadeFxOverlay cue={{ id: 'item-1', kind: 'shield', eyebrow: 'ITEM READY', title: '방어막 발동', detail: '공격 1회 방어' }} />)
    expect(screen.getByRole('status')).toHaveTextContent('방어막 발동')
    expect(container.querySelector('[data-kind="shield"]')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing without a cue', () => {
    const { container } = render(<ArcadeFxOverlay cue={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
