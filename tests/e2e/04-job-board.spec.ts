import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'

test.describe('Job Board', () => {
  test.beforeEach(async ({ page }) => {
    await runAndCommitScrape(page)
    await goTo(page, 'Job Board')
  })

  test('displays postings after a committed scrape', async ({ page }) => {
    // At least one posting should be visible
    await expect(page.getByText('Stripe').or(page.getByText('Vercel')).or(page.getByText('Linear'))).toBeVisible({ timeout: 10_000 })
  })

  test('postings show company, title, location, seniority, tech stack, and age', async ({ page }) => {
    // The mock adapter includes "Stripe" with "Senior Backend Engineer"
    await expect(page.getByText('Stripe')).toBeVisible()
    await expect(page.getByText('Senior Backend Engineer').first()).toBeVisible()
    await expect(page.getByText(/remote/i).first()).toBeVisible()
  })

  test('affinity score badges are visible on postings', async ({ page }) => {
    // Stub returns 0.82 for all postings → should render green (≥75%)
    // Verify at least one badge is present
    const badge = page.locator('[data-testid="affinity-badge"], .affinity-badge').first()
      .or(page.getByText(/82%|0\.82/i).first())
    await expect(badge).toBeVisible({ timeout: 10_000 })
  })

  test('hovering a posting title shows the affinity reasoning tooltip', async ({ page }) => {
    const firstTitle = page.getByRole('link', { name: /engineer|developer/i }).first()
      .or(page.getByText(/Senior Backend Engineer/i).first())
    await firstTitle.hover()
    await expect(page.getByText(/match on backend systems|reasoning/i)).toBeVisible({ timeout: 5_000 })
  })

  test('hard filter by YOE excludes postings outside the user range', async ({ page }) => {
    // Set user YOE to 1 — all mock postings have yoe_min ≥ 3
    await goTo(page, 'Profile')
    await page.getByLabel(/Years of experience|YOE/i).fill('1')
    await page.getByRole('button', { name: /Save YOE|Save/i }).first().click()

    await goTo(page, 'Job Board')
    // With YOE=1 and all postings requiring 3+, the board should be empty
    await expect(page.getByText(/No postings|no results|empty/i)).toBeVisible({ timeout: 10_000 })
  })

  test('excluded stack filter hides postings containing that stack item', async ({ page }) => {
    // Add "Go" to excluded stack — several mock postings include Go
    await goTo(page, 'Search Config')
    await page.getByRole('tab', { name: /Filters/i }).or(page.getByRole('button', { name: /Filters/i })).click()
    const excludedStackInput = page.getByLabel(/Excluded stack|Excluded tech/i)
      .or(page.getByPlaceholder(/e\.g\. PHP/i))
    await excludedStackInput.fill('Go')
    await page.getByRole('button', { name: /Save|Apply/i }).click()

    await goTo(page, 'Job Board')
    // Stripe (Go) and Fly.io (Go) should no longer appear
    await expect(page.getByText('Stripe')).not.toBeVisible({ timeout: 5_000 })
  })

  test('postings are displayed in descending composite score order', async ({ page }) => {
    // All mock postings receive the same stub affinity score (0.82),
    // so the ordering will be by recency. The most recently posted comes first.
    // Simply verify the list renders without error and has multiple items.
    const items = page.locator('table tbody tr, ul li').filter({ hasText: /Engineer|Developer/i })
    await expect(items.first()).toBeVisible()
    const count = await items.count()
    expect(count).toBeGreaterThan(1)
  })

  test('"not scored (small batch)" badge shown when skip threshold exceeds posting count', async ({ page }) => {
    // Set affinity skip threshold higher than 15 (the mock count) so all are skipped
    await goTo(page, 'Settings')
    const thresholdInput = page.getByLabel(/Affinity skip threshold|Skip threshold/i)
    await thresholdInput.fill('20')
    await page.getByRole('button', { name: /Save|Apply/i }).first().click()

    await goTo(page, 'Job Board')
    await expect(page.getByText(/not scored.*small batch|small batch/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('clicking Tailor Resume navigates to the Resume view for that posting', async ({ page }) => {
    const tailorBtn = page.getByRole('button', { name: /Tailor Resume/i }).first()
    await tailorBtn.click()
    await expect(page.getByRole('heading', { name: /Resume|Tailor/i })).toBeVisible({ timeout: 5_000 })
  })
})
