import { useI18n } from './I18nProvider'

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n()
  return (
    <label className="language-switcher">
      <span>{t('language.label', '언어')}</span>
      <select aria-label={t('language.label', '언어')} value={language} onChange={(event) => setLanguage(event.target.value as 'ko' | 'en' | 'ja')}>
        <option value="ko">{t('language.ko', '한국어')}</option>
        <option value="en">{t('language.en', 'English')}</option>
        <option value="ja">{t('language.ja', '日本語')}</option>
      </select>
    </label>
  )
}
