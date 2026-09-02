import { Link } from 'react-router-dom'
import { useAtlasAuth } from './AuthProvider'
import { useI18n } from '../i18n/I18nProvider'

export function AtlasAccountButton() {
  const auth = useAtlasAuth()
  const { t } = useI18n()
  if (auth.status === 'authenticated') {
    return (
      <div className="atlas-account-pill">
        <span><i aria-hidden="true" />{auth.profile?.nickname ?? t('auth.connected', 'Atlas 계정 연결됨')}</span>
        <button type="button" onClick={() => void auth.signOut()}>{t('auth.logout', '로그아웃')}</button>
      </div>
    )
  }
  return <Link className="atlas-account-link" to="/login">{t('auth.login', 'Atlas 로그인')}</Link>
}
