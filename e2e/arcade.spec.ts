import { expect, test, type Page } from '@playwright/test'
import WebSocket from 'ws'

function observeRuntime(page: Page) {
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    const expectedMediaStop = request.resourceType() === 'media' && request.failure()?.errorText.includes('ERR_ABORTED')
    if (!expectedMediaStop) failedRequests.push(request.url())
  })
  return { consoleErrors, failedRequests }
}

test('owned lobby and in-game music are served from separate playlists', async ({ page }) => {
  const runtime = observeRuntime(page)
  await page.goto('/arcade/stack')
  const lobbyResponsePromise = page.waitForResponse((response) => response.url().endsWith('/arcade/audio/lobby.mp3'))
  await page.getByRole('button', { name: '음악 시작' }).click()
  const lobbyResponse = await lobbyResponsePromise
  expect([200, 206]).toContain(lobbyResponse.status())

  const gameResponsePromise = page.waitForResponse((response) => /\/arcade\/audio\/game-0[1-6]\.mp3$/.test(response.url()))
  await page.getByRole('button', { name: '게임 시작' }).click()
  const gameResponse = await gameResponsePromise
  expect([200, 206]).toContain(gameResponse.status())
  expect(gameResponse.url()).not.toBe(lobbyResponse.url())
  await page.getByRole('button', { name: '음악 끄기' }).click()
  expect(runtime.consoleErrors).toEqual([])
  expect(runtime.failedRequests).toEqual([])
})

test('direct Arcade home and catalog navigation work', async ({ page }) => {
  const runtime = observeRuntime(page)
  await page.goto('/arcade/')
  await expect(page.getByTestId('arcade-home')).toBeVisible()
  await expect(page.getByTestId('game-card-orbit-snake')).toContainText('준비 중')
  await page.getByRole('link', { name: 'Gravity Stack 플레이' }).click()
  await expect(page).toHaveURL(/\/arcade\/stack$/)
  await expect(page.getByTestId('gravity-stack-page')).toBeVisible()
  expect(runtime.consoleErrors).toEqual([])
  expect(runtime.failedRequests).toEqual([])
})

test('direct stack route supports keyboard, touch, pause, resume, and restart', async ({ page }) => {
  const runtime = observeRuntime(page)
  await page.goto('/arcade/stack')
  const game = page.getByTestId('gravity-stack-page')
  await page.getByRole('button', { name: '게임 시작' }).click()
  await expect(game).toHaveAttribute('data-game-status', 'playing')
  const initialX = Number(await game.getAttribute('data-active-x'))
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => Number(await game.getAttribute('data-active-x'))).toBe(initialX - 1)
  await page.getByRole('button', { name: '오른쪽 이동' }).click()
  await expect.poll(async () => Number(await game.getAttribute('data-active-x'))).toBe(initialX)
  await page.getByRole('button', { name: '일시정지 또는 계속' }).click()
  await expect(game).toHaveAttribute('data-game-status', 'paused')
  await page.getByRole('button', { name: '일시정지 또는 계속' }).click()
  await expect(game).toHaveAttribute('data-game-status', 'playing')
  await page.keyboard.press('Escape')
  await expect(game).toHaveAttribute('data-game-status', 'paused')
  await page.getByRole('dialog', { name: '일시정지' }).getByRole('button', { name: '계속하기' }).click()
  await expect(game).toHaveAttribute('data-game-status', 'playing')
  await page.keyboard.press('Escape')
  await page.keyboard.press('r')
  await expect(game).toHaveAttribute('data-game-status', 'playing')
  await expect(page.getByTestId('score')).toHaveText('0')
  expect(runtime.consoleErrors).toEqual([])
  expect(runtime.failedRequests).toEqual([])
})

test('a normal input sequence reaches game over and restart completes a full round', async ({ page }) => {
  test.setTimeout(60_000)
  const runtime = observeRuntime(page)
  await page.goto('/arcade/stack')
  const game = page.getByTestId('gravity-stack-page')
  await page.getByRole('button', { name: '게임 시작' }).click()

  for (let piece = 0; piece < 140; piece += 1) {
    if ((await game.getAttribute('data-game-status')) === 'gameOver') break
    await page.keyboard.press('Space')
  }

  await expect(game).toHaveAttribute('data-game-status', 'gameOver')
  const result = page.getByRole('dialog', { name: '게임 오버' })
  await expect(result).toContainText('최종 점수')
  await expect(result).toContainText('PLAY SEED')
  await result.getByRole('button', { name: '다시 시작' }).click()
  await expect(game).toHaveAttribute('data-game-status', 'playing')
  await expect(page.getByTestId('score')).toHaveText('0')
  expect(runtime.consoleErrors).toEqual([])
  expect(runtime.failedRequests).toEqual([])
})

