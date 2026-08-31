import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ArcadeHomePage } from '../pages/ArcadeHomePage'
import { NotFoundPage } from '../pages/NotFoundPage'

const GravityStackPage = lazy(async () => {
  const module = await import('../games/gravity-stack/GravityStackPage')
  return { default: module.GravityStackPage }
})

export function App() {
  return (
    <BrowserRouter basename="/arcade">
      <Routes>
        <Route path="/" element={<ArcadeHomePage />} />
        <Route
          path="/stack"
          element={(
            <Suspense fallback={<main className="route-loading" aria-live="polite">게임 모듈 연결 중…</main>}>
              <GravityStackPage />
            </Suspense>
          )}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
