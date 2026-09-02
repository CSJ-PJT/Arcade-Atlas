# Atlas 통합 로그인

## 사용자 안내

- Sketchfy Atlas에 가입한 계정은 Arcade Atlas에서 같은 이메일과 비밀번호를 사용합니다. 별도 Arcade 계정이나 프로필 복사본을 만들지 않습니다.
- 닉네임, 아바타 seed, 국가·언어·시간대·학습 설정과 Sketchfy 게임 통계는 같은 사용자 ID의 `sketchfy_profiles` 행을 읽습니다. 이메일은 검증된 Supabase Auth 사용자 정보가 원천입니다.
- 같은 origin의 같은 브라우저에서 Sketchfy Atlas에 이미 로그인했다면 Arcade Atlas가 기존 Supabase Auth 세션을 자동으로 인식합니다.
- 새 가입, 이메일 인증, 비밀번호 재설정은 기존 Sketchfy Atlas 화면에서 진행합니다.
- 알파·베타 기간에는 싱글플레이를 로그인 없이 체험할 수 있고, 멀티플레이는 Atlas 계정 로그인이 필요합니다.
- Arcade의 기기 최고 점수와 임시 대전 기록은 Sketchfy 프로필이나 공식 랭킹으로 취급하지 않습니다.

## 구현 계약

Arcade는 Sketchfy와 동일한 `VITE_SUPABASE_URL` 및 `VITE_SUPABASE_PUBLISHABLE_KEY`를 사용합니다. Supabase JS의 기본 persistent session storage key를 변경하지 않으므로 동일 origin의 `/sketchfy/`와 `/arcade/`가 한 로그인 세션을 공유합니다.

브라우저에는 publishable key만 주입합니다. `service_role`, secret key, 사용자 비밀번호를 source, Git, build artifact에 기록하지 않습니다. 초기 세션은 `getSession()`으로 찾고 `getUser()`로 서버 검증한 뒤 인증 상태로 전환합니다. 인증 실패와 설정 누락은 무반응으로 삼키지 않고 재시도 안내를 표시합니다.

Arcade는 인증된 사용자 ID로 `sketchfy_profiles.id`를 제한 조회하며 프로필 없음과 조회 오류를 구분합니다. 프로필이 없으면 기존 Sketchfy 프로필 설정으로 안내하고, 조회 오류일 때 중복 프로필 생성을 시도하지 않습니다. 멀티플레이 표시 이름은 공유 프로필 닉네임을 사용하며 임의 변경할 수 없습니다.

WebSocket 연결은 protocol 3의 `authenticate` 단계에서 access token을 Supabase Auth `/user` endpoint로 검증하고, 같은 token으로 공유 프로필을 조회합니다. 서버가 검증한 닉네임만 방 참가자 정체성으로 사용합니다. 운영 systemd는 권한이 제한된 `/etc/arcade-atlas/auth.env`에서 `SUPABASE_URL`과 `SUPABASE_PUBLISHABLE_KEY`를 읽고 `ARCADE_AUTH_REQUIRED=true`로 실행합니다. service role은 사용하지 않습니다.

향후 게임 허브도 같은 Supabase Auth 프로젝트와 `sketchfy_profiles` 사용자 ID를 사용해야 합니다. 동일 origin 경로에서는 현재 persistent session을 공유하고, 별도 origin으로 분리할 때에는 중앙 로그인 callback/OAuth 교환 계약을 추가하되 게임별 사용자 복제 테이블은 만들지 않습니다.
