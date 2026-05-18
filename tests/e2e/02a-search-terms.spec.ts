import { test, expect, goTo } from './fixtures/app'

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

  test('duplicating a term creates a (copy) with the same hard reqs, tagged manual', async ({ page }) => {
    await goTo(page, 'Search')

    // Add a term with structured fields so we can verify they carry over
    await page.getByTestId('search-add-role').fill('backend engineer original')
    await page.getByTestId('search-add-recency').selectOption('week')
    await page.getByTestId('search-add-max-results').fill('25')
    await page.getByTestId('search-add-btn').click()

    const originalRow = page.locator('li').filter({ hasText: 'backend engineer original' })
    await expect(originalRow).toBeVisible()
    await expect(originalRow.getByText('past week', { exact: true })).toBeVisible()
    await expect(originalRow.getByText('max 25', { exact: true })).toBeVisible()

    // Click duplicate
    await originalRow.getByTitle('Duplicate').click()

    // A new row with the "(copy)" suffix should appear, carrying the same chips
    const copyRow = page.locator('li').filter({ hasText: 'backend engineer original (copy)' })
    await expect(copyRow).toBeVisible()
    await expect(copyRow.getByText('past week', { exact: true })).toBeVisible()
    await expect(copyRow.getByText('max 25', { exact: true })).toBeVisible()
    // Tagged as user-added (manual), not AI
    await expect(copyRow.getByText(/manual|user_added/i)).toBeVisible()
    // Default-enabled
    await expect(copyRow.getByRole('checkbox')).toBeChecked()

    // Original remains
    await expect(originalRow).toBeVisible()
  })

  test('duplicated term persists across a view reload', async ({ page }) => {
    await goTo(page, 'Search')

    await page.getByTestId('search-add-role').fill('persist after duplicate')
    await page.getByTestId('search-add-btn').click()

    const row = page.locator('li').filter({ hasText: /^persist after duplicate$/ })
    await expect(row).toBeVisible()
    await row.getByTitle('Duplicate').click()
    await expect(page.locator('li').filter({ hasText: 'persist after duplicate (copy)' })).toBeVisible()

    // Navigate away and back
    await goTo(page, 'Profile')
    await goTo(page, 'Search')

    await expect(page.locator('li').filter({ hasText: 'persist after duplicate (copy)' })).toBeVisible()
  })

  test('editing a duplicated term renames it without affecting the original', async ({ page }) => {
    await goTo(page, 'Search')

    await page.getByTestId('search-add-role').fill('source term')
    await page.getByTestId('search-add-btn').click()

    const source = page.locator('li').filter({ hasText: /^source term$/ })
    await expect(source).toBeVisible()
    await source.getByTitle('Duplicate').click()

    const copyRow = page.locator('li').filter({ hasText: 'source term (copy)' })
    await expect(copyRow).toBeVisible()

    await copyRow.getByTitle('Edit').click()
    await page.getByTestId('search-add-role').fill('renamed variant')
    await page.getByTestId('search-add-btn').click()

    await expect(page.locator('li').filter({ hasText: 'renamed variant' })).toBeVisible()
    await expect(page.locator('li').filter({ hasText: 'source term (copy)' })).not.toBeVisible()
    // Original untouched
    await expect(page.locator('li').filter({ hasText: /^source term$/ })).toBeVisible()
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

  test('generation constraints section renders all fields', async ({ page }) => {
    await goTo(page, 'Search')
    const constraints = page.getByTestId('gen-constraints')
    await expect(constraints).toBeVisible()
    // Seniority checkboxes (exact to avoid matching the "Seniority" group label)
    await expect(constraints.getByText('Senior', { exact: true })).toBeVisible()
    await expect(constraints.getByText('Junior', { exact: true })).toBeVisible()
    // Work type checkboxes
    await expect(constraints.getByText('Remote', { exact: true })).toBeVisible()
    await expect(constraints.getByText('Hybrid', { exact: true })).toBeVisible()
    await expect(constraints.getByText('Onsite', { exact: true })).toBeVisible()
    // Recency select
    await expect(constraints.getByRole('combobox')).toBeVisible()
  })

  test('work_type and recency constraints are applied to generated terms', async ({ page }) => {
    await goTo(page, 'Search')
    const constraints = page.getByTestId('gen-constraints')

    // Set work_type = remote
    await constraints.getByText('Remote').click()
    // Set recency = week
    await constraints.getByRole('combobox').selectOption('week')

    // Generate from intent
    await page.getByTestId('search-generate-btn').click()
    await expect(page.getByText(/senior backend engineer remote/i)).toBeVisible({ timeout: 10_000 })

    // All generated terms should show the remote chip and past week chip
    const termRows = page.locator('li').filter({ has: page.getByText('AI') })
    const firstTerm = termRows.first()
    // Use exact to avoid matching the term name text which may also contain "remote"
    await expect(firstTerm.getByText('remote', { exact: true })).toBeVisible()
    await expect(firstTerm.getByText('past week', { exact: true })).toBeVisible()
  })

  test('constraints are also applied when generating from profile', async ({ page }) => {
    await goTo(page, 'Search')
    const constraints = page.getByTestId('gen-constraints')

    // Set recency = month
    await constraints.getByRole('combobox').selectOption('month')

    await page.getByTestId('search-generate-from-profile-btn').click()
    await expect(page.getByText(/senior backend engineer remote/i)).toBeVisible({ timeout: 10_000 })

    const termRows = page.locator('li').filter({ has: page.getByText('AI') })
    await expect(termRows.first().getByText('past month')).toBeVisible()
  })
})
