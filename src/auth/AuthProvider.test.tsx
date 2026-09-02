import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAtlasAuth } from './AuthProvider'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  callback: null as null | ((event: string, session: unknown) => void),
  profileResult: { data: null as unknown, error: null as null | { message: string } },
}))

vi.mock('./atlasAuthClient', () => ({
  atlasAuthConfigured: true,
  getAtlasAuthClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve(auth.profileResult) }),
      }),
    }),
    auth: {
      getSession: auth.getSession,
      getUser: auth.getUser,
      signInWithPassword: auth.signInWithPassword,
      signOut: auth.signOut,
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        auth.callback = callback
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } }
      },
    },
  }),
}))

function Probe() {
  const atlas = useAtlasAuth()
  return <><output>{atlas.status}</output><output>{atlas.profileStatus}</output><output>{atlas.profile?.nickname ?? 'no profile'}</output><button type="button" onClick={() => void atlas.signIn('member@example.com', 'password123')}>sign in</button></>
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
  auth.signOut.mockResolvedValue({ error: null })
  auth.profileResult = { data: { id: 'atlas-user', nickname: 'Atlas Pilot', avatar_seed: 'pilot', country_code: 'KR', preferred_language: 'ko', timezone: 'Asia/Seoul', native_language: 'ko', learning_language: 'ja', korean_level: 'native', daily_learning_goal: 10, show_romanization: true, show_english_translation: true, games_played: 7, wins: 3, total_score: 900 }, error: null }
})

it('recognizes an existing shared Atlas browser session', async () => {
  const user = { id: 'atlas-user', aud: 'authenticated', role: 'authenticated' }
  auth.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
  auth.getUser.mockResolvedValue({ data: { user }, error: null })
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument())
  expect(screen.getByText('Atlas Pilot')).toBeVisible()
  expect(auth.getSession).toHaveBeenCalledOnce()
  expect(auth.getUser).toHaveBeenCalledOnce()
})

it('signs in with the shared Supabase account provider', async () => {
  const user = { id: 'atlas-user', aud: 'authenticated', role: 'authenticated' }
  auth.signInWithPassword.mockResolvedValue({ data: { user, session: { user } }, error: null })
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'sign in' }))
  await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument())
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'member@example.com', password: 'password123' })
})

it('distinguishes an authenticated account without a shared Sketchfy profile', async () => {
  const user = { id: 'atlas-user', aud: 'authenticated', role: 'authenticated' }
  auth.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
  auth.getUser.mockResolvedValue({ data: { user }, error: null })
  auth.profileResult = { data: null, error: null }
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('missing')).toBeInTheDocument())
})
