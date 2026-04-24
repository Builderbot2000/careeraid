import { test, expect, goTo } from './fixtures/app'
import path from 'path'
import fs from 'fs'

test.describe('Backup, Export, and Import', () => {
  async function addProfileEntry(page: import('playwright').Page, title: string) {
    await goTo(page, 'Profile')
    await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Content').fill(`Content for ${title}.`)
    await page.getByRole('button', { name: /Add entry|Save/i }).click()
    await expect(page.getByText(title)).toBeVisible()
  }

  test('backup creates a database file at the expected path', async ({ page, app }) => {
    // Trigger backup via the IPC (stub bypasses the OS dialog)
    const filePath = await app.evaluate(({ ipcRenderer }) =>
      ipcRenderer.invoke('backup:create'),
    )
    expect(typeof filePath).toBe('string')
    expect(fs.existsSync(filePath as string)).toBe(true)
    expect(path.extname(filePath as string)).toBe('.db')
  })

  test('export writes a JSON file containing profile entries', async ({ page, app }) => {
    await addProfileEntry(page, 'Export Test Entry')

    const filePath = await app.evaluate(({ ipcRenderer }) =>
      ipcRenderer.invoke('data:export'),
    )
    expect(typeof filePath).toBe('string')
    expect(fs.existsSync(filePath as string)).toBe(true)

    const data = JSON.parse(fs.readFileSync(filePath as string, 'utf-8'))
    expect(data.version).toBe(1)
    expect(Array.isArray(data.profile_entries)).toBe(true)
    const titles = (data.profile_entries as { title: string }[]).map((e) => e.title)
    expect(titles).toContain('Export Test Entry')
  })

  test('import in merge mode adds new entries without overwriting existing ones', async ({ page, app }) => {
    await addProfileEntry(page, 'Pre-existing Entry')

    // Export the current state as the import source
    const exportPath = await app.evaluate(({ ipcRenderer }) =>
      ipcRenderer.invoke('data:export'),
    ) as string

    // Add another entry after export — this should survive a merge import
    await addProfileEntry(page, 'Post-export Entry')

    // Trigger merge import pointing at the export file
    // In test mode, data:import stub uses a temp path; here we call it via evaluate
    const result = await app.evaluate(
      async ({ ipcRenderer }, importPath) => {
        // Override open dialog result by directly calling the underlying import logic
        // We invoke a special test-only IPC to import from a specific path
        return ipcRenderer.invoke('data:import-file', { mode: 'merge', filePath: importPath })
      },
      exportPath,
    )

    await goTo(page, 'Profile')
    // Both entries should be present (merge doesn't overwrite)
    await expect(page.getByText('Pre-existing Entry')).toBeVisible()
    await expect(page.getByText('Post-export Entry')).toBeVisible()
  })

  test('import in replace mode clears and replaces entries', async ({ page, app }) => {
    await addProfileEntry(page, 'Original Entry')

    // Export current state
    const exportPath = await app.evaluate(({ ipcRenderer }) =>
      ipcRenderer.invoke('data:export'),
    ) as string

    // Add a new entry after export — this should be gone after a replace import
    await addProfileEntry(page, 'Entry Added After Export')

    // Replace import
    await app.evaluate(
      async ({ ipcRenderer }, importPath) => {
        return ipcRenderer.invoke('data:import-file', { mode: 'replace', filePath: importPath })
      },
      exportPath,
    )

    await goTo(page, 'Profile')
    await expect(page.getByText('Original Entry')).toBeVisible()
    await expect(page.getByText('Entry Added After Export')).not.toBeVisible()
  })
})
