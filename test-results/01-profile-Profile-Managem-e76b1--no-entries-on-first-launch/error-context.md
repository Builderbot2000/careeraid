# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-profile.spec.ts >> Profile Management >> displays the Profile view with no entries on first launch
- Location: tests/e2e/01-profile.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Profile' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Profile' })

```

# Test source

```ts
  1  | import { test, expect, goTo } from './fixtures/app'
  2  | 
  3  | test.describe('Profile Management', () => {
  4  |   test('displays the Profile view with no entries on first launch', async ({ page }) => {
  5  |     await goTo(page, 'Profile')
> 6  |     await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
     |                                                                  ^ Error: expect(locator).toBeVisible() failed
  7  |   })
  8  | 
  9  |   test('creates a new profile entry and shows it in the list', async ({ page }) => {
  10 |     await goTo(page, 'Profile')
  11 |     await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
  12 |     await page.getByLabel('Title').fill('Senior Software Engineer at Acme')
  13 |     await page.getByLabel('Content').fill('Led backend systems development using TypeScript and PostgreSQL.')
  14 |     await page.getByRole('button', { name: /Add entry|Save/i }).click()
  15 |     await expect(page.getByText('Senior Software Engineer at Acme')).toBeVisible()
  16 |   })
  17 | 
  18 |   test('edits an existing entry and reflects updated content', async ({ page }) => {
  19 |     await goTo(page, 'Profile')
  20 |     // Create an entry first
  21 |     await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
  22 |     await page.getByLabel('Title').fill('Original Title')
  23 |     await page.getByLabel('Content').fill('Original content for this entry.')
  24 |     await page.getByRole('button', { name: /Add entry|Save/i }).click()
  25 |     await expect(page.getByText('Original Title')).toBeVisible()
  26 | 
  27 |     // Edit it
  28 |     await page.getByText('Original Title').click()
  29 |     await page.getByLabel('Title').fill('Updated Title')
  30 |     await page.getByRole('button', { name: /Save changes/i }).click()
  31 |     await expect(page.getByText('Updated Title')).toBeVisible()
  32 |     await expect(page.getByText('Original Title')).not.toBeVisible()
  33 |   })
  34 | 
  35 |   test('deletes an entry and removes it from the list', async ({ page }) => {
  36 |     await goTo(page, 'Profile')
  37 |     await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
  38 |     await page.getByLabel('Title').fill('Entry To Delete')
  39 |     await page.getByLabel('Content').fill('This will be deleted.')
  40 |     await page.getByRole('button', { name: /Add entry|Save/i }).click()
  41 |     await expect(page.getByText('Entry To Delete')).toBeVisible()
  42 | 
  43 |     // Delete — expect a confirmation dialog
  44 |     page.once('dialog', (dialog) => dialog.accept())
  45 |     await page.getByRole('button', { name: /Delete/i }).first().click()
  46 |     await expect(page.getByText('Entry To Delete')).not.toBeVisible()
  47 |   })
  48 | 
  49 |   test('shows an error and does not save when content exceeds word limit', async ({ page }) => {
  50 |     await goTo(page, 'Profile')
  51 |     // Set a low word limit so we can exceed it easily
  52 |     await goTo(page, 'Settings')
  53 |     const wordLimitInput = page.getByLabel(/Profile entry word limit|Word limit/i)
  54 |     await wordLimitInput.fill('5')
  55 |     await page.getByRole('button', { name: /Save|Apply/i }).first().click()
  56 | 
  57 |     await goTo(page, 'Profile')
  58 |     await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
  59 |     await page.getByLabel('Title').fill('Over Limit Entry')
  60 |     // 10 words — exceeds limit of 5
  61 |     await page.getByLabel('Content').fill('one two three four five six seven eight nine ten')
  62 |     await page.getByRole('button', { name: /Add entry|Save/i }).click()
  63 | 
  64 |     // Error must be visible and entry must not appear in list
  65 |     await expect(page.getByText(/word limit|too long|exceeds/i)).toBeVisible()
  66 |   })
  67 | 
  68 |   test('word count indicator updates as user types', async ({ page }) => {
  69 |     await goTo(page, 'Profile')
  70 |     await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
  71 |     await page.getByLabel('Content').fill('hello world foo')
  72 |     await expect(page.getByText(/3 word/i)).toBeVisible()
  73 |     await page.getByLabel('Content').fill('hello world')
  74 |     await expect(page.getByText(/2 word/i)).toBeVisible()
  75 |   })
  76 | 
  77 |   test('filters entries by type tag', async ({ page }) => {
  78 |     await goTo(page, 'Profile')
  79 | 
  80 |     // Create entries of different types
  81 |     await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
  82 |     await page.getByLabel('Type').selectOption('skill')
  83 |     await page.getByLabel('Title').fill('TypeScript')
  84 |     await page.getByLabel('Content').fill('Proficient in TypeScript.')
  85 |     await page.getByRole('button', { name: /Add entry|Save/i }).click()
  86 | 
  87 |     await page.getByRole('button', { name: /New Entry|Add Entry/i }).click()
  88 |     await page.getByLabel('Type').selectOption('education')
  89 |     await page.getByLabel('Title').fill('BSc Computer Science')
  90 |     await page.getByLabel('Content').fill('State University.')
  91 |     await page.getByRole('button', { name: /Add entry|Save/i }).click()
  92 | 
  93 |     // Filter to skills only
  94 |     await page.getByRole('button', { name: /Skill/i }).click()
  95 |     await expect(page.getByText('TypeScript')).toBeVisible()
  96 |     await expect(page.getByText('BSc Computer Science')).not.toBeVisible()
  97 |   })
  98 | })
  99 | 
```