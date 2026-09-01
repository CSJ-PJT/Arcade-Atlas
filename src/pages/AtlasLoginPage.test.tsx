import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { AtlasLoginPage } from './AtlasLoginPage'
import { I18nProvider } from '../i18n/I18nProvider'

vi.mock('../auth/AuthProvider', () => ({
  useAtlasAuth: () => ({ status: 'anonymous', user: null, error: '', signIn: vi.fn(), signOut: vi.fn(), retry: vi.fn() }),
}))

it('explains shared Sketchfy account and alpha-beta access', () => {
  render(<I18nProvider><MemoryRouter><AtlasLoginPage /></MemoryRouter></I18nProvider>)
  expect(screen.getByRole('heading', { name: 'Atlas 통합 로그인' })).toBeVisible()
  expect(screen.getByText(/기존 Sketchfy Atlas 가입자/)).toBeVisible()
  expect(screen.getByText(/알파·베타 기간/)).toBeVisible()
  expect(screen.getByRole('link', { name: '계정 만들기' })).toHaveAttribute('href', '/sketchfy/signup')
})
