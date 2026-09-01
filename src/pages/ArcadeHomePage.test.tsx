import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ArcadeHomePage } from './ArcadeHomePage'

describe('ArcadeHomePage', () => {
  beforeEach(() => localStorage.clear())

  it('renders the catalog and active Gravity Stack link', () => {
    render(<MemoryRouter><ArcadeHomePage /></MemoryRouter>)
    expect(screen.getByText('ARCADE ATLAS')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /싱글 플레이/ })).toHaveAttribute('href', '/stack')
    expect(screen.getByRole('link', { name: /멀티 플레이/ })).toHaveAttribute('href', '/stack/multi')
    expect(screen.getByAltText('함께 비행하는 귀여운 에너지 탐사대')).toBeInTheDocument()
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
    expect(screen.getByText(/420/)).toBeInTheDocument()
  })
})
