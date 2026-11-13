import { expect, test } from './fixtures.ts';

test('opens the admin under /admin', async ({ page }) => {
	await page.goto('/admin');

	await expect(page).toHaveTitle('Svelte Admin');
	await expect(page.getByRole('heading', { level: 1, name: 'Svelte Admin' })).toBeVisible();
});

for (const path of ['/admin/toString', '/admin/constructor', '/admin/nope']) {
	test(`${path} is not a Resource, so it is a 404 page`, async ({ page }) => {
		const response = await page.goto(path);

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
	});
}
