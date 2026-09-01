import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AtlasBrand } from '../components/AtlasBrand'
import { useAtlasAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'

type LoginState = { next?: string }

function safeNext(value: unknown) {
  return value === '/stack/multi' ? value : '/'
}

export function AtlasLoginPage() {
  const auth = useAtlasAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const next = safeNext((location.state as LoginState | null)?.next)

  if (auth.status === 'authenticated') return <Navigate to={next} replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    const ok = await auth.signIn(email.trim(), password)
    setSubmitting(false)
    if (ok) navigate(next, { replace: true })
  }

  return (
    <main className="auth-page" data-testid="atlas-login-page">
      <section className="auth-card">
        <AtlasBrand />
        <p className="kicker">ONE ATLAS ACCOUNT</p>
        <h1>{t('auth.title', 'Atlas 통합 로그인')}</h1>
        <p className="auth-lead">{t('auth.lead', 'Sketchfy Atlas에서 사용하던 계정으로 Arcade Atlas에도 로그인할 수 있습니다.')}</p>
        {auth.status === 'unavailable' ? (
          <p className="auth-error" role="alert">{t('auth.unavailableHelp', '연결 설정을 확인한 뒤 다시 시도해 주세요. 싱글플레이는 계속 이용할 수 있습니다.')}</p>
        ) : (
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <label htmlFor="atlas-email">{t('auth.email', '이메일')}</label>
            <input id="atlas-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <label htmlFor="atlas-password">{t('auth.password', '비밀번호')}</label>
            <input id="atlas-password" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="primary-action" type="submit" disabled={submitting || auth.status === 'loading'}>{submitting ? t('auth.signingIn', '로그인 중…') : t('auth.login', 'Atlas 로그인')}</button>
            {auth.error ? <p className="auth-error" role="alert">{t('auth.invalid', '이메일 또는 비밀번호를 확인해 주세요.')}</p> : null}
          </form>
        )}
        <aside className="sso-guide" aria-labelledby="sso-guide-title">
          <h2 id="sso-guide-title">{t('auth.guideTitle', '통합 로그인 안내')}</h2>
          <ol>
            <li>{t('auth.guideExisting', '기존 Sketchfy Atlas 가입자는 같은 이메일과 비밀번호를 사용하세요.')}</li>
            <li>{t('auth.guideSession', '이 브라우저에서 이미 로그인했다면 세션을 자동으로 인식합니다.')}</li>
            <li>{t('auth.guideBeta', '알파·베타 기간에는 멀티플레이만 로그인이 필요하며, 싱글플레이는 바로 체험할 수 있습니다.')}</li>
          </ol>
          <div className="auth-links">
            <a href="/sketchfy/signup">{t('auth.signup', '계정 만들기')}</a>
            <a href="/sketchfy/forgot-password">{t('auth.forgot', '비밀번호 재설정')}</a>
          </div>
        </aside>
        <Link className="secondary-action" to="/">{t('common.arcadeHome', 'Arcade 홈')}</Link>
      </section>
    </main>
  )
}