test('two browsers create, join, ready and start the same seeded match', async ({ browser }) => {
  const hostContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  const hostRuntime = observeRuntime(host)
  const guestRuntime = observeRuntime(guest)

  await host.goto('/arcade/stack/multi')
  await expect(host.getByTestId('multiplayer-page')).toHaveAttribute('data-connection', 'open')
  await host.getByLabel('표시 이름').fill('Host QA')
  await host.getByRole('button', { name: '새 방 만들기' }).click()
  await expect(host.getByTestId('multiplayer-lobby')).toBeVisible()
  const roomCode = (await host.getByTestId('room-code').textContent())?.trim() ?? ''
  expect(roomCode).toHaveLength(6)

  await guest.goto('/arcade/stack/multi')
  await expect(guest.getByTestId('multiplayer-page')).toHaveAttribute('data-connection', 'open')
  await guest.getByLabel('표시 이름').fill('Guest QA')
  await guest.getByLabel('방 코드').fill(roomCode)
  await guest.getByRole('button', { name: '참가' }).click()
  await expect(guest.getByTestId('multiplayer-lobby')).toContainText('Host QA')
  await expect(host.getByTestId('multiplayer-lobby')).toContainText('Guest QA')

  await host.getByRole('button', { name: '준비 완료' }).click()
  await guest.getByRole('button', { name: '준비 완료' }).click()
  await expect(host.getByRole('button', { name: '동시 시작' })).toBeEnabled()
  await host.getByRole('button', { name: '동시 시작' }).click()
  await expect(host.getByTestId('multiplayer-match')).toBeVisible()
  await expect(guest.getByTestId('multiplayer-match')).toBeVisible()
  await expect(host.getByTestId('multiplayer-match')).toHaveAttribute('data-game-status', 'playing', { timeout: 5000 })
  await expect(guest.getByTestId('multiplayer-match')).toHaveAttribute('data-game-status', 'playing', { timeout: 5000 })
  await expect(host.locator('.player-standings')).toContainText('PLAY')

  const hostSeed = await host.locator('.multiplayer-scoreboard .seed-readout code').textContent()
  const guestSeed = await guest.locator('.multiplayer-scoreboard .seed-readout code').textContent()
  expect(hostSeed).toBe(guestSeed)
  await host.keyboard.press('Space')
  await expect.poll(async () => host.getByTestId('multiplayer-match').getAttribute('data-game-status')).toBe('playing')
  expect(hostRuntime.consoleErrors).toEqual([])
  expect(guestRuntime.consoleErrors).toEqual([])
  expect(hostRuntime.failedRequests).toEqual([])
  expect(guestRuntime.failedRequests).toEqual([])
  await hostContext.close()
  await guestContext.close()
})

test('host can create an item-mode room while normal mode remains available', async ({ page }) => {
  await page.goto('/arcade/stack/multi')
  await expect(page.getByTestId('multiplayer-page')).toHaveAttribute('data-connection', 'open')
  await page.getByLabel('표시 이름').fill('Item Host')
  await page.getByLabel('아이템 모드').check()
  await page.getByRole('button', { name: '새 방 만들기' }).click()
  await expect(page.getByTestId('multiplayer-lobby')).toContainText('아이템 모드')
})

test('host can add a real AI player that advances its own board', async ({ page }) => {
  await page.goto('/arcade/stack/multi')
  await expect(page.getByTestId('multiplayer-page')).toHaveAttribute('data-connection', 'open')
  await page.getByLabel('표시 이름').fill('AI Match Host')
  await page.getByRole('button', { name: '새 방 만들기' }).click()
  await page.getByLabel('AI 난이도').selectOption('ace')
  await page.getByRole('button', { name: 'Atlas AI 추가' }).click()
  const bot = page.locator('.player-standings li[data-bot="true"]')
  await expect(bot).toContainText('AI · 에이스')
  await page.getByRole('button', { name: '준비 완료' }).click()
  await page.getByRole('button', { name: '동시 시작' }).click()
  await expect(page.getByTestId('multiplayer-match')).toHaveAttribute('data-game-status', 'playing', { timeout: 5000 })
  await expect.poll(async () => Number(await bot.getAttribute('data-bot-moves')), { timeout: 6000 }).toBeGreaterThan(0)
  await expect(bot).toContainText('PLAY')
})

