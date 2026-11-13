import { expect, test } from './fixtures.ts';

test.describe('the recipes list View', () => {
	test('shows the first page of seeded recipes, rendered on the server', async ({ page }) => {
		const response = await page.goto('/admin/recipes');

		expect(response?.status()).toBe(200);
		// The records are in the HTML the server sent, not fetched later by the browser.
		const html = (await response?.text()) ?? '';
		expect(html).toContain('Classic Margherita Pizza');
		expect(html).toContain('Lebanese Falafel Wrap');

		await expect(page).toHaveTitle('Recipes');
		await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();

		const rows = page.getByRole('table').getByRole('row');
		// One header row, then the first page: recipes 1 to 25 of 30.
		await expect(rows).toHaveCount(1 + 25);
		await expect(rows.nth(1)).toContainText('Classic Margherita Pizza');
		await expect(rows.nth(1)).toContainText('Pizza, Vegetarian');
		await expect(rows.nth(25)).toContainText('Lebanese Falafel Wrap');
		await expect(page.getByRole('table')).not.toContainText('Brazilian Feijoada');
	});
});
