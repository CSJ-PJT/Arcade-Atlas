import { Link } from 'react-router-dom'

interface AtlasBrandProps {
  compact?: boolean
}

export function AtlasBrand({ compact = false }: AtlasBrandProps) {
  return (
    <Link className={`atlas-brand${compact ? ' atlas-brand--compact' : ''}`} to="/" aria-label="Arcade Atlas 홈">
      <span className="atlas-brand__mark" aria-hidden="true">A</span>
      <span>
        <strong>ARCADE ATLAS</strong>
        {!compact && <small>PLAYABLE SYSTEMS LAB</small>}
      </span>
    </Link>
  )
}
