import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ArcadeHomePage } from './ArcadeHomePage'

describe('ArcadeHomePage', () => {
  beforeEach(() => localStorage.clear())

  it('renders the catalog and active Gravity Stack link', () => {
    render(<MemoryRouter><ArcadeHomePage /></MemoryRouter>)
    expect(screen.getByText('ARCADE ATLAS')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gravity Stack 플레이' })).toHaveAttribute('href', '/stack')
    expect(screen.getByTestId('game-card-gravity-stack')).toBeInTheDocument()
  })

  it('keeps Orbit Snake and Core Breaker in a non-navigating upcoming state', () => {
    render(<MemoryRouter><ArcadeHomePage /></MemoryRouter>)
    expect(screen.getByTestId('game-card-orbit-snake')).toHaveTextContent('준비 중')
    expect(screen.getByTestId('game-card-core-breaker')).toHaveTextContent('준비 중')
    expect(screen.getAllByText('준비 중', { selector: '.upcoming-badge' })).toHaveLength(2)
  })

  it('shows the local best score as a device-local value', () => {
    localStorage.setItem('arcade:gravity-stack:best:v1', '420')
    render(<MemoryRouter><ArcadeHomePage /></MemoryRouter>)
    expect(screen.getByText('420')).toBeInTheDocument()
  })
})
