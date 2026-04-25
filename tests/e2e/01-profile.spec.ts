import { test, expect, goTo } from './fixtures/app'

test.describe('Profile Management', () => {
  test('displays the Profile view with no entries on first launch', async ({ page }) => {
    await goTo(page, 'Profile')
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  })

  test('creates a new profile entry and shows it in the list', async ({ page }) => {
    await goTo(page, 'Profile')
    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Title').fill('Senior Software Engineer at Acme')
    await page.getByLabel('Content').fill('Led backend systems development using TypeScript and PostgreSQL.')
    await page.getByRole('button', { name: /Add entry|Save/i }).click()
    await expect(page.getByText('Senior Software Engineer at Acme')).toBeVisible()
  })

  test('edits an existing entry and reflects updated content', async ({ page }) => {
    await goTo(page, 'Profile')
    // Create an entry first
    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Title').fill('Original Title')
    await page.getByLabel('Content').fill('Original content for this entry.')
    await page.getByRole('button', { name: /Add entry|Save/i }).click()
    await expect(page.getByText('Original Title')).toBeVisible()

    // Edit it
    await page.getByText('Original Title').click()
    await page.getByLabel('Title').fill('Updated Title')
    await page.getByRole('button', { name: /Save changes/i }).click()
    await expect(page.getByText('Updated Title')).toBeVisible()
    await expect(page.getByText('Original Title')).not.toBeVisible()
  })

  test('deletes an entry and removes it from the list', async ({ page }) => {
    await goTo(page, 'Profile')
    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Title').fill('Entry To Delete')
    await page.getByLabel('Content').fill('This will be deleted.')
    await page.getByRole('button', { name: /Add entry|Save/i }).click()
    await expect(page.getByText('Entry To Delete')).toBeVisible()

    // Delete — expect a confirmation dialog
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: /Delete/i }).first().click()
    await expect(page.getByText('Entry To Delete')).not.toBeVisible()
  })

  test('shows an error and does not save when content exceeds word limit', async ({ page }) => {
    await goTo(page, 'Profile')
    // Set a low word limit so we can exceed it easily
    await goTo(page, 'Settings')
    const wordLimitInput = page.getByLabel(/Profile entry word limit|Word limit/i)
    await wordLimitInput.fill('5')

    await goTo(page, 'Profile')
    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Title').fill('Over Limit Entry')
    // 10 words — exceeds limit of 5
    await page.getByLabel('Content').fill('one two three four five six seven eight nine ten')
    await page.getByRole('button', { name: /Add entry|Save/i }).click()

    // Error must be visible and entry must not appear in list
    await expect(page.getByText(/word limit|too long|exceeds/i)).toBeVisible()
  })

  test('word count indicator updates as user types', async ({ page }) => {
    await goTo(page, 'Profile')
    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Content').fill('hello world foo')
    await expect(page.getByText(/3 word/i)).toBeVisible()
    await page.getByLabel('Content').fill('hello world')
    await expect(page.getByText(/2 word/i)).toBeVisible()
  })

  test('filters entries by type tag', async ({ page }) => {
    await goTo(page, 'Profile')

    // Create entries of different types
    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Type').selectOption('skill')
    await page.getByLabel('Title').fill('TypeScript')
    await page.getByLabel('Content').fill('Proficient in TypeScript.')
    await page.getByRole('button', { name: /Add entry|Save/i }).click()

    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Type').selectOption('education')
    await page.getByLabel('Title').fill('BSc Computer Science')
    await page.getByLabel('Content').fill('State University.')
    await page.getByRole('button', { name: /Add entry|Save/i }).click()

    // Filter to skills only
    await page.getByRole('button', { name: /Skill/i }).click()
    await expect(page.getByText('TypeScript', { exact: true })).toBeVisible()
    await expect(page.getByText('BSc Computer Science')).not.toBeVisible()
  })
})
