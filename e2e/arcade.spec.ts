import { expect, test, type Page } from '@playwright/test'

function observeRuntime(page: Page) {
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => failedRequests.push(request.url()))
  return { consoleErrors, failedRequests }
}

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
