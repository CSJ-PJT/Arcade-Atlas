# Atlas 통합 로그인

## 사용자 안내

- Sketchfy Atlas에 가입한 계정은 Arcade Atlas에서 같은 이메일과 비밀번호를 사용합니다.
- 같은 origin의 같은 브라우저에서 Sketchfy Atlas에 이미 로그인했다면 Arcade Atlas가 기존 Supabase Auth 세션을 자동으로 인식합니다.
- 새 가입, 이메일 인증, 비밀번호 재설정은 기존 Sketchfy Atlas 화면에서 진행합니다.
- 알파·베타 기간에는 싱글플레이를 로그인 없이 체험할 수 있고, 멀티플레이는 Atlas 계정 로그인이 필요합니다.
- Arcade의 기기 최고 점수와 임시 대전 기록은 Sketchfy 프로필이나 공식 랭킹으로 취급하지 않습니다.

## 구현 계약

Arcade는 Sketchfy와 동일한 `VITE_SUPABASE_URL` 및 `VITE_SUPABASE_PUBLISHABLE_KEY`를 사용합니다. Supabase JS의 기본 persistent session storage key를 변경하지 않으므로 동일 origin의 `/sketchfy/`와 `/arcade/`가 한 로그인 세션을 공유합니다.

브라우저에는 publishable key만 주입합니다. `service_role`, secret key, 사용자 비밀번호를 source, Git, build artifact에 기록하지 않습니다. 초기 세션은 `getSession()`으로 찾고 `getUser()`로 서버 검증한 뒤 인증 상태로 전환합니다. 인증 실패와 설정 누락은 무반응으로 삼키지 않고 재시도 안내를 표시합니다.

현재 로그인 보호는 Arcade 클라이언트의 멀티플레이 진입 계약입니다. 공식 랭킹이나 보상이 도입될 때에는 WebSocket 서버도 access token을 검증하고 서버 사용자 ID를 방 참가자 정체성의 권위로 사용해야 합니다.
