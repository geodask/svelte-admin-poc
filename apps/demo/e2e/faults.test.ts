// Tests that make the demo backend slow or fail. Faults are global to the backend, so this file
// runs in its own Playwright project, with one worker, after every other test (see
// playwright.config.ts). Every test here needs JavaScript.
import type { Page } from '@playwright/test';
import { expect, hydrated, injectFault, test } from './fixtures.ts';
import { dataRows, pager } from './list-helpers.ts';
import { serverLog } from './server-log.ts';

const loadError = (page: Page) => page.getByRole('alert');

/** Mark the window, so a test can tell a full page reload (which loses the mark) from none. */
async function markWindow(page: Page) {
	await page.evaluate(() => Object.assign(window, { __noReload: true }));
}

async function reloaded(page: Page) {
	return !(await page.evaluate(() => (window as { __noReload?: boolean }).__noReload === true));
}

test.describe('a transient backend error on the recipes list', () => {
	test('shows the error message, and Retry shows the records without a full reload', async ({
		page,
		request
	}) => {
		await injectFault(request, { status: 500, path: '/recipes' });

		await page.goto('/admin/recipes');

		await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
		await expect(loadError(page)).toContainText("Couldn't load recipes");
		await expect(loadError(page)).toContainText('An unexpected error occurred.');
		await expect(dataRows(page)).toHaveCount(0);
		// The search box stays outside the failure, so the search can still be changed.
		await expect(page.getByRole('searchbox', { name: 'Search recipes' })).toBeVisible();

		await hydrated(page);
		await markWindow(page);
		await loadError(page).getByRole('button', { name: 'Retry' }).click();

		await expect(dataRows(page)).toHaveCount(25);
		await expect(dataRows(page).first()).toContainText('Classic Margherita Pizza');
		await expect(loadError(page)).toHaveCount(0);
		expect(await reloaded(page)).toBe(false);
	});

	test('during a page change shows the error, and Retry loads that page', async ({
		page,
		request
	}) => {
		await page.goto('/admin/recipes');
		await hydrated(page);
		await markWindow(page);
		await injectFault(request, { status: 503, path: '/recipes' });

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page).toHaveURL('/admin/recipes?page=2');
		await expect(loadError(page)).toContainText("Couldn't load recipes");

		await loadError(page).getByRole('button', { name: 'Retry' }).click();

		await expect(dataRows(page).first()).toContainText('Brazilian Feijoada');
		await expect(pager(page)).toContainText('Page 2 of 3');
		expect(await reloaded(page)).toBe(false);
	});

	test('shows no stack trace or upstream text, and the server logs the error', async ({
		page,
		request
	}) => {
		const marker = `Disk full on shard ${crypto.randomUUID()}`;
		await injectFault(request, { status: 500, message: marker, path: '/recipes' });

		await page.goto('/admin/recipes');
		await expect(loadError(page)).toContainText('An unexpected error occurred.');

		const html = await page.content();
		for (const leak of [marker, 'REST Provider', 'localhost:4100', 'rest.ts', '    at ']) {
			expect(html).not.toContain(leak);
		}
		// The server log has the unexpected error, with what the backend said.
		await expect.poll(serverLog).toContain(marker);
		await expect.poll(serverLog).toMatch(/REST Provider: GET \S+\/recipes\S* failed with 500/);
	});
});

test.describe('a transient backend error on a recipe', () => {
	test('shows the error under the link back to the list, and Retry shows the record', async ({
		page,
		request
	}) => {
		await injectFault(request, { status: 500, path: '/recipes/2' });

		await page.goto('/admin/recipes/2');

		await expect(
			page.getByRole('heading', { level: 1, name: "Couldn't load this record" })
		).toBeVisible();
		await expect(page.getByRole('link', { name: 'Recipes' })).toHaveAttribute(
			'href',
			'/admin/recipes'
		);

		await hydrated(page);
		await markWindow(page);
		await loadError(page).getByRole('button', { name: 'Retry' }).click();

		await expect(
			page.getByRole('heading', { level: 1, name: 'Vegetarian Stir-Fry' })
		).toBeVisible();
		await expect(loadError(page)).toHaveCount(0);
		expect(await reloaded(page)).toBe(false);
	});
});

test.describe('the recipes list refreshing after a page change', () => {
	test('shows the refresh indicator and keeps the old rows until the new ones arrive', async ({
		page,
		request
	}) => {
		await page.goto('/admin/recipes');
		await hydrated(page);
		await expect(page.getByRole('status')).toHaveCount(0);
		await injectFault(request, { delayMs: 1500, path: '/recipes' });

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page.getByRole('status')).toHaveText('Refreshing…');
		await expect(dataRows(page).first()).toContainText('Classic Margherita Pizza');
		await expect(dataRows(page)).toHaveCount(25);

		await expect(dataRows(page).first()).toContainText('Brazilian Feijoada');
		await expect(page.getByRole('status')).toHaveCount(0);
	});
});
