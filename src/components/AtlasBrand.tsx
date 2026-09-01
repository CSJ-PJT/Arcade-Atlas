import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'

interface AtlasBrandProps {
  compact?: boolean
}

export function AtlasBrand({ compact = false }: AtlasBrandProps) {
  const { t } = useI18n()
  return (
    <Link className={`atlas-brand${compact ? ' atlas-brand--compact' : ''}`} to="/" aria-label={t('brand.home', 'Arcade Atlas 홈')}>
      <span className="atlas-brand__mark" aria-hidden="true">A</span>
      <span>
        <strong>ARCADE ATLAS</strong>
        {!compact && <small>PLAYABLE SYSTEMS LAB</small>}
      </span>
    </Link>
  )
}
