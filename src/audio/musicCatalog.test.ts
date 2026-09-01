import { describe, expect, it } from 'vitest'
import { gameTracks, lobbyTrack, pickGameTrack } from './musicCatalog'

describe('music catalog', () => {
  it('keeps the waiting track out of the in-game pool', () => {
    expect(gameTracks).not.toContain(lobbyTrack)
    expect(new Set(gameTracks).size).toBe(6)
  })

  it('does not immediately repeat an in-game track', () => {
    expect(pickGameTrack(gameTracks[0], () => 0)).not.toBe(gameTracks[0])
  })
})
