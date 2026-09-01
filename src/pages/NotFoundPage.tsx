import { Link } from 'react-router-dom'
import { AtlasBrand } from '../components/AtlasBrand'
import { useI18n } from '../i18n/I18nProvider'

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <main className="status-page">
      <AtlasBrand />
      <p className="kicker">COORDINATE NOT FOUND</p>
      <h1>{t('notFound.title', '이 항로에는 아직 게임이 없습니다.')}</h1>
      <Link className="primary-action" to="/">{t('common.arcadeHome', 'Arcade 홈으로')}</Link>
    </main>
  )
}
