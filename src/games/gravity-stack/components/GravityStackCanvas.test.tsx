import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GravityStackEngine } from '../core/engine'
import { GravityStackCanvas } from './GravityStackCanvas'

const mocks = vi.hoisted(() => ({ create: vi.fn(), destroy: vi.fn() }))

vi.mock('../phaser/createGravityStackGame', () => ({
  createGravityStackGame: (...args: unknown[]) => {
    mocks.create(...args)
    return { destroy: mocks.destroy }
  },
}))

describe('GravityStackCanvas', () => {
  it('destroys every Phaser instance during StrictMode remount and unmount', () => {
    const view = render(
      <StrictMode>
        <GravityStackCanvas engine={new GravityStackEngine('strict')} onSnapshot={() => undefined} />
      </StrictMode>,
    )
    view.unmount()
    expect(mocks.create.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(mocks.destroy).toHaveBeenCalledTimes(mocks.create.mock.calls.length)
  })
})
