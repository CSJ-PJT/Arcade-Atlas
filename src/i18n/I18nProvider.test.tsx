import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from './I18nProvider'
import { LanguageSwitcher } from './LanguageSwitcher'

function Copy() {
  const { t } = useI18n()
  return <h1>{t('home.games', '게임 선택')}</h1>
}

describe('I18nProvider', () => {
  beforeEach(() => localStorage.clear())

  it('switches and persists English and Japanese without a reload', () => {
    render(<I18nProvider><LanguageSwitcher /><Copy /></I18nProvider>)
    expect(screen.getByRole('heading')).toHaveTextContent('게임 선택')
    fireEvent.change(screen.getByLabelText('언어'), { target: { value: 'en' } })
    expect(screen.getByRole('heading')).toHaveTextContent('Choose a game')
    expect(localStorage.getItem('arcade:language:v1')).toBe('en')
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'ja' } })
    expect(screen.getByRole('heading')).toHaveTextContent('ゲームを選ぶ')
    expect(document.documentElement.lang).toBe('ja')
  })
})
