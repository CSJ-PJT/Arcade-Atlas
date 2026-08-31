import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run server',
      url: 'http://127.0.0.1:4188/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...process.env, ARCADE_HEARTBEAT_MS: '1000' },
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173/arcade/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
