import { defineConfig } from '@playwright/test'
import path from 'path'

export default defineConfig({
  timeout: 30_000,
  retries: 0,
  maxFailures: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      name: 'e2e',
      testDir: path.join(__dirname, 'e2e'),
      workers: 1, // Electron tests must run serially
      use: {
        // Electron-specific launch options are handled in the app fixture
      },
    },
    {
      name: 'integration',
      testDir: path.join(__dirname, 'integration'),
      workers: 1,
      use: {
        headless: true,
      },
    },
  ],
})
