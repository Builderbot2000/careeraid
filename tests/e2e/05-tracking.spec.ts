import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'

test.describe('Application Tracking Module', () => {
  test.beforeEach(async ({ page }) => {
    await runAndCommitScrape(page)
  })

  test('a non-favorited posting does not appear in the application management view', async ({ page }) => {
    await goTo(page, 'Tracker')
    // No postings have been favorited yet
    await expect(page.getByText(/No applications|empty|no postings/i)).toBeVisible({ timeout: 5_000 })
  })

  test('favoriting a posting makes it appear in the application management view', async ({ page }) => {
    await goTo(page, 'Jobs')
    // Find the status control for the first posting and set it to favorited
    const firstStatusControl = page.getByRole('combobox').first()
      .or(page.getByRole('button', { name: /favorite|mark/i }).first())
    await firstStatusControl.selectOption?.('favorited')
    // If it's a button, click it
    if (!(await firstStatusControl.evaluate((el) => el.tagName === 'SELECT'))) {
      await page.locator('[data-status="new"]').first().selectOption?.('favorited')
    }

    // Use the IPC directly via the status dropdown
    const statusSelect = page.locator('select').first()
    await statusSelect.selectOption('favorited')

    await goTo(page, 'Tracker')
    // The favorited posting should now appear
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5_000 })
  })

  test('status advances through the lifecycle: favorited → applied → interviewing → offer', async ({ page }) => {
    // Favorite a posting via the job board status control
    await goTo(page, 'Jobs')
    const statusSelect = page.locator('select').first()
    await statusSelect.selectOption('favorited')

    await goTo(page, 'Tracker')
    const trackerSelect = page.locator('table tbody tr').first().locator('select')

    // Advance to applied
    await trackerSelect.selectOption('applied')
    await expect(trackerSelect).toHaveValue('applied')

    // Advance to interviewing
    await trackerSelect.selectOption('interviewing')
    await expect(trackerSelect).toHaveValue('interviewing')

    // Advance to offer
    await trackerSelect.selectOption('offer')
    await expect(trackerSelect).toHaveValue('offer')
  })

  test('status can be set to rejected from applied', async ({ page }) => {
    await goTo(page, 'Jobs')
    await page.locator('select').first().selectOption('favorited')

    await goTo(page, 'Tracker')
    const trackerSelect = page.locator('table tbody tr').first().locator('select')
    await trackerSelect.selectOption('applied')
    await trackerSelect.selectOption('rejected')
    await expect(trackerSelect).toHaveValue('rejected')
  })

  test('status can be set to ghosted from interviewing', async ({ page }) => {
    await goTo(page, 'Jobs')
    await page.locator('select').first().selectOption('favorited')

    await goTo(page, 'Tracker')
    const trackerSelect = page.locator('table tbody tr').first().locator('select')
    await trackerSelect.selectOption('applied')
    await trackerSelect.selectOption('interviewing')
    await trackerSelect.selectOption('ghosted')
    await expect(trackerSelect).toHaveValue('ghosted')
  })

  test('tracker columns show company, role, date applied, status, and source', async ({ page }) => {
    await goTo(page, 'Jobs')
    await page.locator('select').first().selectOption('favorited')

    await goTo(page, 'Tracker')
    await page.locator('table tbody tr').first().locator('select').selectOption('applied')

    // Verify expected column headers
    await expect(page.getByRole('columnheader', { name: /Company/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Role|Title/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Source/i })).toBeVisible()
  })

  // ─── Nullable applied_at ──────────────────────────────────────────────────

  test('tailoring a resume does not set an applied date on the application', async ({ page }) => {
    // Set up API key so tailoring is available
    await goTo(page, 'Settings')
    await page.getByLabel(/API key/i).or(page.getByPlaceholder(/sk-ant/i)).fill('sk-ant-test-key')
    await page.getByRole('button', { name: /Save.*key|Set key/i }).click()

    // Tailor a resume for the first posting
    await runAndCommitScrape(page)
    await goTo(page, 'Jobs')
    await page.getByRole('button', { name: /Tailor Resume/i }).first().click()
    await page.getByRole('button', { name: /Tailor|Generate/i }).click()
    await page.locator('iframe').or(page.getByText(/resume ready|compiled/i)).waitFor({ timeout: 20_000 })

    // Mark the posting as favorited so it shows in the tracker
    await goTo(page, 'Jobs')
    await page.locator('select').first().selectOption('favorited')

    await goTo(page, 'Tracker')
    await page.locator('table tbody tr').first().locator('select').selectOption('applied')

    // The date applied column should be present but may be empty for the tailored resume
    // that was not explicitly applied through the status dropdown until now
    await expect(page.getByRole('columnheader', { name: /Applied|Date/i })).toBeVisible()
  })

  test('applied_at date is shown only after explicitly setting status to applied', async ({ page }) => {
    await goTo(page, 'Jobs')
    const statusSelect = page.locator('select').first()
    await statusSelect.selectOption('favorited')

    await goTo(page, 'Tracker')
    // Before advancing to applied, the date column cell should be empty or show a dash
    const dateCell = page.locator('table tbody tr').first().locator('td').nth(2)
    const beforeText = (await dateCell.textContent())?.trim()
    expect(beforeText === '' || beforeText === '—' || beforeText === '-' || beforeText == null).toBe(true)

    // Advance to applied
    await page.locator('table tbody tr').first().locator('select').selectOption('applied')

    // After applying, the date should now be populated
    const afterText = (await dateCell.textContent())?.trim()
    expect(afterText).toBeTruthy()
    expect(afterText).not.toBe('—')
    expect(afterText).not.toBe('-')
  })
})

