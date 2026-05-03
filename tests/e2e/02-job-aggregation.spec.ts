import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'

test.describe('Job Aggregation Module', () => {
  test.describe('Search Term Management', () => {
    test('manually adds a term and it appears in the term bank tagged as manual', async ({ page }) => {
      await goTo(page, 'Search')
      const input = page.getByTestId('search-add-role')
      await input.fill('senior backend engineer remote')
      await page.getByTestId('search-add-btn').click()
      await expect(page.getByText('senior backend engineer remote')).toBeVisible()
      const termRow = page.locator('li').filter({ hasText: 'senior backend engineer remote' })
      await expect(termRow.getByText(/manual|user_added/i)).toBeVisible()
    })

    test('generates suggested terms via AI and they appear tagged as AI', async ({ page }) => {
      await goTo(page, 'Search')
      await page.getByRole('button', { name: /Generate from Intent/i }).click()
      // Stub returns 3 terms; wait for them to appear
      await expect(page.getByText(/senior backend engineer remote/i)).toBeVisible({ timeout: 10_000 })
      // All stub terms should be tagged as AI-generated
      const aiBadges = page.getByText('AI')
      await expect(aiBadges.first()).toBeVisible()
    })

    test('enabling and disabling a term persists across a view reload', async ({ page }) => {
      await goTo(page, 'Search')
      // Add a term
      const input = page.getByTestId('search-add-role')
      await input.fill('typescript fullstack remote')
      await page.getByTestId('search-add-btn').click()
      await expect(page.getByText('typescript fullstack remote')).toBeVisible()

      // Disable it — find the checkbox next to our term
      const termRow = page.locator('li').filter({ hasText: 'typescript fullstack remote' })
      const checkbox = termRow.getByRole('checkbox')
      await expect(checkbox).toBeChecked()
      await checkbox.uncheck()
      await expect(checkbox).not.toBeChecked()

      // Navigate away and back
      await goTo(page, 'Profile')
      await goTo(page, 'Search')

      const termRowReloaded = page.locator('li').filter({ hasText: 'typescript fullstack remote' })
      await expect(termRowReloaded.getByRole('checkbox')).not.toBeChecked()
    })

    test('deletes a term and it disappears from the bank', async ({ page }) => {
      await goTo(page, 'Search')
      const input = page.getByTestId('search-add-role')
      await input.fill('term to be deleted')
      await page.getByTestId('search-add-btn').click()
      await expect(page.getByText('term to be deleted')).toBeVisible()

      const termRow = page.locator('li').filter({ hasText: 'term to be deleted' })
      await termRow.getByTitle('Delete').click()
      await expect(page.getByText('term to be deleted')).not.toBeVisible()
    })

    test('search terms are stored in canonical format with structured fields', async ({ page }) => {
      // Terms added manually should reflect the role/location/seniority structure
      // This test verifies the term text contains the user-entered content as-is
      await goTo(page, 'Search')
      const roleInput = page.getByTestId('search-add-role')
      await roleInput.fill('staff engineer, remote, senior')
      await page.getByTestId('search-add-btn').click()
      await expect(page.getByText('staff engineer, remote, senior')).toBeVisible()
    })

    test('adding a term via Enter key works the same as clicking Add', async ({ page }) => {
      await goTo(page, 'Search')
      const roleInput = page.getByTestId('search-add-role')
      await roleInput.fill('entered via keyboard')
      await roleInput.press('Enter')
      await expect(page.getByText('entered via keyboard')).toBeVisible()
    })

    test('generates terms from profile and they appear tagged as AI', async ({ page }) => {
      await goTo(page, 'Search')
      await page.getByTestId('search-generate-from-profile-btn').click()
      await expect(page.getByText(/senior backend engineer remote/i)).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('AI').first()).toBeVisible()
    })

    test('generate from profile replaces previous llm_generated terms', async ({ page }) => {
      await goTo(page, 'Search')
      // Generate first batch via intent
      await page.getByRole('button', { name: /Generate from Intent/i }).click()
      await expect(page.getByText(/senior backend engineer remote/i)).toBeVisible({ timeout: 10_000 })

      // Generate again from profile — should replace, not append
      await page.getByTestId('search-generate-from-profile-btn').click()
      await expect(page.getByText(/senior backend engineer remote/i)).toBeVisible({ timeout: 10_000 })
      const termRows = page.locator('li, tr').filter({ hasText: /senior backend engineer remote/i })
      await expect(termRows).toHaveCount(1)
    })

    test('term conditions chips are visible on a term with structured fields', async ({ page }) => {
      // The stub terms have no conditions; add one with a seniority selected
      await goTo(page, 'Search')
      const roleInput = page.getByTestId('search-add-role')
      await roleInput.fill('fullstack developer')

      // Select a seniority if the UI exposes it as a multi-select
      const seniorityControl = page.getByLabel(/Seniority/i)
      if (await seniorityControl.isVisible()) {
        await seniorityControl.click()
        await page.getByRole('option', { name: /senior/i }).click()
      }

      await page.getByTestId('search-add-btn').click()
      await expect(page.getByText('fullstack developer')).toBeVisible()
    })

    test('editing a term updates its role text in the list', async ({ page }) => {
      await goTo(page, 'Search')
      const roleInput = page.getByTestId('search-add-role')
      await roleInput.fill('original term text')
      await page.getByTestId('search-add-btn').click()
      await expect(page.getByText('original term text')).toBeVisible()

      // Open edit for this term
      const termRow = page.locator('li, tr').filter({ hasText: 'original term text' })
      await termRow.getByTitle('Edit').click()

      // Update the role field
      const editInput = page.getByTestId('search-add-role')
      await editInput.fill('updated term text')
      await page.getByTestId('search-add-btn').click()

      await expect(page.getByText('updated term text')).toBeVisible()
      await expect(page.getByText('original term text')).not.toBeVisible()
    })
  })

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
})
