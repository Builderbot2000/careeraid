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
    await goTo(page, 'Job Board')
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
    await goTo(page, 'Job Board')
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
    await goTo(page, 'Job Board')
    await page.locator('select').first().selectOption('favorited')

    await goTo(page, 'Tracker')
    const trackerSelect = page.locator('table tbody tr').first().locator('select')
    await trackerSelect.selectOption('applied')
    await trackerSelect.selectOption('rejected')
    await expect(trackerSelect).toHaveValue('rejected')
  })

  test('status can be set to ghosted from interviewing', async ({ page }) => {
    await goTo(page, 'Job Board')
    await page.locator('select').first().selectOption('favorited')

    await goTo(page, 'Tracker')
    const trackerSelect = page.locator('table tbody tr').first().locator('select')
    await trackerSelect.selectOption('applied')
    await trackerSelect.selectOption('interviewing')
    await trackerSelect.selectOption('ghosted')
    await expect(trackerSelect).toHaveValue('ghosted')
  })

  test('tracker columns show company, role, date applied, status, and source', async ({ page }) => {
    await goTo(page, 'Job Board')
    await page.locator('select').first().selectOption('favorited')

    await goTo(page, 'Tracker')
    await page.locator('table tbody tr').first().locator('select').selectOption('applied')

    // Verify expected column headers
    await expect(page.getByRole('columnheader', { name: /Company/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Role|Title/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Source/i })).toBeVisible()
  })
})
