import { test, expect, goTo } from './fixtures/app'

test.describe('Settings Module', () => {
  test('Settings view renders all configurable fields', async ({ page }) => {
    await goTo(page, 'Settings')
    await expect(page.getByText(/API key/i)).toBeVisible()
    await expect(page.getByText(/PDF compiler|TeX binary/i)).toBeVisible()
    await expect(page.getByText(/Crawl delay/i)).toBeVisible()
    await expect(page.getByText(/Retention/i)).toBeVisible()
  })

  test('saving an API key marks it as present', async ({ page }) => {
    await goTo(page, 'Settings')
    const apiKeyInput = page.getByLabel(/API key/i).or(page.getByPlaceholder(/sk-ant/i))
    await apiKeyInput.fill('sk-ant-test-key-0000000000000000')
    await page.getByRole('button', { name: /Save.*key|Set key/i }).click()
    await expect(page.getByText(/key set|present|saved/i)).toBeVisible({ timeout: 5_000 })
  })

  test('deleting the API key causes Claude-dependent features to show a lock', async ({ page }) => {
    // Set a key first
    await goTo(page, 'Settings')
    const apiKeyInput = page.getByLabel(/API key/i).or(page.getByPlaceholder(/sk-ant/i))
    await apiKeyInput.fill('sk-ant-test-key-0000000000000000')
    await page.getByRole('button', { name: /Save.*key|Set key/i }).click()

    // Delete it
    await page.getByRole('button', { name: /Delete.*key|Remove.*key/i }).click()

    // Nav item for Resume should show locked (per FeatureLocks.claudeApiKey)
    // Note: the lock badge appears in the nav sidebar
    await expect(page.getByText(/locked/).first()).toBeVisible({ timeout: 5_000 })
  })

  test('crawl delay setting is persisted', async ({ page }) => {
    await goTo(page, 'Settings')
    const crawlDelayInput = page.getByLabel(/Crawl delay/i)
    await crawlDelayInput.fill('5000')
    await page.getByRole('button', { name: /Save|Apply/i }).first().click()

    // Navigate away and back
    await goTo(page, 'Profile')
    await goTo(page, 'Settings')
    await expect(page.getByLabel(/Crawl delay/i)).toHaveValue('5000')
  })

  test('posting retention days setting is persisted', async ({ page }) => {
    await goTo(page, 'Settings')
    const retentionInput = page.getByLabel(/Retention days|retention/i)
    await retentionInput.fill('30')
    await page.getByRole('button', { name: /Save|Apply/i }).first().click()

    await goTo(page, 'Profile')
    await goTo(page, 'Settings')
    await expect(page.getByLabel(/Retention days|retention/i)).toHaveValue('30')
  })

  test('log level setting can be changed', async ({ page }) => {
    await goTo(page, 'Settings')
    const logLevelSelect = page.getByLabel(/Log level/i)
    await logLevelSelect.selectOption('debug')
    await page.getByRole('button', { name: /Save|Apply/i }).first().click()

    await goTo(page, 'Profile')
    await goTo(page, 'Settings')
    await expect(page.getByLabel(/Log level/i)).toHaveValue('debug')
  })
})
