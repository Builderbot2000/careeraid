import { defineConfig } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: path.join(__dirname, 'e2e'),
  timeout: 30_000,
  retries: 0,
  workers: 1, // Electron tests must run serially
  maxFailures: 1,
  use: {
    // Electron-specific launch options are handled in the app fixture
  },
  // Prevent Playwright from opening the HTML report automatically
  reporter: [['list'], ['html', { open: 'never' }]],
})
