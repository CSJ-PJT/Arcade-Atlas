# Arcade Atlas architecture

## 경계

React는 라우팅, 홈, HUD, overlay, 터치 입력, 접근성 DOM, 로컬 최고 점수를 담당합니다. Phaser는 canvas 보드, 현재 조각, simulation loop, 키보드 입력 adapter와 짧은 시각 효과를 담당합니다. 게임 판정은 `src/games/gravity-stack/core`의 순수 TypeScript 엔진만 수행합니다.

core는 DOM, React, Phaser를 import하지 않습니다. Scene은 점수 공식을 복제하지 않고 엔진 snapshot을 그립니다. React도 충돌·방전 판정을 수행하지 않습니다. Phaser 인스턴스는 React effect cleanup에서 `destroy(true)`로 제거해 StrictMode 이중 canvas를 방지합니다.

## 게임 추가

1. `src/app/gameCatalog.ts`에 catalog entry를 추가합니다.
2. `src/games/<game-id>/` 아래 core, renderer, React components를 분리합니다.
3. `src/app/App.tsx`에 route를 연결합니다.
4. 각 core의 결정성과 UI/browser gate를 추가합니다.

준비 중 catalog entry는 route를 갖지 않으며 빈 화면으로 이동하지 않습니다.

## 향후 서버 기능

Auth와 leaderboard는 게임 core 바깥의 별도 adapter로 도입해야 합니다. 로컬 최고 점수는 신뢰 가능한 서버 기록이 아니며 서버 랭킹으로 승격하지 않습니다. Realtime multiplayer가 도입되더라도 결정적 입력 stream과 권위 서버 검증을 별도 설계해야 합니다.

## 실시간 대전 경계

`server/`의 WebSocket 서비스는 2~4명 임시 방, 참가 준비, 공통 seed와 동시 시작, 점수·레벨·생존 상태를 관리합니다. 브라우저는 같은 seed를 사용해 각자 독립 보드를 실행합니다. 서버는 입력 replay를 검증하는 권위 게임 서버가 아니므로 이 점수는 영구 랭킹이나 보상에 사용할 수 없습니다. 연결이 종료되면 참가자는 방에서 제거되고 빈 방은 삭제됩니다.

## `/arcade/` 정적 구조

Vite base와 BrowserRouter basename은 모두 `/arcade/`입니다. 운영 정적 서버는 `/arcade/` 파일을 제공하고 알려지지 않은 client route를 `/arcade/index.html`로 fallback해야 합니다. 본 P0-A는 배포나 nginx 변경을 수행하지 않습니다.
