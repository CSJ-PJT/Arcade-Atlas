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
  if (auth.status === 'authenticated' && auth.profileStatus === 'loading') {
    return <main className="route-loading" aria-live="polite">{t('auth.profileChecking', '공유 Atlas 프로필을 불러오는 중…')}</main>
  }
  if (auth.status === 'authenticated' && auth.profileStatus === 'ready') return children
  if (auth.status === 'authenticated' && auth.profileStatus === 'missing') {
    return <main className="status-page auth-status-card" role="alert"><p className="kicker">ATLAS PROFILE</p><h1>{t('auth.profileMissing', 'Sketchfy 프로필 설정이 필요합니다.')}</h1><p>{t('auth.profileMissingHelp', '중복 계정을 만들지 않고 기존 Atlas 계정에 게임용 표시 이름을 연결합니다.')}</p><a className="primary-action" href="/sketchfy/profile">{t('auth.setupProfile', '프로필 설정')}</a></main>
  }
  if (auth.status === 'authenticated' && auth.profileStatus === 'error') {
    return <main className="status-page auth-status-card" role="alert"><p className="kicker">ATLAS PROFILE</p><h1>{t('auth.profileError', '공유 프로필을 불러오지 못했습니다.')}</h1><p>{t('auth.profileErrorHelp', '새 프로필을 만들지 말고 잠시 후 다시 시도해 주세요.')}</p><button className="primary-action" type="button" onClick={() => void auth.refreshProfile()}>{t('auth.retry', '다시 확인')}</button></main>
  }
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
