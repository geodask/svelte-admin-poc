import { expect, test } from '@playwright/test';

test('opens the admin under /admin', async ({ page }) => {
	await page.goto('/admin');

	await expect(page).toHaveTitle('Svelte Admin');
	await expect(page.getByRole('heading', { level: 1, name: 'Svelte Admin' })).toBeVisible();
});