test('one human and three AI players run as four independent participants', async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto('/arcade/stack/multi')
  await page.getByLabel('표시 이름').fill('Squad Host')
  await page.getByRole('button', { name: '새 방 만들기' }).click()
  for (let index = 0; index < 3; index += 1) await page.getByRole('button', { name: 'Atlas AI 추가' }).click()
  await expect(page.locator('.player-standings li')).toHaveCount(4)
  await expect(page.locator('.player-standings li[data-bot="true"]')).toHaveCount(3)
  await page.getByRole('button', { name: '준비 완료' }).click()
  await page.getByRole('button', { name: '동시 시작' }).click()
  await expect(page.getByTestId('multiplayer-match')).toHaveAttribute('data-game-status', 'playing', { timeout: 6000 })
  await expect.poll(async () => page.locator('.player-standings li[data-bot="true"][data-bot-moves]').evaluateAll((items) => items.every((item) => Number(item.getAttribute('data-bot-moves')) > 0)), { timeout: 10_000 }).toBe(true)
})

test('mobile multiplayer remains usable and has no personal pause control', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/arcade/stack/multi')
  await page.getByLabel('표시 이름').fill('Mobile Host')
  await page.getByRole('button', { name: '새 방 만들기' }).click()
  await page.getByRole('button', { name: 'Atlas AI 추가' }).click()
  await page.getByRole('button', { name: '준비 완료' }).click()
  await page.getByRole('button', { name: '동시 시작' }).click()
  await expect(page.getByTestId('multiplayer-match')).toHaveAttribute('data-game-status', 'playing', { timeout: 6000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
  await expect(page.getByRole('button', { name: '대전 포기' })).toBeVisible()
  expect(await page.getByRole('button', { name: '대전 포기' }).evaluate((element) => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth })).toBe(true)
  await expect(page.getByRole('button', { name: '일시정지 또는 계속' })).toHaveCount(0)
})

