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
}))

vi.mock('./atlasAuthClient', () => ({
  atlasAuthConfigured: true,
  getAtlasAuthClient: () => ({
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
  return <><output>{atlas.status}</output><button type="button" onClick={() => void atlas.signIn('member@example.com', 'password123')}>sign in</button></>
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
  auth.signOut.mockResolvedValue({ error: null })
})

it('recognizes an existing shared Atlas browser session', async () => {
  const user = { id: 'atlas-user', aud: 'authenticated', role: 'authenticated' }
  auth.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
  auth.getUser.mockResolvedValue({ data: { user }, error: null })
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument())
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
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'member@example.com', password: 'password123' })
})
