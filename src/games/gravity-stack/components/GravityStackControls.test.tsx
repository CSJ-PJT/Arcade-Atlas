import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GravityStackControls } from './GravityStackControls'

describe('GravityStackControls', () => {
  it('supports keyboard-generated clicks without duplicating pointer input', async () => {
    const onCommand = vi.fn()
    render(<GravityStackControls status="playing" onCommand={onCommand} />)
    const rotate = screen.getByRole('button', { name: '시계 방향 회전' })
    rotate.focus()
    await userEvent.keyboard('{Enter}')
    expect(onCommand).toHaveBeenCalledOnce()
    expect(onCommand).toHaveBeenCalledWith('rotate')
  })

  it('can remove pause from real-time multiplayer controls', () => {
    render(<GravityStackControls status="playing" onCommand={() => undefined} allowPause={false} />)
    expect(screen.queryByRole('button', { name: '일시정지 또는 계속' })).not.toBeInTheDocument()
  })
})
