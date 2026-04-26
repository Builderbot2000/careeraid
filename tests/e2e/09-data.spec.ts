import { test, expect, goTo } from './fixtures/app'
import path from 'path'
import fs from 'fs'

test.describe('Data Management Module', () => {
  async function addProfileEntry(page: import('playwright').Page, title: string) {
    await goTo(page, 'Profile')
    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Content').fill(`Content for ${title}.`)
    await page.getByRole('button', { name: /Add entry|Save/i }).click()
    await expect(page.getByText(title)).toBeVisible()
  }

  test('backup creates a database file at the expected path', async ({ page }) => {
    // Trigger backup via the IPC (stub bypasses the OS dialog)
    const filePath = await page.evaluate(() =>
      window.api.createBackup(),
    )
    expect(typeof filePath).toBe('string')
    expect(fs.existsSync(filePath as string)).toBe(true)
    expect(path.extname(filePath as string)).toBe('.db')
  })

  test('export writes a JSON file containing profile entries', async ({ page }) => {
    await addProfileEntry(page, 'Export Test Entry')

    const filePath = await page.evaluate(() =>
      window.api.exportData(),
    )
    expect(typeof filePath).toBe('string')
    expect(fs.existsSync(filePath as string)).toBe(true)

    const data = JSON.parse(fs.readFileSync(filePath as string, 'utf-8'))
    expect(data.version).toBe(1)
    expect(Array.isArray(data.profile_entries)).toBe(true)
    const titles = (data.profile_entries as { title: string }[]).map((e) => e.title)
    expect(titles).toContain('Export Test Entry')
  })

  test('import in merge mode adds new entries without overwriting existing ones', async ({ page }) => {
    await addProfileEntry(page, 'Pre-existing Entry')

    // Export the current state as the import source
    const exportPath = await page.evaluate(() =>
      window.api.exportData(),
    ) as string

    // Add another entry after export — this should survive a merge import
    await addProfileEntry(page, 'Post-export Entry')

    // Import back from the export file using merge mode
    await page.evaluate(
      ([mode, fp]) => window.api.importDataFromFile(mode as 'merge' | 'replace', fp),
      ['merge', exportPath] as [string, string],
    )

    // Navigate away then back to force Profile to re-fetch from DB
    await goTo(page, 'Settings')
    await goTo(page, 'Profile')
    // Both entries should be present (merge doesn't overwrite)
    await expect(page.getByText('Pre-existing Entry', { exact: true })).toBeVisible()
    await expect(page.getByText('Post-export Entry', { exact: true })).toBeVisible()
  })

  test('import in replace mode clears and replaces entries', async ({ page }) => {
    await addProfileEntry(page, 'Original Entry')

    // Export current state
    const exportPath = await page.evaluate(() =>
      window.api.exportData(),
    ) as string

    // Add a new entry after export — this should be gone after a replace import
    await addProfileEntry(page, 'Entry Added After Export')

    // Replace import
    await page.evaluate(
      ([mode, fp]) => window.api.importDataFromFile(mode as 'merge' | 'replace', fp),
      ['replace', exportPath] as [string, string],
    )

    // Navigate away then back to force Profile to re-fetch from DB
    await goTo(page, 'Settings')
    await goTo(page, 'Profile')
    await expect(page.getByText('Original Entry', { exact: true })).toBeVisible()
    await expect(page.getByText('Entry Added After Export', { exact: true })).not.toBeVisible()
  })
})
