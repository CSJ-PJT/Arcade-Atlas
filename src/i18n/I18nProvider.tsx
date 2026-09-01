import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

export type Language = 'ko' | 'en' | 'ja'
type Variables = Record<string, string | number>

const STORAGE_KEY = 'arcade:language:v1'

const en: Record<string, string> = {
  'language.label': 'Language', 'language.ko': '한국어', 'language.en': 'English', 'language.ja': '日本語',
  'brand.home': 'Arcade Atlas home', 'route.gameLoading': 'Connecting game module…', 'route.multiLoading': 'Connecting live match…',
  'music.start': 'Start music', 'music.on': 'Music on', 'music.off': 'Music off',
  'home.title': 'Start quickly,\nplay to the finish.', 'home.description': 'The Atlas arcade lab—play instantly in your browser.', 'home.inputs': 'Supported controls', 'home.games': 'Game selection',
  'home.play': 'Play Gravity Stack', 'home.multiplayer': 'Live match', 'home.upcoming': 'Coming soon',
  'catalog.gravity-stack.description': 'Place energy modules and connect six matching cells to trigger chain discharges.', 'catalog.gravity-stack.controls': 'Keyboard · mobile touch',
  'catalog.orbit-snake.description': 'An orbital exploration game is in development.', 'catalog.orbit-snake.controls': 'Coming soon',
  'catalog.core-breaker.description': 'A reactor-barrier arcade game is in development.', 'catalog.core-breaker.controls': 'Coming soon',
  'notFound.title': 'There is no game on this route yet.', 'common.arcadeHome': 'Arcade home', 'common.missionSelect': 'Mission select',
  'hud.scoreboard': 'Game scoreboard', 'hud.next': 'Next piece',
  'controls.mobile': 'Mobile game controls', 'controls.left': 'Move left', 'controls.rotate': 'Rotate clockwise', 'controls.right': 'Move right', 'controls.down': 'Move down one cell', 'controls.hardDrop': 'Hard drop', 'controls.pause': 'Pause or resume',
  'result.gameOver': 'Game over', 'result.finalScore': 'Final score', 'result.level': 'Level reached', 'result.cleared': 'Cells cleared', 'result.maxChain': 'Max chain', 'common.restart': 'Restart',
  'single.readyStatus': 'Gravity Stack ready', 'single.pausedStatus': 'Game paused.', 'single.gameOverStatus': 'Game over. Final score: {score}', 'single.chainStatus': '{chain}-chain discharge', 'single.playingStatus': 'Playing. Level {level}, score {score}',
  'single.rule': 'Connect six matching energy cells vertically or horizontally to create chain discharges.', 'single.board': 'Gravity Stack board. Use arrow keys and Space to play.', 'single.readyTitle': 'Start the energy array?', 'single.readyHelp': 'Use the arrow keys or the touch panel below.', 'single.start': 'Start game', 'single.pauseTitle': 'Paused', 'single.pauseHelp': 'The game will not resume automatically. Continue when ready.', 'common.resume': 'Resume',
  'single.briefing': 'Gravity Stack controls and status', 'single.controls': 'Controls', 'single.moveHorizontal': 'Move left/right', 'single.rotate': 'Rotate', 'single.softDrop': 'Move down one cell', 'single.hardDrop': 'Hard drop', 'single.pause': 'Pause', 'single.restartPaused': 'Restart while stopped', 'single.cleared': 'Cells cleared', 'single.maxChain': 'Max chain', 'single.dropInterval': 'Drop interval', 'single.status': 'Status',
  'multi.reconnecting': 'Connection lost briefly. Restoring the room automatically.', 'multi.recoveryTitle': 'Returning to your previous room', 'multi.recoveryHelp': 'Reconnect within 30 seconds to continue with the same state.', 'multi.title': 'Gravity Stack live match', 'multi.description': 'Two to four players start with the same seed. The shared server engine judges every move—build the highest score on your own board.', 'multi.name': 'Display name', 'multi.mode': 'Game mode', 'multi.normal': 'Normal mode', 'multi.normalHelp': 'Pure score match under equal conditions', 'multi.items': 'Item mode', 'multi.itemsHelp': 'Earn shields and gravity pulses by discharging cells', 'multi.create': 'Create room', 'multi.code': 'Room code', 'multi.join': 'Join', 'multi.connection': 'Live connection: {state}',
  'multi.roomTitle': 'Room code {code}', 'multi.invite': 'Share this code with other players. Up to four players can join.', 'multi.aiDifficulty': 'AI difficulty', 'multi.rookie': 'Rookie · relaxed', 'multi.pilot': 'Pilot · balanced', 'multi.ace': 'Ace · fast', 'multi.addAi': 'Add Atlas AI', 'multi.cancelReady': 'Cancel ready', 'multi.ready': 'Ready', 'multi.startTogether': 'Start together',
  'multi.matchTitle': 'Live energy match', 'multi.sameSeed': 'Every participant started with the same seed.', 'multi.board': 'Multiplayer Gravity Stack board', 'multi.sync': 'Preparing synchronized start', 'multi.finished': 'Match complete', 'multi.mvp': 'MVP {name} · {score} points · {cleared} cells · max {chain}-chain', 'multi.rematch': 'Prepare rematch', 'multi.myFinished': 'My run complete', 'multi.forfeited': 'Match forfeited', 'multi.waiting': 'Waiting for other players to finish.', 'multi.forfeit': 'Forfeit match', 'multi.standings': 'Live standings',
  'multi.item': 'Items', 'multi.itemHelp': 'Each player alternates between a pulse and a shield every 12 cleared cells.', 'multi.shield': 'Shield × {count}', 'multi.pulse': 'Gravity pulse × {count}', 'multi.shieldActive': 'Shield active', 'multi.points': '{score} pts · Lv.{level} · {cleared} cells', 'multi.danger': '{name} board danger {danger}/18, latest {chain}-chain', 'multi.removeAi': 'Remove {name}',
  'error.connect': 'Could not connect to the live server. Retrying automatically.', 'error.recovering': 'Restoring the connection. Synchronization will resume shortly.', 'error.ROOM_NOT_FOUND': 'Check the room code.', 'error.ROOM_FULL': 'The room is full.', 'error.MATCH_IN_PROGRESS': 'This match has already started.', 'error.NOT_READY': 'At least two players must join and everyone must be ready.', 'error.INVALID_INPUT': 'Input order was rejected. Waiting for server synchronization.', 'error.INPUT_RATE_LIMITED': 'Input was too fast and was limited to a safe rate.', 'error.ENGINE_NOT_READY': 'The server game engine is preparing.', 'error.PROTOCOL_MISMATCH': 'Game versions do not match. Reload the page.', 'error.RATE_LIMITED': 'Too many requests. The connection is resting briefly.', 'error.RESUME_FAILED': 'The reconnect window expired. Join a new room.', 'error.INVALID_ITEM': 'That item cannot be used now.', 'error.ROOM_CAPACITY_REACHED': 'Room capacity is full. Try again shortly.', 'error.ROOM_CREATION_LIMITED': 'Too many rooms were created in a short time. Try again shortly.', 'error.BOT_CAPACITY_REACHED': 'AI player capacity is full.', 'error.default': 'The request could not be completed.',
}

