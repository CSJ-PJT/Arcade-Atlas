import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAtlasAuth } from './AuthProvider'
import { useI18n } from '../i18n/I18nProvider'

export function RequireAtlasAccount({ children }: PropsWithChildren) {
  const auth = useAtlasAuth()
  const location = useLocation()
  const { t } = useI18n()

  if (auth.status === 'loading') {
    return <main className="route-loading" aria-live="polite">{t('auth.checking', 'Atlas 로그인 확인 중…')}</main>
  }
  if (auth.status === 'authenticated') return children
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ next: `${location.pathname}${location.search}` }} />
  }
  return (
    <main className="status-page auth-status-card" role="alert">
      <p className="kicker">ATLAS ACCOUNT</p>
      <h1>{t('auth.unavailableTitle', '통합 로그인을 준비하지 못했습니다.')}</h1>
      <p>{t('auth.unavailableHelp', '연결 설정을 확인한 뒤 다시 시도해 주세요. 싱글플레이는 계속 이용할 수 있습니다.')}</p>
      {auth.status === 'error' ? <button className="primary-action" type="button" onClick={() => void auth.retry()}>{t('auth.retry', '다시 확인')}</button> : null}
      <a className="secondary-action" href="/arcade/">{t('common.arcadeHome', 'Arcade 홈')}</a>
    </main>
  )
}
