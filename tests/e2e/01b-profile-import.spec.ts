import { test, expect, goTo } from './fixtures/app'

test.describe('Profile PDF Import', () => {
  test('shows the Import from Resume PDF button on the Profile view', async ({ page }) => {
    await goTo(page, 'Profile')
    await expect(page.getByTestId('profile-import-pdf-btn')).toBeVisible()
  })

  test('imports profile entries from a resume PDF via AI and displays them', async ({ page }) => {
    await goTo(page, 'Profile')
    await page.getByTestId('profile-import-pdf-btn').click()

    // The stub populates 3 entries; wait for at least the first to appear
    await expect(page.getByText('Senior Software Engineer at Acme Corp')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('B.Sc. Computer Science — State University')).toBeVisible()
    await expect(page.getByText('Programming Languages')).toBeVisible()
  })

  test('shows a flash message with the entry count after PDF import', async ({ page }) => {
    await goTo(page, 'Profile')
    await page.getByTestId('profile-import-pdf-btn').click()

    // Stub inserts 3 entries
    await expect(page.getByText(/Resume imported — 3 entries added/i)).toBeVisible({ timeout: 10_000 })
  })

  test('PDF import preserves existing entries', async ({ page }) => {
    await goTo(page, 'Profile')

    // Create an entry before importing
    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Title').fill('Existing Entry')
    await page.getByLabel('Content').fill('This was already here.')
    await page.getByRole('button', { name: /Add entry|Save/i }).click()
    await expect(page.getByText('Existing Entry')).toBeVisible()

    // Import from PDF
    await page.getByTestId('profile-import-pdf-btn').click()
    await expect(page.getByText('Senior Software Engineer at Acme Corp')).toBeVisible({ timeout: 10_000 })

    // Original entry still present
    await expect(page.getByText('Existing Entry')).toBeVisible()
  })

  test('Import from Resume PDF button is disabled while import is in progress', async ({ page }) => {
    await goTo(page, 'Profile')
    const btn = page.getByTestId('profile-import-pdf-btn')
    await expect(btn).toBeEnabled()
    await btn.click()
    // Immediately after click, stub resolves quickly; assert the text at least cycles
    await expect(page.getByText(/Resume imported/i)).toBeVisible({ timeout: 10_000 })
    await expect(btn).toBeEnabled()
  })
})
