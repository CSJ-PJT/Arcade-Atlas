import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { RequireAtlasAccount } from './RequireAtlasAccount'
import { I18nProvider } from '../i18n/I18nProvider'

const state = vi.hoisted(() => ({ status: 'anonymous' }))

vi.mock('./AuthProvider', () => ({
  useAtlasAuth: () => ({ status: state.status, user: null, error: '', signIn: vi.fn(), signOut: vi.fn(), retry: vi.fn() }),
}))

function renderGate() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/stack/multi']}>
        <Routes>
          <Route path="/login" element={<p>login destination</p>} />
          <Route path="/stack/multi" element={<RequireAtlasAccount><p>protected match</p></RequireAtlasAccount>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

it('redirects an anonymous multiplayer visitor to Atlas login', () => {
  state.status = 'anonymous'
  renderGate()
  expect(screen.getByText('login destination')).toBeVisible()
})

it('renders multiplayer after a validated Atlas session', () => {
  state.status = 'authenticated'
  renderGate()
  expect(screen.getByText('protected match')).toBeVisible()
})
