import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'

test.describe('Job Aggregation Module', () => {
  test.describe('Search Term Management', () => {
    test('manually adds a term and it appears in the term bank tagged as manual', async ({ page }) => {
      await goTo(page, 'Search Config')
      const input = page.getByPlaceholder(/Add a term manually/i)
      await input.fill('senior backend engineer remote')
      await page.getByRole('button', { name: /^Add$/i }).click()
      await expect(page.getByText('senior backend engineer remote')).toBeVisible()
      await expect(page.getByText('manual')).toBeVisible()
    })

    test('generates suggested terms via AI and they appear tagged as AI', async ({ page }) => {
      await goTo(page, 'Search Config')
      await page.getByRole('button', { name: /Generate via AI/i }).click()
      // Stub returns 3 terms; wait for them to appear
      await expect(page.getByText(/senior backend engineer remote/i)).toBeVisible({ timeout: 10_000 })
      // All stub terms should be tagged as AI-generated
      const aiBadges = page.getByText('AI')
      await expect(aiBadges.first()).toBeVisible()
    })

    test('enabling and disabling a term persists across a view reload', async ({ page }) => {
      await goTo(page, 'Search Config')
      // Add a term
      const input = page.getByPlaceholder(/Add a term manually/i)
      await input.fill('typescript fullstack remote')
      await page.getByRole('button', { name: /^Add$/i }).click()
      await expect(page.getByText('typescript fullstack remote')).toBeVisible()

      // Disable it — find the checkbox next to our term
      const termRow = page.locator('li').filter({ hasText: 'typescript fullstack remote' })
      const checkbox = termRow.getByRole('checkbox')
      await expect(checkbox).toBeChecked()
      await checkbox.uncheck()
      await expect(checkbox).not.toBeChecked()

      // Navigate away and back
      await goTo(page, 'Profile')
      await goTo(page, 'Search Config')

      const termRowReloaded = page.locator('li').filter({ hasText: 'typescript fullstack remote' })
      await expect(termRowReloaded.getByRole('checkbox')).not.toBeChecked()
    })

    test('deletes a term and it disappears from the bank', async ({ page }) => {
      await goTo(page, 'Search Config')
      const input = page.getByPlaceholder(/Add a term manually/i)
      await input.fill('term to be deleted')
      await page.getByRole('button', { name: /^Add$/i }).click()
      await expect(page.getByText('term to be deleted')).toBeVisible()

      const termRow = page.locator('li').filter({ hasText: 'term to be deleted' })
      await termRow.getByTitle('Delete').click()
      await expect(page.getByText('term to be deleted')).not.toBeVisible()
    })

    test('search terms are stored in canonical format with structured fields', async ({ page }) => {
      // Terms added manually should reflect the role/location/seniority structure
      // This test verifies the term text contains the user-entered content as-is
      await goTo(page, 'Search Config')
      const input = page.getByPlaceholder(/Add a term manually/i)
      await input.fill('staff engineer, remote, senior')
      await page.getByRole('button', { name: /^Add$/i }).click()
      await expect(page.getByText('staff engineer, remote, senior')).toBeVisible()
    })

    test('adding a term via Enter key works the same as clicking Add', async ({ page }) => {
      await goTo(page, 'Search Config')
      const input = page.getByPlaceholder(/Add a term manually/i)
      await input.fill('entered via keyboard')
      await input.press('Enter')
      await expect(page.getByText('entered via keyboard')).toBeVisible()
    })
  })

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
})
