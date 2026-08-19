import { expect, test } from '@playwright/test';

test('User Story 1: analyze a URL and see live progress then results', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder(/paste any e-commerce product url/i).fill('https://e2e-golden-path.example.com');
  await page.getByRole('button', { name: 'Analyze' }).click();

  // Live status tracker renders immediately while the analysis runs.
  await expect(page.getByText('Fetching page')).toBeVisible();

  // The app auto-navigates to the results page once the run completes.
  await page.waitForURL(/\/runs\/.+/, { timeout: 10_000 });

  await expect(page.getByText('Overall SEO score')).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();
});

test('an invalid URL shows an inline error and does not navigate away', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder(/paste any e-commerce product url/i).fill('not-a-url');
  await page.getByRole('button', { name: 'Analyze' }).click();

  await expect(page.getByText(/enter a valid url/i)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
