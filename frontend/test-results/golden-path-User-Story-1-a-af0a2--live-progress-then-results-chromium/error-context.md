# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: golden-path.spec.ts >> User Story 1: analyze a URL and see live progress then results
- Location: tests\e2e\golden-path.spec.ts:3:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Fetching page')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Fetching page')

```

```yaml
- link "Visora Analyzer":
  - /url: /
  - img
  - text: Visora Analyzer
- list:
  - listitem:
    - link "Projects":
      - /url: /projects
- main:
  - heading "Get found by Search Engines. Get recommended by AI." [level=1]
  - paragraph: Paste a product listing URL and get an instant SEO score showing what's costing you search visibility — then get an AI-generated suggestion optimized for AI and Search Engines, prove it works by testing whether they actually recommend your listing before and after.
  - textbox "Paste any e-commerce product URL (InCollect, 1stDibs, Shopify...)": https://e2e-golden-path.example.com
  - button "Analyze"
  - paragraph: "Or try a demo product:"
  - button "InCollect"
  - button "1stDibs"
  - button "Shopify Store"
  - alert: Failed to fetch
  - heading "Instant scoring" [level=3]
  - paragraph: Every page is scored for both search engines and AI, with color-coded severity for each finding.
  - heading "Copy-paste fixes" [level=3]
  - paragraph: Findings come with ready-to-use code snippets you can drop straight into your page.
  - heading "Track whole sites" [level=3]
  - paragraph: Group URLs into projects to spot issues that repeat across pages, and schedule recurring checks.
- status:
  - img
  - text: Static route
  - button "Hide static indicator":
    - img
- alert
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('User Story 1: analyze a URL and see live progress then results', async ({ page }) => {
  4  |   await page.goto('/');
  5  | 
  6  |   await page.getByPlaceholder(/paste any e-commerce product url/i).fill('https://e2e-golden-path.example.com');
  7  |   await page.getByRole('button', { name: 'Analyze' }).click();
  8  | 
  9  |   // Live status tracker renders immediately while the analysis runs.
> 10 |   await expect(page.getByText('Fetching page')).toBeVisible();
     |                                                 ^ Error: expect(locator).toBeVisible() failed
  11 | 
  12 |   // The app auto-navigates to the results page once the run completes.
  13 |   await page.waitForURL(/\/runs\/.+/, { timeout: 10_000 });
  14 | 
  15 |   await expect(page.getByText('Overall SEO score')).toBeVisible();
  16 |   await expect(page.getByRole('progressbar')).toBeVisible();
  17 | });
  18 | 
  19 | test('an invalid URL shows an inline error and does not navigate away', async ({ page }) => {
  20 |   await page.goto('/');
  21 | 
  22 |   await page.getByPlaceholder(/paste any e-commerce product url/i).fill('not-a-url');
  23 |   await page.getByRole('button', { name: 'Analyze' }).click();
  24 | 
  25 |   await expect(page.getByText(/enter a valid url/i)).toBeVisible();
  26 |   await expect(page).toHaveURL(/\/$/);
  27 | });
  28 | 
```