import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../tests/e2e', timeout: 90000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4175', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --port 4175', url: 'http://127.0.0.1:4175', reuseExistingServer: true, timeout: 60000 },
});
