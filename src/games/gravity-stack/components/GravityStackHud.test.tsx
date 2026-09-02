import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { GravityStackEngine } from '../core/engine'
import { GravityStackHud } from './GravityStackHud'

describe('GravityStackHud', () => {
  it('hides the next piece accessibly while the sensor jam is active', () => {
    const snapshot = new GravityStackEngine('preview-jam').getSnapshot()
    render(<I18nProvider><GravityStackHud snapshot={snapshot} bestScore={0} hideNext /></I18nProvider>)
    expect(screen.getByLabelText('다음 조각 센서 교란 중')).toHaveTextContent('???')
    expect(document.querySelector('.next-module__cells')).toHaveAttribute('data-hidden', 'true')
  })
})
