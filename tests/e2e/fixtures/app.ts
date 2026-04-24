/**
 * Shared Playwright fixture that launches the Electron app against a fresh
 * temporary userData directory for each test file, and tears it down after.
 *
 * Every test that imports from this file gets:
 *   - `app`  — the ElectronApplication instance
 *   - `page` — the main BrowserWindow page
 *
 * The CAREERAID_TEST=1 environment variable activates Claude stubs in main.ts
 * so no real network calls are made.
 */

import { test as base, expect } from '@playwright/test'
import { _electron as electron, ElectronApplication, Page } from 'playwright'
import path from 'path'
import fs from 'fs'
import os from 'os'

export { expect }

interface AppFixtures {
  app: ElectronApplication
  page: Page
}

export const test = base.extend<AppFixtures>({
  // eslint-disable-next-line no-empty-pattern
  app: async ({}, use) => {
    const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'careeraid-test-'))

    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../out/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CAREERAID_TEST: '1',
        ELECTRON_USER_DATA: tmpUserData,
      },
    })

    await use(electronApp)

    await electronApp.close()
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  },

  page: async ({ app }, use) => {
    const page = await app.firstWindow()
    // Wait for the app shell to be ready (nav buttons visible)
    await page.waitForSelector('nav', { timeout: 10_000 })
    await use(page)
  },
})

// ─── Navigation helpers ───────────────────────────────────────────────────────

/** Click a top-level nav item by its visible label. */
export async function navigate(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label }).click()
}

/** Navigate to a view and wait for a heading or landmark to confirm arrival. */
export async function goTo(page: Page, label: string): Promise<void> {
  await navigate(page, label)
  // Brief settle time for React re-render
  await page.waitForTimeout(300)
}

// ─── Scrape helpers ───────────────────────────────────────────────────────────

/**
 * Run a full mock scrape and commit the results.
 * After this call, 15 postings are in the database.
 */
export async function runAndCommitScrape(page: Page): Promise<void> {
  await goTo(page, 'Search Config')
  await page.getByRole('button', { name: /Run Scrape/i }).click()
  // Wait for the commit summary to appear
  await page.waitForSelector('text=Net new to commit', { timeout: 15_000 })
  await page.getByRole('button', { name: /Commit/i }).click()
  // Wait for idle state
  await page.waitForSelector('text=Run Scrape', { timeout: 10_000 })
}
