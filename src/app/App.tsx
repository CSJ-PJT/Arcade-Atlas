import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ArcadeHomePage } from '../pages/ArcadeHomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { MusicProvider } from '../audio/MusicProvider'
import { I18nProvider, useI18n } from '../i18n/I18nProvider'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'

const GravityStackPage = lazy(async () => {
  const module = await import('../games/gravity-stack/GravityStackPage')
  return { default: module.GravityStackPage }
})

const MultiplayerGravityStackPage = lazy(async () => {
  const module = await import('../games/gravity-stack/multiplayer/MultiplayerGravityStackPage')
  return { default: module.MultiplayerGravityStackPage }
})

export function App() {
  return (
    <I18nProvider><BrowserRouter basename="/arcade"><MusicProvider><LocalizedRoutes />
    </MusicProvider></BrowserRouter></I18nProvider>
  )
}

function LocalizedRoutes() {
  const { t } = useI18n()
  return <>
      <LanguageSwitcher />
      <Routes>
        <Route path="/" element={<ArcadeHomePage />} />
        <Route
          path="/stack"
          element={(
            <Suspense fallback={<main className="route-loading" aria-live="polite">{t('route.gameLoading', '게임 모듈 연결 중…')}</main>}>
              <GravityStackPage />
            </Suspense>
          )}
        />
        <Route
          path="/stack/multi"
          element={(
            <Suspense fallback={<main className="route-loading" aria-live="polite">{t('route.multiLoading', '실시간 대전 연결 중…')}</main>}>
              <MultiplayerGravityStackPage />
            </Suspense>
          )}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
}