test('a disconnected player resumes the same room and match within the grace window', async ({ browser }) => {
  test.setTimeout(45_000)
  const hostContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  const host = await hostContext.newPage()
  let guest = await guestContext.newPage()

  await host.goto('/arcade/stack/multi')
  await host.getByLabel('표시 이름').fill('Reconnect Host')
  await host.getByRole('button', { name: '새 방 만들기' }).click()
  const roomCode = (await host.getByTestId('room-code').textContent())?.trim() ?? ''

  await guest.goto('/arcade/stack/multi')
  await guest.getByLabel('표시 이름').fill('Reconnect Guest')
  await guest.getByLabel('방 코드').fill(roomCode)
  await guest.getByRole('button', { name: '참가' }).click()
  await host.getByRole('button', { name: '준비 완료' }).click()
  await guest.getByRole('button', { name: '준비 완료' }).click()
  await host.getByRole('button', { name: '동시 시작' }).click()
  await expect(guest.getByTestId('multiplayer-match')).toHaveAttribute('data-game-status', 'playing')
  const seedBefore = await guest.locator('.multiplayer-scoreboard .seed-readout code').textContent()
  await guest.keyboard.press('Space')
  await expect.poll(async () => Number(await guest.getByTestId('multiplayer-match').getAttribute('data-revision'))).toBeGreaterThan(2)
  const stateBefore = await guest.getByTestId('multiplayer-match').evaluate((element) => ({
    board: element.getAttribute('data-board-signature'),
    score: element.getAttribute('data-score'),
    active: element.getAttribute('data-active-piece'),
    next: element.getAttribute('data-next-piece'),
    revision: element.getAttribute('data-revision'),
  }))

  const resumeState = await guest.evaluate(() => sessionStorage.getItem('arcade:gravity-stack:multiplayer-session:v1'))
  await guest.close()
  await expect(host.locator('.player-standings')).toContainText('OFFLINE', { timeout: 10_000 })
  guest = await guestContext.newPage()
  await guest.addInitScript((value) => {
    if (value) sessionStorage.setItem('arcade:gravity-stack:multiplayer-session:v1', value)
  }, resumeState)
  await guest.goto('/arcade/stack/multi')

  await expect(guest.getByTestId('multiplayer-page')).toHaveAttribute('data-connection', 'open', { timeout: 15_000 })
  await expect(host.locator('.player-standings')).not.toContainText('OFFLINE', { timeout: 15_000 })
  await expect(guest.getByTestId('multiplayer-match')).toBeVisible()
  expect(await guest.locator('.multiplayer-scoreboard .seed-readout code').textContent()).toBe(seedBefore)
  await expect.poll(async () => guest.getByTestId('multiplayer-match').getAttribute('data-board-signature')).toBe(stateBefore.board)
  expect(await guest.getByTestId('multiplayer-match').getAttribute('data-score')).toBe(stateBefore.score)
  expect(await guest.getByTestId('multiplayer-match').getAttribute('data-active-piece')).toBe(stateBefore.active)
  expect(await guest.getByTestId('multiplayer-match').getAttribute('data-next-piece')).toBe(stateBefore.next)
  expect(Number(await guest.getByTestId('multiplayer-match').getAttribute('data-revision'))).toBeGreaterThanOrEqual(Number(stateBefore.revision))
  await hostContext.close()
  await guestContext.close()
})

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 1366, height: 768 },
]) {
  test(`${viewport.width}x${viewport.height} keeps the game inside the viewport`, async ({ page }) => {
    const runtime = observeRuntime(page)
    await page.setViewportSize(viewport)
    await page.goto('/arcade/stack')
    await page.getByRole('button', { name: '게임 시작' }).click()
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controls: Array.from(document.querySelectorAll<HTMLElement>('.touch-controls button')).every((button) => {
        const rect = button.getBoundingClientRect()
        return rect.left >= 0
          && rect.right <= window.innerWidth
          && rect.top >= 0
          && rect.bottom <= window.innerHeight
          && rect.width >= 44
          && rect.height >= 44
      }),
      board: (() => {
        const rect = document.querySelector<HTMLElement>('.board-frame')?.getBoundingClientRect()
        return Boolean(rect && rect.left >= 0 && rect.right <= window.innerWidth && rect.width > 0 && rect.height > 0)
      })(),
    }))
    expect(metrics.overflow).toBe(0)
    expect(metrics.controls).toBe(true)
    expect(metrics.board).toBe(true)
    await page.getByRole('button', { name: '일시정지 또는 계속' }).click()
    await expect(page.getByRole('dialog', { name: '일시정지' })).toBeVisible()
    expect(runtime.consoleErrors).toEqual([])
    expect(runtime.failedRequests).toEqual([])
  })
}

test('websocket rejects foreign origins and throttles room creation abuse', async () => {
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket('ws://127.0.0.1:4188/ws', { origin: 'https://attacker.invalid' })
    socket.on('open', () => reject(new Error('foreign origin unexpectedly connected')))
    socket.on('error', () => resolve())
  })

  const socket = new WebSocket('ws://127.0.0.1:4188/ws', { origin: 'http://127.0.0.1:4173' })
  const messages: Array<Record<string, unknown>> = []
  socket.on('message', (raw) => messages.push(JSON.parse(String(raw)) as Record<string, unknown>))
  await new Promise<void>((resolve, reject) => { socket.on('open', resolve); socket.on('error', reject) })
  const waitFor = async (predicate: (message: Record<string, unknown>) => boolean) => {
    await expect.poll(() => messages.find(predicate), { timeout: 3000 }).toBeTruthy()
    return messages.splice(messages.findIndex(predicate), 1)[0]
  }
  await waitFor((message) => message.type === 'connected')
  let limited = false
  for (let index = 0; index < 25 && !limited; index += 1) {
    socket.send(JSON.stringify({ type: 'create', protocol: 2, name: `Flood ${index}` }))
    const response = await waitFor((message) => message.type === 'joined' || message.type === 'error')
    if (response.type === 'error') limited = response.code === 'ROOM_CREATION_LIMITED'
    else { socket.send(JSON.stringify({ type: 'leave', protocol: 2 })); await new Promise((resolve) => setTimeout(resolve, 10)) }
  }
  expect(limited).toBe(true)
  socket.close()
})
