import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GravityStackEngine } from '../core/engine'
import { GravityStackResults } from './GravityStackResults'

describe('GravityStackResults', () => {
  it('renders final metrics, seed, restart, and home actions', async () => {
    const onRestart = vi.fn()
    const snapshot = { ...new GravityStackEngine('result-seed').getSnapshot(), status: 'gameOver' as const, score: 870, level: 3, totalClearedCells: 64, maxChain: 4 }
    render(<MemoryRouter><GravityStackResults snapshot={snapshot} onRestart={onRestart} /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '게임 오버' })).toBeInTheDocument()
    expect(screen.getByText('870')).toBeInTheDocument()
    expect(screen.getByText('result-seed')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시작' }))
    expect(onRestart).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Arcade 홈으로' })).toHaveAttribute('href', '/')
  })
})
