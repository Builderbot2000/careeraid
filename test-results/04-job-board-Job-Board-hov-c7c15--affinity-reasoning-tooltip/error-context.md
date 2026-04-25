# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-job-board.spec.ts >> Job Board >> hovering a posting title shows the affinity reasoning tooltip
- Location: tests/e2e/04-job-board.spec.ts:29:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/match on backend systems|reasoning/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/match on backend systems|reasoning/i)

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e5]: Career Index
    - button "Profile" [ref=e6] [cursor=pointer]
    - button "Search Config" [ref=e7] [cursor=pointer]
    - button "Job Board" [active] [ref=e8] [cursor=pointer]
    - button "Resume locked" [ref=e9]:
      - text: Resume
      - generic [ref=e10]: locked
    - button "Tracker" [ref=e11] [cursor=pointer]
    - button "Analytics" [ref=e12] [cursor=pointer]
    - button "Settings" [ref=e13] [cursor=pointer]
  - main [ref=e14]:
    - generic [ref=e15]:
      - heading "Job Board (15)" [level=2] [ref=e16]:
        - text: Job Board
        - generic [ref=e17]: (15)
      - table [ref=e18]:
        - rowgroup [ref=e19]:
          - row "Company Role Level Location Posted Fit Status Actions" [ref=e20]:
            - columnheader "Company" [ref=e21]
            - columnheader "Role" [ref=e22]
            - columnheader "Level" [ref=e23]
            - columnheader "Location" [ref=e24]
            - columnheader "Posted" [ref=e25]
            - columnheader "Fit" [ref=e26]
            - columnheader "Status" [ref=e27]
            - columnheader "Actions" [ref=e28]
        - rowgroup [ref=e29]:
          - row "Stripe Senior Backend Engineer senior remote 1d ago 82% new Tailor Resume Open ↗" [ref=e30]:
            - cell "Stripe" [ref=e31]
            - cell "Senior Backend Engineer" [ref=e32]
            - cell "senior" [ref=e33]
            - cell "remote" [ref=e34]
            - cell "1d ago" [ref=e35]
            - cell "82%" [ref=e36]:
              - 'generic "Affinity score: 82%" [ref=e38]': 82%
            - cell "new" [ref=e39]:
              - generic [ref=e40]: new
            - cell "Tailor Resume Open ↗" [ref=e41]:
              - button "Tailor Resume" [ref=e42] [cursor=pointer]
              - button "Open ↗" [ref=e43] [cursor=pointer]
          - row "Vercel Staff Software Engineer, Infrastructure staff remote 2d ago 82% new Tailor Resume Open ↗" [ref=e44]:
            - cell "Vercel" [ref=e45]
            - cell "Staff Software Engineer, Infrastructure" [ref=e46]
            - cell "staff" [ref=e47]
            - cell "remote" [ref=e48]
            - cell "2d ago" [ref=e49]
            - cell "82%" [ref=e50]:
              - 'generic "Affinity score: 82%" [ref=e52]': 82%
            - cell "new" [ref=e53]:
              - generic [ref=e54]: new
            - cell "Tailor Resume Open ↗" [ref=e55]:
              - button "Tailor Resume" [ref=e56] [cursor=pointer]
              - button "Open ↗" [ref=e57] [cursor=pointer]
          - row "Linear Software Engineer, Frontend mid remote 3d ago 82% new Tailor Resume Open ↗" [ref=e58]:
            - cell "Linear" [ref=e59]
            - cell "Software Engineer, Frontend" [ref=e60]
            - cell "mid" [ref=e61]
            - cell "remote" [ref=e62]
            - cell "3d ago" [ref=e63]
            - cell "82%" [ref=e64]:
              - 'generic "Affinity score: 82%" [ref=e66]': 82%
            - cell "new" [ref=e67]:
              - generic [ref=e68]: new
            - cell "Tailor Resume Open ↗" [ref=e69]:
              - button "Tailor Resume" [ref=e70] [cursor=pointer]
              - button "Open ↗" [ref=e71] [cursor=pointer]
          - row "Figma Senior Full-Stack Engineer senior hybrid — New York, NY 4d ago 82% new Tailor Resume Open ↗" [ref=e72]:
            - cell "Figma" [ref=e73]
            - cell "Senior Full-Stack Engineer" [ref=e74]
            - cell "senior" [ref=e75]
            - cell "hybrid — New York, NY" [ref=e76]
            - cell "4d ago" [ref=e77]
            - cell "82%" [ref=e78]:
              - 'generic "Affinity score: 82%" [ref=e80]': 82%
            - cell "new" [ref=e81]:
              - generic [ref=e82]: new
            - cell "Tailor Resume Open ↗" [ref=e83]:
              - button "Tailor Resume" [ref=e84] [cursor=pointer]
              - button "Open ↗" [ref=e85] [cursor=pointer]
          - row "Fly.io Senior Platform Engineer senior remote 5d ago 82% new Tailor Resume Open ↗" [ref=e86]:
            - cell "Fly.io" [ref=e87]
            - cell "Senior Platform Engineer" [ref=e88]
            - cell "senior" [ref=e89]
            - cell "remote" [ref=e90]
            - cell "5d ago" [ref=e91]
            - cell "82%" [ref=e92]:
              - 'generic "Affinity score: 82%" [ref=e94]': 82%
            - cell "new" [ref=e95]:
              - generic [ref=e96]: new
            - cell "Tailor Resume Open ↗" [ref=e97]:
              - button "Tailor Resume" [ref=e98] [cursor=pointer]
              - button "Open ↗" [ref=e99] [cursor=pointer]
          - row "GitHub Senior Software Engineer, Site Reliability senior remote 7d ago 82% new Tailor Resume Open ↗" [ref=e100]:
            - cell "GitHub" [ref=e101]
            - cell "Senior Software Engineer, Site Reliability" [ref=e102]
            - cell "senior" [ref=e103]
            - cell "remote" [ref=e104]
            - cell "7d ago" [ref=e105]
            - cell "82%" [ref=e106]:
              - 'generic "Affinity score: 82%" [ref=e108]': 82%
            - cell "new" [ref=e109]:
              - generic [ref=e110]: new
            - cell "Tailor Resume Open ↗" [ref=e111]:
              - button "Tailor Resume" [ref=e112] [cursor=pointer]
              - button "Open ↗" [ref=e113] [cursor=pointer]
          - row "Shopify Senior Backend Engineer senior remote 8d ago 82% new Tailor Resume Open ↗" [ref=e114]:
            - cell "Shopify" [ref=e115]
            - cell "Senior Backend Engineer" [ref=e116]
            - cell "senior" [ref=e117]
            - cell "remote" [ref=e118]
            - cell "8d ago" [ref=e119]
            - cell "82%" [ref=e120]:
              - 'generic "Affinity score: 82%" [ref=e122]': 82%
            - cell "new" [ref=e123]:
              - generic [ref=e124]: new
            - cell "Tailor Resume Open ↗" [ref=e125]:
              - button "Tailor Resume" [ref=e126] [cursor=pointer]
              - button "Open ↗" [ref=e127] [cursor=pointer]
          - row "Discord Backend Engineer mid remote 10d ago 82% new Tailor Resume Open ↗" [ref=e128]:
            - cell "Discord" [ref=e129]
            - cell "Backend Engineer" [ref=e130]
            - cell "mid" [ref=e131]
            - cell "remote" [ref=e132]
            - cell "10d ago" [ref=e133]
            - cell "82%" [ref=e134]:
              - 'generic "Affinity score: 82%" [ref=e136]': 82%
            - cell "new" [ref=e137]:
              - generic [ref=e138]: new
            - cell "Tailor Resume Open ↗" [ref=e139]:
              - button "Tailor Resume" [ref=e140] [cursor=pointer]
              - button "Open ↗" [ref=e141] [cursor=pointer]
          - row "PlanetScale Staff Engineer, Database Platform staff remote 12d ago 82% new Tailor Resume Open ↗" [ref=e142]:
            - cell "PlanetScale" [ref=e143]
            - cell "Staff Engineer, Database Platform" [ref=e144]
            - cell "staff" [ref=e145]
            - cell "remote" [ref=e146]
            - cell "12d ago" [ref=e147]
            - cell "82%" [ref=e148]:
              - 'generic "Affinity score: 82%" [ref=e150]': 82%
            - cell "new" [ref=e151]:
              - generic [ref=e152]: new
            - cell "Tailor Resume Open ↗" [ref=e153]:
              - button "Tailor Resume" [ref=e154] [cursor=pointer]
              - button "Open ↗" [ref=e155] [cursor=pointer]
          - row "Notion Senior Frontend Engineer senior hybrid — San Francisco, CA 13d ago 82% new Tailor Resume Open ↗" [ref=e156]:
            - cell "Notion" [ref=e157]
            - cell "Senior Frontend Engineer" [ref=e158]
            - cell "senior" [ref=e159]
            - cell "hybrid — San Francisco, CA" [ref=e160]
            - cell "13d ago" [ref=e161]
            - cell "82%" [ref=e162]:
              - 'generic "Affinity score: 82%" [ref=e164]': 82%
            - cell "new" [ref=e165]:
              - generic [ref=e166]: new
            - cell "Tailor Resume Open ↗" [ref=e167]:
              - button "Tailor Resume" [ref=e168] [cursor=pointer]
              - button "Open ↗" [ref=e169] [cursor=pointer]
          - row "Supabase Backend Engineer mid remote 15d ago 82% new Tailor Resume Open ↗" [ref=e170]:
            - cell "Supabase" [ref=e171]
            - cell "Backend Engineer" [ref=e172]
            - cell "mid" [ref=e173]
            - cell "remote" [ref=e174]
            - cell "15d ago" [ref=e175]
            - cell "82%" [ref=e176]:
              - 'generic "Affinity score: 82%" [ref=e178]': 82%
            - cell "new" [ref=e179]:
              - generic [ref=e180]: new
            - cell "Tailor Resume Open ↗" [ref=e181]:
              - button "Tailor Resume" [ref=e182] [cursor=pointer]
              - button "Open ↗" [ref=e183] [cursor=pointer]
          - row "Deno Senior Software Engineer senior remote 17d ago 82% new Tailor Resume Open ↗" [ref=e184]:
            - cell "Deno" [ref=e185]
            - cell "Senior Software Engineer" [ref=e186]
            - cell "senior" [ref=e187]
            - cell "remote" [ref=e188]
            - cell "17d ago" [ref=e189]
            - cell "82%" [ref=e190]:
              - 'generic "Affinity score: 82%" [ref=e192]': 82%
            - cell "new" [ref=e193]:
              - generic [ref=e194]: new
            - cell "Tailor Resume Open ↗" [ref=e195]:
              - button "Tailor Resume" [ref=e196] [cursor=pointer]
              - button "Open ↗" [ref=e197] [cursor=pointer]
          - row "Railway Full-Stack Engineer mid remote 20d ago 82% new Tailor Resume Open ↗" [ref=e198]:
            - cell "Railway" [ref=e199]
            - cell "Full-Stack Engineer" [ref=e200]
            - cell "mid" [ref=e201]
            - cell "remote" [ref=e202]
            - cell "20d ago" [ref=e203]
            - cell "82%" [ref=e204]:
              - 'generic "Affinity score: 82%" [ref=e206]': 82%
            - cell "new" [ref=e207]:
              - generic [ref=e208]: new
            - cell "Tailor Resume Open ↗" [ref=e209]:
              - button "Tailor Resume" [ref=e210] [cursor=pointer]
              - button "Open ↗" [ref=e211] [cursor=pointer]
          - row "Loom Senior Backend Engineer senior hybrid — San Francisco, CA 22d ago 82% new Tailor Resume Open ↗" [ref=e212]:
            - cell "Loom" [ref=e213]
            - cell "Senior Backend Engineer" [ref=e214]
            - cell "senior" [ref=e215]
            - cell "hybrid — San Francisco, CA" [ref=e216]
            - cell "22d ago" [ref=e217]
            - cell "82%" [ref=e218]:
              - 'generic "Affinity score: 82%" [ref=e220]': 82%
            - cell "new" [ref=e221]:
              - generic [ref=e222]: new
            - cell "Tailor Resume Open ↗" [ref=e223]:
              - button "Tailor Resume" [ref=e224] [cursor=pointer]
              - button "Open ↗" [ref=e225] [cursor=pointer]
          - row "Airbnb Senior Software Engineer senior hybrid — San Francisco, CA 25d ago 82% new Tailor Resume Open ↗" [ref=e226]:
            - cell "Airbnb" [ref=e227]
            - cell "Senior Software Engineer" [ref=e228]
            - cell "senior" [ref=e229]
            - cell "hybrid — San Francisco, CA" [ref=e230]
            - cell "25d ago" [ref=e231]
            - cell "82%" [ref=e232]:
              - 'generic "Affinity score: 82%" [ref=e234]': 82%
            - cell "new" [ref=e235]:
              - generic [ref=e236]: new
            - cell "Tailor Resume Open ↗" [ref=e237]:
              - button "Tailor Resume" [ref=e238] [cursor=pointer]
              - button "Open ↗" [ref=e239] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect, goTo, runAndCommitScrape } from './fixtures/app'
  2  | 
  3  | test.describe('Job Board', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await runAndCommitScrape(page)
  6  |     await goTo(page, 'Job Board')
  7  |   })
  8  | 
  9  |   test('displays postings after a committed scrape', async ({ page }) => {
  10 |     // At least one posting should be visible
  11 |     await expect(page.getByText('Stripe').or(page.getByText('Vercel')).or(page.getByText('Linear')).first()).toBeVisible({ timeout: 10_000 })
  12 |   })
  13 | 
  14 |   test('postings show company, title, location, seniority, tech stack, and age', async ({ page }) => {
  15 |     // The mock adapter includes "Stripe" with "Senior Backend Engineer"
  16 |     await expect(page.getByText('Stripe')).toBeVisible()
  17 |     await expect(page.getByText('Senior Backend Engineer').first()).toBeVisible()
  18 |     await expect(page.getByText(/remote/i).first()).toBeVisible()
  19 |   })
  20 | 
  21 |   test('affinity score badges are visible on postings', async ({ page }) => {
  22 |     // Stub returns 0.82 for all postings → should render green (≥75%)
  23 |     // Verify at least one badge is present
  24 |     const badge = page.locator('[data-testid="affinity-badge"], .affinity-badge').first()
  25 |       .or(page.getByText(/82%|0\.82/i).first())
  26 |     await expect(badge).toBeVisible({ timeout: 10_000 })
  27 |   })
  28 | 
  29 |   test('hovering a posting title shows the affinity reasoning tooltip', async ({ page }) => {
  30 |     const firstTitle = page.getByRole('link', { name: /engineer|developer/i }).first()
  31 |       .or(page.getByText(/Senior Backend Engineer/i).first())
  32 |     await firstTitle.hover()
> 33 |     await expect(page.getByText(/match on backend systems|reasoning/i)).toBeVisible({ timeout: 5_000 })
     |                                                                         ^ Error: expect(locator).toBeVisible() failed
  34 |   })
  35 | 
  36 |   test('hard filter by YOE excludes postings outside the user range', async ({ page }) => {
  37 |     // Set user YOE to 1 — all mock postings have yoe_min ≥ 3
  38 |     await goTo(page, 'Profile')
  39 |     await page.getByLabel(/Years of experience|YOE/i).fill('1')
  40 |     await page.getByRole('button', { name: /Save YOE|Save/i }).first().click()
  41 | 
  42 |     await goTo(page, 'Job Board')
  43 |     // With YOE=1 and all postings requiring 3+, the board should be empty
  44 |     await expect(page.getByText(/No postings|no results|empty/i)).toBeVisible({ timeout: 10_000 })
  45 |   })
  46 | 
  47 |   test('excluded stack filter hides postings containing that stack item', async ({ page }) => {
  48 |     // Add "Go" to excluded stack — several mock postings include Go
  49 |     await goTo(page, 'Search Config')
  50 |     await page.getByRole('tab', { name: /Filters/i }).or(page.getByRole('button', { name: /Filters/i })).click()
  51 |     const excludedStackInput = page.getByLabel(/Excluded stack|Excluded tech/i)
  52 |       .or(page.getByPlaceholder(/e\.g\. PHP/i))
  53 |     await excludedStackInput.fill('Go')
  54 |     await page.getByRole('button', { name: /Save|Apply/i }).click()
  55 | 
  56 |     await goTo(page, 'Job Board')
  57 |     // Stripe (Go) and Fly.io (Go) should no longer appear
  58 |     await expect(page.getByText('Stripe')).not.toBeVisible({ timeout: 5_000 })
  59 |   })
  60 | 
  61 |   test('postings are displayed in descending composite score order', async ({ page }) => {
  62 |     // All mock postings receive the same stub affinity score (0.82),
  63 |     // so the ordering will be by recency. The most recently posted comes first.
  64 |     // Simply verify the list renders without error and has multiple items.
  65 |     const items = page.locator('table tbody tr, ul li').filter({ hasText: /Engineer|Developer/i })
  66 |     await expect(items.first()).toBeVisible()
  67 |     const count = await items.count()
  68 |     expect(count).toBeGreaterThan(1)
  69 |   })
  70 | 
  71 |   test('"not scored (small batch)" badge shown when skip threshold exceeds posting count', async ({ page }) => {
  72 |     // Set affinity skip threshold higher than 15 (the mock count) so all are skipped
  73 |     await goTo(page, 'Settings')
  74 |     const thresholdInput = page.getByLabel(/Affinity skip threshold|Skip threshold/i)
  75 |     await thresholdInput.fill('20')
  76 |     await page.getByRole('button', { name: /Save|Apply/i }).first().click()
  77 | 
  78 |     await goTo(page, 'Job Board')
  79 |     await expect(page.getByText(/not scored.*small batch|small batch/i).first()).toBeVisible({ timeout: 10_000 })
  80 |   })
  81 | 
  82 |   test('clicking Tailor Resume navigates to the Resume view for that posting', async ({ page }) => {
  83 |     const tailorBtn = page.getByRole('button', { name: /Tailor Resume/i }).first()
  84 |     await tailorBtn.click()
  85 |     await expect(page.getByRole('heading', { name: /Resume|Tailor/i })).toBeVisible({ timeout: 5_000 })
  86 |   })
  87 | })
  88 | 
```