# Arcade Atlas

Arcade Atlas는 `/arcade/` 아래에서 실행되는 독립 브라우저 게임 허브입니다. 첫 번째 게임인 **Gravity Stack**은 12×18 에너지 보드에서 같은 에너지 셀을 연결해 연쇄 방전을 만드는 싱글플레이 게임입니다.

현재 구현:

- `/arcade/`: catalog 기반 게임 선택 홈
- `/arcade/stack`: Gravity Stack 싱글플레이
- `/arcade/stack/multi`: 사람과 Atlas AI를 합쳐 2~4명 실시간 대전
- Orbit Snake, Core Breaker: 준비 중 카드만 제공
- 우측 상단 언어 선택: 한국어, English, 日本語 (브라우저에 선택값 저장)
- 밝은 아케이드 홈과 Arcade Atlas 전용 에너지 탐사대 일러스트

## 기술 스택

- React 19 + TypeScript
- Vite (`base: "/arcade/"`)
- Phaser 3
- React Router (`basename="/arcade"`)
- Vitest + Testing Library
- Playwright Chromium

Node.js 24와 npm 11에서 검증합니다. 최소한 Vite가 지원하는 Node.js 버전을 사용해야 합니다.

## 로컬 실행

```bash
npm ci
npm run dev
npm run server
```

개발 서버의 `http://localhost:5173/arcade/`에서 시작합니다.

## 검증

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
git diff --check
```

production build는 `dist/`에 생성되며 모든 자산 URL은 `/arcade/` 기준입니다.

멀티플레이 서버는 `server/index.mjs`이며 `ARCADE_ALLOWED_ORIGINS`로 허용 사이트를 제한합니다. `deploy/`에는 systemd와 nginx의 검토 가능한 운영 템플릿이 있습니다.

보안 경계에는 Origin allowlist, 실제 프록시 주소 기반 연결 제한, 메시지 크기·빈도 제한, 방/AI 전역 상한, 주소별 방 생성 제한, 서버 권위 입력 판정, 0600 상태 저장과 Arcade 전용 CSP가 포함됩니다.

## 정적 배포 계약

직접 `/arcade/stack`으로 진입하려면 정적 서버가 실제 파일을 먼저 찾고, 없으면 `/arcade/index.html`로 fallback해야 합니다. 예: `try_files $uri $uri/ /arcade/index.html`. 이 저장소는 nginx 설정을 포함하거나 운영 서버를 변경하지 않습니다.

## 서비스 경계

- 실시간 대전은 WebSocket 임시 방을 사용합니다. 서버가 공통 게임 엔진으로 순서화된 입력을 판정하고 versioned board checkpoint를 원자 저장해 새로고침·프로세스 재시작 후에도 30초 동안 복귀할 수 있습니다.
- 자동 재접속, heartbeat, 연결 유예, 호스트 승계, 재대전을 지원합니다.
- 방장은 서로 다른 판단 품질과 decision seed를 가진 서버 실행형 Atlas AI 플레이어를 추가할 수 있습니다.
- 인증 및 신뢰 가능한 서버 랭킹은 제공하지 않습니다.
- 로비 1곡과 게임 전용 6곡은 사용자가 권리를 보유한 음원이며, 로비 곡이 게임 중 재생되지 않도록 재생 목록을 분리합니다.
- `public/images/arcade-energy-crew.png`는 이 프로젝트를 위해 새로 생성한 독자 캐릭터 자산이며 외부 게임 캐릭터를 사용하지 않습니다.
- 최고 점수는 `arcade:gravity-stack:best:v1` 키로 이 브라우저에만 저장됩니다.
- Atlas Management 및 다른 Atlas 저장소와 독립적입니다.
- 정적 앱과 실시간 서버는 각각 독립적으로 배포할 수 있습니다.

세부 구조는 [architecture](docs/architecture.md), 규칙은 [gravity-stack-rules](docs/gravity-stack-rules.md)를 참고하세요.