const ja: Record<string, string> = {
  'language.label': '言語', 'language.ko': '한국어', 'language.en': 'English', 'language.ja': '日本語',
  'brand.home': 'Arcade Atlas ホーム', 'route.gameLoading': 'ゲームモジュールに接続中…', 'route.multiLoading': 'リアルタイム対戦に接続中…',
  'music.start': '音楽を開始', 'music.on': '音楽をオン', 'music.off': '音楽をオフ',
  'home.title': 'すぐ始めて、\n最後まで遊ぼう。', 'home.description': 'インストール不要。ブラウザで遊べる Atlas アーケード研究室です。', 'home.inputs': '対応操作', 'home.games': 'ゲーム選択', 'home.play': 'Gravity Stack をプレイ', 'home.multiplayer': 'リアルタイム対戦', 'home.upcoming': '準備中',
  'catalog.gravity-stack.description': 'エネルギーモジュールを配置し、同じエネルギーを6個つないで連鎖放電を起こそう。', 'catalog.gravity-stack.controls': 'キーボード · モバイルタッチ', 'catalog.orbit-snake.description': '軌道を広げる探索ゲームを開発中です。', 'catalog.orbit-snake.controls': '準備中', 'catalog.core-breaker.description': '炉心バリアを解除するアーケードゲームを開発中です。', 'catalog.core-breaker.controls': '準備中',
  'notFound.title': 'この航路にはまだゲームがありません。', 'common.arcadeHome': 'Arcade ホーム', 'common.missionSelect': 'ミッション選択',
  'hud.scoreboard': 'ゲームスコアボード', 'hud.next': '次のピース', 'controls.mobile': 'モバイルゲーム操作', 'controls.left': '左へ移動', 'controls.rotate': '時計回りに回転', 'controls.right': '右へ移動', 'controls.down': '1マス下へ', 'controls.hardDrop': '一気に落下', 'controls.pause': '一時停止または再開',
  'result.gameOver': 'ゲームオーバー', 'result.finalScore': '最終スコア', 'result.level': '到達レベル', 'result.cleared': '消去セル', 'result.maxChain': '最大連鎖', 'common.restart': 'もう一度',
  'single.readyStatus': 'Gravity Stack 準備完了', 'single.pausedStatus': 'ゲームを一時停止しました。', 'single.gameOverStatus': 'ゲームオーバー。最終スコア {score}', 'single.chainStatus': '{chain}連鎖放電', 'single.playingStatus': 'プレイ中。レベル {level}、スコア {score}', 'single.rule': '同じエネルギーを上下左右に6個つないで連鎖放電を作ろう。', 'single.board': 'Gravity Stack ゲームボード。矢印キーとスペースで操作します。', 'single.readyTitle': 'エネルギー配列を開始しますか？', 'single.readyHelp': '矢印キーまたは下のタッチパネルで操作できます。', 'single.start': 'ゲーム開始', 'single.pauseTitle': '一時停止', 'single.pauseHelp': '自動では再開しません。準備ができたら続けてください。', 'common.resume': '続ける', 'single.briefing': 'Gravity Stack の操作と状態', 'single.controls': '操作', 'single.moveHorizontal': '左右移動', 'single.rotate': '回転', 'single.softDrop': '1マス落下', 'single.hardDrop': '一気に落下', 'single.pause': '一時停止', 'single.restartPaused': '停止中に再スタート', 'single.cleared': '消去セル', 'single.maxChain': '最大連鎖', 'single.dropInterval': '落下間隔', 'single.status': '状態',
  'multi.reconnecting': '接続が一時的に切れました。ルームを自動復旧中です。', 'multi.recoveryTitle': '以前のルームに復帰中', 'multi.recoveryHelp': '30秒以内に再接続すると同じ状態から続けられます。', 'multi.title': 'Gravity Stack リアルタイム対戦', 'multi.description': '2〜4人が同じシードで同時に開始します。共通サーバーエンジンが操作を判定し、それぞれのボードで最高得点を目指します。', 'multi.name': '表示名', 'multi.mode': 'ゲームモード', 'multi.normal': '通常モード', 'multi.normalHelp': '同じ条件で純粋なスコア対決', 'multi.items': 'アイテムモード', 'multi.itemsHelp': '放電でシールドと重力パルスを獲得', 'multi.create': 'ルーム作成', 'multi.code': 'ルームコード', 'multi.join': '参加', 'multi.connection': 'リアルタイム接続: {state}',
  'multi.roomTitle': 'ルームコード {code}', 'multi.invite': '一緒に遊ぶ人にコードを共有してください。最大4人まで参加できます。', 'multi.aiDifficulty': 'AI難易度', 'multi.rookie': 'ルーキー · ゆったり', 'multi.pilot': 'パイロット · バランス', 'multi.ace': 'エース · 高速', 'multi.addAi': 'Atlas AIを追加', 'multi.cancelReady': '準備取消', 'multi.ready': '準備完了', 'multi.startTogether': '同時開始', 'multi.matchTitle': 'リアルタイム・エネルギー対戦', 'multi.sameSeed': '全参加者が同じシードで開始しました。', 'multi.board': 'マルチプレイ Gravity Stack ボード', 'multi.sync': '同時開始を準備中', 'multi.finished': '対戦終了', 'multi.mvp': 'MVP {name} · {score}点 · {cleared}セル · 最大{chain}連鎖', 'multi.rematch': '再対戦を準備', 'multi.myFinished': '自分のプレイ終了', 'multi.forfeited': '対戦を棄権', 'multi.waiting': '他の参加者の終了を待っています。', 'multi.forfeit': '対戦を棄権', 'multi.standings': 'リアルタイム順位', 'multi.item': 'アイテム', 'multi.itemHelp': '各プレイヤーは12セル放電ごとにパルスとシールドを交互に獲得します。', 'multi.shield': 'シールド × {count}', 'multi.pulse': '重力パルス × {count}', 'multi.shieldActive': 'シールド有効', 'multi.points': '{score}点 · Lv.{level} · {cleared}セル', 'multi.danger': '{name} ボード危険度 {danger}/18、直近{chain}連鎖', 'multi.removeAi': '{name}を削除',
  'error.connect': 'リアルタイムサーバーに接続できません。自動で再試行します。', 'error.recovering': '接続を復旧中です。まもなく同期を再開します。', 'error.ROOM_NOT_FOUND': 'ルームコードを確認してください。', 'error.ROOM_FULL': 'ルームは満員です。', 'error.MATCH_IN_PROGRESS': 'すでに開始済みのルームです。', 'error.NOT_READY': '2人以上が参加し、全員が準備完了になる必要があります。', 'error.INVALID_INPUT': '入力順序が一致しません。サーバー同期を待っています。', 'error.INPUT_RATE_LIMITED': '入力が速すぎるため安全な速度に制限しました。', 'error.ENGINE_NOT_READY': 'サーバーゲームエンジンを準備中です。', 'error.PROTOCOL_MISMATCH': 'ゲームバージョンが一致しません。ページを再読み込みしてください。', 'error.RATE_LIMITED': 'リクエストが多すぎます。しばらく待ってください。', 'error.RESUME_FAILED': '復帰可能時間が終了しました。新しいルームに参加してください。', 'error.INVALID_ITEM': '現在そのアイテムは使用できません。', 'error.ROOM_CAPACITY_REACHED': '作成可能なルーム数が上限です。しばらくしてからお試しください。', 'error.ROOM_CREATION_LIMITED': '短時間に多くのルームが作成されました。しばらくしてからお試しください。', 'error.BOT_CAPACITY_REACHED': 'AIプレイヤーの定員に達しました。', 'error.default': 'リクエストを処理できませんでした。',
}

