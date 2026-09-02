export interface GameCatalogEntry {
  id: string
  title: string
  eyebrow: string
  description: string
  route?: string
  status: 'playable' | 'upcoming'
  controls: string
}

export const gameCatalog: readonly GameCatalogEntry[] = [
  {
    id: 'gravity-stack',
    title: 'Gravity Stack',
    eyebrow: 'ENERGY ARRAY 01',
    description: '가로줄을 완성해 지우거나, 같은 에너지 6개를 연결해 연쇄 방전을 일으키세요.',
    route: '/stack',
    status: 'playable',
    controls: '키보드 · 모바일 터치',
  },
  {
    id: 'orbit-snake',
    title: 'Orbit Snake',
    eyebrow: 'ORBITAL TEST 02',
    description: '궤도를 확장하는 탐사 게임을 준비하고 있습니다.',
    status: 'upcoming',
    controls: '준비 중',
  },
  {
    id: 'core-breaker',
    title: 'Core Breaker',
    eyebrow: 'CORE TEST 03',
    description: '반응로 방벽을 해체하는 아케이드 게임을 준비하고 있습니다.',
    status: 'upcoming',
    controls: '준비 중',
  },
] as const
