import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GravityStackPage } from './GravityStackPage'

vi.mock('./phaser/createGravityStackGame', () => ({
  createGravityStackGame: () => ({ destroy: vi.fn() }),
}))

describe('GravityStackPage', () => {
  it('starts, pauses, and resumes through accessible DOM controls', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GravityStackPage /></MemoryRouter>)
    const page = screen.getByTestId('gravity-stack-page')
    expect(page).toHaveAttribute('data-game-status', 'ready')
    await user.click(screen.getByRole('button', { name: '게임 시작' }))
    expect(page).toHaveAttribute('data-game-status', 'playing')
    expect(await screen.findByRole('status')).toHaveTextContent('GO!')
    await user.click(screen.getByRole('button', { name: '일시정지' }))
    expect(page).toHaveAttribute('data-game-status', 'paused')
    expect(screen.getByRole('dialog', { name: '일시정지' })).toBeInTheDocument()
    const pauseDialog = screen.getByRole('dialog', { name: '일시정지' })
    await user.click(within(pauseDialog).getByRole('button', { name: '계속하기' }))
    expect(page).toHaveAttribute('data-game-status', 'playing')
  })

  it('exposes score, level, next piece, and touch controls outside canvas', () => {
    render(<MemoryRouter><GravityStackPage /></MemoryRouter>)
    expect(screen.getByTestId('score')).toHaveTextContent('0')
    expect(screen.getByTestId('level')).toHaveTextContent('1')
    expect(screen.getByLabelText('다음 조각')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '왼쪽 이동' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '즉시 낙하' })).toBeInTheDocument()
  })

  it('auto-pauses in the background and does not auto-resume in the foreground', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GravityStackPage /></MemoryRouter>)
    const page = screen.getByTestId('gravity-stack-page')
    await user.click(screen.getByRole('button', { name: '게임 시작' }))

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(page).toHaveAttribute('data-game-status', 'paused'))

    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(page).toHaveAttribute('data-game-status', 'paused')
  })
})
