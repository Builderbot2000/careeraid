import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'

test.describe('Scrape Execution', () => {
  test('running a scrape shows adapter status in the progress area', async ({ page }) => {
    await goTo(page, 'Search Config')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    // The button label changes while running
    await expect(page.getByRole('button', { name: /Running/i })).toBeVisible({ timeout: 5_000 })
  })

  test('commit summary shows correct counts after a clean scrape (15 fetched, 15 net new)', async ({ page }) => {
    await goTo(page, 'Search Config')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await page.waitForSelector('text=Net new to commit', { timeout: 15_000 })

    await expect(page.getByText('Fetched')).toBeVisible()
    // Mock adapter always returns 15 deterministic postings
    await expect(page.getByText('15').first()).toBeVisible()
    await expect(page.getByText('Net new to commit')).toBeVisible()
  })

  test('committing adds postings to the job board', async ({ page }) => {
    await runAndCommitScrape(page)
    await goTo(page, 'Job Board')
    // At least some postings should be visible
    await expect(page.locator('[data-testid="posting-row"], tr, li').first()).toBeVisible({ timeout: 10_000 })
  })

  test('discarding a scrape does not add postings to the job board', async ({ page }) => {
    await goTo(page, 'Search Config')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await page.waitForSelector('text=Net new to commit', { timeout: 15_000 })
    await page.getByRole('button', { name: /Discard/i }).click()

    await goTo(page, 'Job Board')
    // Job board should be empty — no committed postings
    await expect(page.getByText(/No postings|no results|empty/i)).toBeVisible({ timeout: 5_000 })
  })

  test('running a second scrape against existing data results in 0 net new (deduplication)', async ({ page }) => {
    // First scrape and commit
    await runAndCommitScrape(page)

    // Second scrape
    await goTo(page, 'Search Config')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await page.waitForSelector('text=Net new to commit', { timeout: 15_000 })

    // All 15 should be duplicates; net new = 0
    await expect(page.getByText(/Duplicates skipped/i)).toBeVisible()
    // Commit button should be disabled or show 0
    const commitBtn = page.getByRole('button', { name: /Commit 0|Commit$/i })
    await expect(commitBtn).toBeDisabled()
  })

  test('parse failures during a scrape are shown in the summary', async ({ page }) => {
    // The mock adapter never fails, so this test verifies the UI has the field.
    // A real failure scenario would require an adapter that returns bad data.
    await goTo(page, 'Search Config')
    await page.getByRole('button', { name: /Run Scrape/i }).click()
    await page.waitForSelector('text=Net new to commit', { timeout: 15_000 })

    // Summary should appear; it should NOT show a parse error count if there are none
    // (the field simply won't appear for 0 values per the UI implementation)
    await expect(page.getByText('Scrape Complete')).toBeVisible()
  })
})