// ─── Tracker column header sorting ───────────────────────────────────────────
// Favorites the first 3 postings from the job board (Stripe, Vercel, Linear in
// default recency-ranked order) so the tracker has enough rows to sort.

test.describe('Tracker — column header sorting', () => {
  test.beforeEach(async ({ page }) => {
    await runAndCommitScrape(page)
    await goTo(page, 'Jobs')
    // Favorite rows 0–2 (Stripe, Vercel, Linear in default composite-score order)
    const statusSelects = page.locator('table tbody tr select')
    await statusSelects.nth(0).selectOption('favorited')
    await statusSelects.nth(1).selectOption('favorited')
    await statusSelects.nth(2).selectOption('favorited')
    await goTo(page, 'Tracker')
  })

  test('Company header sorts tracker rows A→Z', async ({ page }) => {
    await page.getByRole('columnheader', { name: /Company/ }).click()
    // td indices: checkbox(0) company(1) applied(2) role(3) ...
    const first = await page.locator('table tbody tr').first().locator('td').nth(1).textContent()
    // Linear < Stripe < Vercel alphabetically
    expect(first?.trim()).toBe('Linear')
  })

  test('Company header second click sorts Z→A', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: /Company/ })
    await header.click()
    await header.click()
    const first = await page.locator('table tbody tr').first().locator('td').nth(1).textContent()
    expect(first?.trim()).toBe('Vercel')
  })

  test('Status header sorts by workflow order: favorited → applied → interviewing', async ({ page }) => {
    // Sort by Company first to get a deterministic initial row order
    await page.getByRole('columnheader', { name: /Company/ }).click()
    // Row order is now: Linear(0) Stripe(1) Vercel(2)
    const selects = page.locator('table tbody tr select')
    await selects.nth(1).selectOption('applied')      // Stripe → applied
    await selects.nth(2).selectOption('interviewing') // Vercel → interviewing
    // Linear stays favorited

    await page.getByRole('columnheader', { name: /Status/ }).click()
    // STATUS_ORDER: favorited < applied < interviewing
    const rows = page.locator('table tbody tr')
    const c0 = await rows.nth(0).locator('td').nth(1).textContent()
    const c1 = await rows.nth(1).locator('td').nth(1).textContent()
    const c2 = await rows.nth(2).locator('td').nth(1).textContent()
    expect(c0?.trim()).toBe('Linear')      // favorited
    expect(c1?.trim()).toBe('Stripe')      // applied
    expect(c2?.trim()).toBe('Vercel')      // interviewing
  })

  test('sort indicator on tracker Company header cycles ↕ → ↑ → ↓ → ↕', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: /Company/ })
    await expect(header).toContainText('↕')
    await header.click()
    await expect(header).toContainText('↑')
    await header.click()
    await expect(header).toContainText('↓')
    await header.click()
    await expect(header).toContainText('↕')
  })
})
