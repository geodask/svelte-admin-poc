import type { Page } from '@playwright/test';
import { expect, hydrated, test } from './fixtures.ts';
import { dataRows, pager, sortLink } from './list-helpers.ts';

/**
 * Open a page so that its hydration is still unfinished once Kit's router has started: the
 * modules the page imports after that (each Resource's remote module, a Reference's target) are
 * slowed down, as on a slow network. Kit starts its router with a `replaceState`, which is the
 * main frame's second navigation, so every script chunk requested from then on is held back.
 * Resolves as soon as the router has started, while hydration still waits for those modules.
 */
async function openBeforeHydration(page: Page, path: string) {
	let navigations = 0;
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) navigations += 1;
	});
	await page.route('**/_app/immutable/chunks/**', async (route) => {
		if (navigations >= 2) await new Promise((resolve) => setTimeout(resolve, 500));
		await route.continue();
	});
	await page.goto(path);
	await expect.poll(() => navigations, { intervals: [5] }).toBeGreaterThanOrEqual(2);
	await expect(page.locator('html[data-hydrated]')).toHaveCount(0);
}

/** Slow down the list's remote queries, as on a slow network, so a new page of records takes a while. */
async function slowLists(page: Page) {
	await page.route('**/_app/remote/**', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 500));
		await route.continue();
	});
}

// A person can click a list link as soon as the server-rendered page shows, before it has
// hydrated (on a slow device or network). Kit's router handles the click once it has started,
// which is before the page's async hydration (its awaits) has finished. A client-side navigation
// started then leaves the page broken: the URL changes but the list doesn't, or the page freezes.
test.describe('a list link clicked before the page has hydrated @js', () => {
	test('a sort header sorts the list', async ({ page }) => {
		await openBeforeHydration(page, '/admin/recipes');

		await sortLink(page, 'Name').click();

		await expect(page).toHaveURL('/admin/recipes?sort=name');
		await expect(dataRows(page).first()).toContainText('Aloo Keema');
	});

	test('the pager opens the next page', async ({ page }) => {
		await openBeforeHydration(page, '/admin/recipes?perPage=10');

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page).toHaveURL('/admin/recipes?page=2&perPage=10');
		await expect(dataRows(page).first()).toContainText('Chicken Biryani');
	});

	test('a page size changes the row count', async ({ page }) => {
		await openBeforeHydration(page, '/admin/recipes');

		await pager(page).getByRole('link', { name: '10 rows per page' }).click();

		await expect(page).toHaveURL('/admin/recipes?perPage=10');
		await expect(dataRows(page)).toHaveCount(10);
	});
});

// A second click can land while the first click's page is still loading. Kit applies the second
// navigation straight away, before the first has rendered, which leaves the page broken the same
// way: the second click is lost, or the page freezes.
test.describe('a list link clicked while the previous page is still loading @js', () => {
	test('the page size applies after the pager', async ({ page }) => {
		await page.goto('/admin/recipes?perPage=5');
		await hydrated(page);
		await slowLists(page);

		await pager(page).getByRole('link', { name: 'Next' }).click();
		await expect(page).toHaveURL('/admin/recipes?page=2&perPage=5');
		await pager(page).getByRole('link', { name: '10 rows per page' }).click();

		await expect(page).toHaveURL('/admin/recipes?perPage=10');
		await expect(dataRows(page)).toHaveCount(10);
	});

	test('a sort header applies after the pager', async ({ page }) => {
		await page.goto('/admin/recipes?perPage=5');
		await hydrated(page);
		await slowLists(page);

		await pager(page).getByRole('link', { name: 'Next' }).click();
		await expect(page).toHaveURL('/admin/recipes?page=2&perPage=5');
		await sortLink(page, 'Name').click();

		await expect(page).toHaveURL('/admin/recipes?perPage=5&sort=name');
		await expect(dataRows(page).first()).toContainText('Aloo Keema');
	});
});