const dictionaries: Record<Language, Record<string, string>> = { ko: {}, en, ja }

function readLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'ko' || stored === 'en' || stored === 'ja') return stored
  } catch { /* Use Korean when storage is unavailable. */ }
  return 'ko'
}

type I18nValue = { language: Language; locale: string; setLanguage: (language: Language) => void; t: (key: string, fallback: string, variables?: Variables) => string }
const I18nContext = createContext<I18nValue>({ language: 'ko', locale: 'ko-KR', setLanguage: () => undefined, t: (_key, fallback) => fallback })

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState(readLanguage)
  useEffect(() => { document.documentElement.lang = language }, [language])
  const value = useMemo<I18nValue>(() => ({
    language,
    locale: language === 'en' ? 'en-US' : language === 'ja' ? 'ja-JP' : 'ko-KR',
    setLanguage: (next) => {
      setLanguageState(next)
      try { localStorage.setItem(STORAGE_KEY, next) } catch { /* Keep the in-memory selection. */ }
    },
    t: (key, fallback, variables = {}) => {
      const template = dictionaries[language][key] ?? fallback
      return Object.entries(variables).reduce((text, [name, content]) => text.replaceAll(`{${name}}`, String(content)), template)
    },
  }), [language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() { return useContext(I18nContext) }
