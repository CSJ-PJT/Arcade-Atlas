# Gravity Stack rules

## 보드와 조각

- 보드는 12×18 사각 격자입니다.
- 조각은 2~5개 셀로 구성된 독자적인 10종 모듈 세트입니다.
- 한 조각의 셀은 서로 다른 에너지와 기호를 가질 수 있습니다.
- seed PRNG가 조각과 에너지를 결정합니다. 게임 규칙에서 `Math.random()`을 사용하지 않습니다.
- 회전은 90도이며, 충돌 시 `0, -1, +1, -2, +2` 순서의 제한적인 수평 보정만 시도합니다.

## 방전

상하좌우로 연결된 같은 에너지 셀 6개 이상이 한 wave에서 동시에 제거됩니다. 대각선은 연결로 인정하지 않습니다. 제거 후 각 열이 독립적으로 아래로 낙하하며, 새로운 그룹이 생기면 다음 wave가 이어집니다.

## 점수

```text
groupScore = groupSize × 10 + max(0, groupSize - 6) × 20
waveScore = sum(groupScore) × waveIndex
```

wave index는 한 조각을 고정한 뒤 1부터 증가합니다. 제거 셀 30개마다 level이 1 증가합니다.

```text
level = 1 + floor(totalClearedCells / 30)
dropInterval = max(160ms, 900ms - (level - 1) × 70ms)
```

## 입력과 상태

- 좌우 방향키: 이동
- 위 방향키: 회전
- 아래 방향키: 한 칸 낙하
- Space: 즉시 낙하
- P/Escape: 일시정지/계속
- R: 일시정지 또는 게임 오버 상태에서 재시작
- 모바일에서는 화면 하단 pointer controls를 사용합니다.

상태는 `ready`, `playing`, `paused`, `gameOver`입니다. background 탭은 자동 일시정지되며 foreground 복귀 시 자동 재개하지 않습니다. 새 조각의 spawn 공간이 없으면 게임 오버입니다.

## 결정성과 독립성

동일 seed, simulation tick, 입력 순서는 같은 조각 sequence와 board를 만듭니다. wall-clock은 판정의 원천이 아닙니다.

Gravity Stack은 기존 상용 낙하 블록 게임의 명칭, 로고, 음악, 공식 조각 세트, 10×20 보드, 줄 제거, 색상 매핑, Hold/ghost/회전 규칙을 사용하지 않습니다. 외부 게임 asset도 포함하지 않습니다.
