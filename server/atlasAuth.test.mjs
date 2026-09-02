import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('accepts only a server-validated Atlas user with a shared profile', async () => {
  vi.stubEnv('ARCADE_AUTH_REQUIRED', 'true')
  vi.stubEnv('SUPABASE_URL', 'https://project.example')
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key')
  const { validateAtlasAccount } = await import('./atlasAuth.mjs')
  const request = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1', email: 'member@example.com' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'user-1', nickname: 'Atlas Pilot' }]) })

  await expect(validateAtlasAccount('a'.repeat(40), request)).resolves.toEqual({ id: 'user-1', email: 'member@example.com', nickname: 'Atlas Pilot' })
  expect(request).toHaveBeenCalledTimes(2)
  expect(request.mock.calls[1][0]).toContain('id=eq.user-1')
})

it('rejects a valid Auth user without a shared profile', async () => {
  vi.stubEnv('ARCADE_AUTH_REQUIRED', 'true')
  vi.stubEnv('SUPABASE_URL', 'https://project.example')
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key')
  const { validateAtlasAccount } = await import('./atlasAuth.mjs')
  const request = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => [] })

  await expect(validateAtlasAccount('a'.repeat(40), request)).resolves.toBeNull()
})
