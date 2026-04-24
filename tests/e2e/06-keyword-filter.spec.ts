import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'

test.describe('Keyword Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await runAndCommitScrape(page)
  })

  async function goToFilters(page: import('playwright').Page) {
    await goTo(page, 'Search Config')
    await page.getByRole('tab', { name: /Filters/i }).or(page.getByRole('button', { name: /Filters/i })).click()
  }

  test('required keyword filters out postings that do not match', async ({ page }) => {
    // "Rust" appears in only some mock postings (Vercel, Fly.io, Deno)
    await goToFilters(page)
    const requiredInput = page.getByLabel(/Required keywords/i)
      .or(page.getByPlaceholder(/required keyword/i))
    await requiredInput.fill('Rust')
    await page.getByRole('button', { name: /Save|Apply/i }).click()

    await goTo(page, 'Job Board')
    // Stripe (Go, Ruby) should not appear; Fly.io (Rust) should appear
    await expect(page.getByText('Fly.io')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Linear')).not.toBeVisible()
  })

  test('excluded keyword removes matching postings from the job board', async ({ page }) => {
    // "PostgreSQL" appears in several mock postings
    await goToFilters(page)
    const excludedInput = page.getByLabel(/Excluded keywords/i)
      .or(page.getByPlaceholder(/excluded keyword/i))
    await excludedInput.fill('PostgreSQL')
    await page.getByRole('button', { name: /Save|Apply/i }).click()

    await goTo(page, 'Job Board')
    // Stripe references PostgreSQL in its raw_text — should be excluded
    await expect(page.getByText('Stripe')).not.toBeVisible({ timeout: 10_000 })
  })

  test('re: prefix treats keyword as a regex pattern', async ({ page }) => {
    // Pattern that matches "Senior" or "Staff" seniority labels
    await goToFilters(page)
    const requiredInput = page.getByLabel(/Required keywords/i)
      .or(page.getByPlaceholder(/required keyword/i))
    await requiredInput.fill('re:Senior|Staff')
    await page.getByRole('button', { name: /Save|Apply/i }).click()

    await goTo(page, 'Job Board')
    // Mid-level postings (Linear, Supabase) should be filtered out
    await expect(page.getByText('Linear')).not.toBeVisible({ timeout: 10_000 })
  })

  test('modifying a keyword after commit takes retroactive effect without re-scrape', async ({ page }) => {
    // Verify all postings visible initially
    await goTo(page, 'Job Board')
    await expect(page.getByText('Stripe')).toBeVisible()

    // Now add an exclusion keyword
    await goToFilters(page)
    const excludedInput = page.getByLabel(/Excluded keywords/i)
      .or(page.getByPlaceholder(/excluded keyword/i))
    await excludedInput.fill('Stripe')
    await page.getByRole('button', { name: /Save|Apply/i }).click()

    // Return to job board — no re-scrape performed, but Stripe should be gone
    await goTo(page, 'Job Board')
    await expect(page.getByText('Stripe')).not.toBeVisible({ timeout: 10_000 })
  })

  test('excluded stack filter operates on tech stack independently from keyword filter', async ({ page }) => {
    await goToFilters(page)
    const excludedStackInput = page.getByLabel(/Excluded stack|Excluded tech/i)
      .or(page.getByPlaceholder(/e\.g\. PHP/i))
    await excludedStackInput.fill('TypeScript')
    await page.getByRole('button', { name: /Save|Apply/i }).click()

    await goTo(page, 'Job Board')
    // Linear (TypeScript, React, GraphQL) should be excluded
    await expect(page.getByText('Linear')).not.toBeVisible({ timeout: 10_000 })
    // Fly.io (Go, Rust) should still appear
    await expect(page.getByText('Fly.io')).toBeVisible()
  })
})
