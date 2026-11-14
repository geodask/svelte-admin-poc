import { expect, test } from './fixtures.ts';

test('/admin opens the first Resource list', async ({ page }) => {
	await page.goto('/admin');

	await expect(page).toHaveURL('/admin/recipes');
	await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
});

for (const path of ['/admin/toString', '/admin/constructor', '/admin/nope']) {
	test(`${path} is not a Resource, so it is a 404 page`, async ({ page }) => {
		const response = await page.goto(path);

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
	});
}
