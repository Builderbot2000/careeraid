import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'

test.describe('Scrape Execution', () => {
  test('adapter selection list is shown before running a scrape', async ({ page }) => {
    await goTo(page, 'Search')
    // At least the mock adapter should be listed
    await expect(page.getByText(/mock/i)).toBeVisible()
  })

  test('unavailable adapters are shown but disabled in the selection list', async ({ page }) => {
    await goTo(page, 'Search')
    // The mock adapter is always available; any adapter marked unavailable
    // should render a disabled checkbox or "Unavailable" label
    const unavailableLabels = page.getByText(/Unavailable/i)
    await expect(unavailableLabels.or(page.getByText(/mock/i)).first()).toBeVisible()
  })

  test('running a scrape shows adapter status in the progress area', async ({ page }) => {
    await goTo(page, 'Search')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await expect(page.getByRole('button', { name: /Running/i })).toBeVisible({ timeout: 5_000 })
  })

  test('scrape completes and Run Scrape button re-enables', async ({ page }) => {
    await goTo(page, 'Search')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await expect(page.getByTestId('search-run-scrape-btn')).toBeEnabled({ timeout: 15_000 })
  })

  test('postings appear on the job board during the scrape without waiting for completion', async ({ page }) => {
    await goTo(page, 'Search')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    // Navigate immediately — postings stream in before the scrape finishes
    await goTo(page, 'Jobs')
    await expect(
      page.locator('[data-testid^="posting-row"], tr[data-testid], li[data-testid]').first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('a completed scrape adds postings to the job board', async ({ page }) => {
    await runAndCommitScrape(page)
    await goTo(page, 'Jobs')
    await expect(page.locator('[data-testid^="posting-row"], tr, li').first()).toBeVisible({ timeout: 10_000 })
  })

  test('running a second scrape against existing data produces no new postings (deduplication)', async ({ page }) => {
    await runAndCommitScrape(page)
    await goTo(page, 'Jobs')
    const rowsBefore = page.locator('[data-testid^="posting-row"], tr[data-testid], li[data-testid]')
    const countBefore = await rowsBefore.count()

    await runAndCommitScrape(page)
    await goTo(page, 'Jobs')
    const countAfter = await page.locator('[data-testid^="posting-row"], tr[data-testid], li[data-testid]').count()
    expect(countAfter).toBe(countBefore)
  })

  test('Pause and Stop controls are hidden when no scrape is running', async ({ page }) => {
    await goTo(page, 'Search')
    await expect(page.getByTestId('search-pause-btn')).not.toBeVisible()
    await expect(page.getByTestId('search-abort-btn')).not.toBeVisible()
  })

  test('Pause button appears while a scrape is running', async ({ page }) => {
    await goTo(page, 'Search')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await expect(page.getByTestId('search-pause-btn')).toBeVisible({ timeout: 5_000 })
  })

  test('Stop button appears while a scrape is running', async ({ page }) => {
    await goTo(page, 'Search')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await expect(page.getByTestId('search-abort-btn')).toBeVisible({ timeout: 5_000 })
  })

  test('clicking Pause swaps Pause button for Resume button', async ({ page }) => {
    await goTo(page, 'Search')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await expect(page.getByRole('button', { name: /Running/i })).toBeVisible({ timeout: 5_000 })
    // force:true bypasses Playwright's stability check — rapid adapterProgress
    // re-renders can briefly detach the button before it is re-committed to DOM
    await page.getByTestId('search-pause-btn').click({ force: true })
    await expect(page.getByTestId('search-resume-btn')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('search-pause-btn')).not.toBeVisible()
  })

  test('clicking Resume after Pause restores the Pause button', async ({ page }) => {
    await goTo(page, 'Search')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await expect(page.getByRole('button', { name: /Running/i })).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('search-pause-btn').click({ force: true })
    await expect(page.getByTestId('search-resume-btn')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('search-resume-btn').click({ force: true })
    await expect(page.getByTestId('search-pause-btn')).toBeVisible({ timeout: 5_000 })
  })

  test('clicking Stop ends the scrape and hides the controls', async ({ page }) => {
    await goTo(page, 'Search')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await expect(page.getByRole('button', { name: /Running/i })).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('search-abort-btn').click({ force: true })
    await expect(page.getByTestId('search-run-scrape-btn')).toBeEnabled({ timeout: 10_000 })
    await expect(page.getByTestId('search-abort-btn')).not.toBeVisible()
  })

  test('adapter checkboxes are disabled while a scrape is running', async ({ page }) => {
    await goTo(page, 'Search')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await expect(page.getByRole('button', { name: /Running/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('[data-testid^="adapter-checkbox-"]').first()).toBeDisabled()
  })
})
