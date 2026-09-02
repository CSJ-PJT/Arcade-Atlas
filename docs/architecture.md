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

`server/`의 WebSocket 서비스는 2~4명 임시 방, 참가 준비, 공통 seed와 동시 시작, 점수·레벨·생존 상태를 관리합니다. 브라우저는 순서 번호가 붙은 `left/right/rotate/down/hardDrop` 입력만 전송합니다. 서버는 브라우저와 같은 `src/games/gravity-stack/core` 엔진을 실행해 보드·점수·방전·게임오버·아이템을 판정하고 versioned checkpoint를 저장합니다. 클라이언트가 신고한 점수나 제거 셀은 받지 않습니다. 아이템 모드의 장애물 보드 변화, 회전 잠금, 다음 조각 교란, 낙하 가속 종료 시각도 서버 권위 상태로 저장하며 재접속 시 복원합니다. Atlas AI 역시 같은 엔진 명령과 지속 효과 계약을 사용합니다.

연결이 끊기면 참가자를 즉시 삭제하지 않고 30초 복귀 유예를 둡니다. 브라우저는 지수 backoff로 자동 재접속하고 서버 checkpoint를 복원합니다. 서버는 heartbeat, Origin·프로토콜 검사, 연결/메시지 제한을 적용하며 방 상태를 권한 0700의 systemd `StateDirectory`에 원자 저장합니다. 규칙·AI 엔진·snapshot version이 맞지 않는 상태는 복구하지 않습니다. 유예 만료 후에만 참가자를 제거하고 호스트를 승계하며, 60초 입력 없는 실시간 참가자는 기권 처리합니다.

## `/arcade/` 정적 구조

Vite base와 BrowserRouter basename은 모두 `/arcade/`입니다. 운영 정적 서버는 `/arcade/` 파일을 제공하고 알려지지 않은 client route를 `/arcade/index.html`로 fallback해야 합니다. build는 `build-info.json`에 Git SHA, build timestamp, 규칙·AI 버전, artifact manifest SHA-256을 기록합니다.
