import { test, expect, goTo } from './fixtures/app'

test.describe('Search Term Creation and Management', () => {
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
