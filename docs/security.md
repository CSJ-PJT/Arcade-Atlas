# Arcade Atlas security boundary

## 적용된 통제

- WebSocket Origin allowlist와 8KiB 메시지 상한
- nginx가 설정한 `X-Real-IP` 우선 식별 및 연결·메시지 빈도 제한
- 전체 연결 256, 주소별 동시 연결 8, 전체 방 200, 전체 AI 128 상한
- 주소별 10분 동안 방 생성 20회 상한
- 점수·제거 셀의 단조 증가, 레벨 공식, 단일 갱신 변화량과 점수 상한 검증
- 192-bit 재접속 토큰과 timing-safe 비교
- 0600 상태 파일, 0700 상태 디렉터리, 비권한 전용 계정
- systemd capability 제거, 장치·namespace·proc 접근 축소, 메모리·task·FD 상한
- Arcade 전용 CSP, HSTS, nosniff, frame/referrer/permission/cross-origin 헤더

## 검증

`npm audit`, 단위 테스트, 브라우저 테스트, 외부 Origin 거부, 반복 방 생성 제한, 운영 WebSocket canary를 수행합니다. 비밀값이나 재접속 토큰은 보고 및 로그에 출력하지 않습니다.

## 잔여 위험

이 서비스는 로그인 없는 게스트 게임이며 신뢰 가능한 랭킹 시스템이 아닙니다. 사람 클라이언트의 보드 전체를 서버가 재연산하지 않고 점수·레벨·제거량의 가능 범위를 검증하므로, 정교하게 조작된 클라이언트를 완전히 증명하는 구조는 아닙니다. 분산된 다수 출처를 이용한 대규모 공격은 애플리케이션 제한과 별도로 nginx/WAF 계층의 모니터링과 차단이 필요합니다.
