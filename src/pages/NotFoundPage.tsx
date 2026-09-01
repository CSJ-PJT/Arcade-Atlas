import { Link } from 'react-router-dom'
import { AtlasBrand } from '../components/AtlasBrand'

export function NotFoundPage() {
  return (
    <main className="status-page">
      <AtlasBrand />
      <p className="kicker">COORDINATE NOT FOUND</p>
      <h1>이 항로에는 아직 게임이 없습니다.</h1>
      <Link className="primary-action" to="/">Arcade 홈으로</Link>
    </main>
  )
}
