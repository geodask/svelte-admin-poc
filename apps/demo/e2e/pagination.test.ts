import type { Page } from '@playwright/test';
import { BACKEND_URL } from '../backend/config.ts';
import { expect, test } from './fixtures.ts';

/** The data rows of the list View's table, without its header row. */
const dataRows = (page: Page) =>
	page
		.getByRole('table')
		.getByRole('row')
		.filter({ has: page.getByRole('cell') });

const pager = (page: Page) => page.getByRole('navigation', { name: 'Pagination' });

test.describe('paging through recipes, which the backend counts', () => {
	test('the pager opens page 2, and the URL holds it', async ({ page }) => {
		await page.goto('/admin/recipes');
		await expect(pager(page)).toContainText('Rows 1–25 of 55');
		await expect(pager(page)).toContainText('Page 1 of 3');

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page).toHaveURL('/admin/recipes?page=2');
		await expect(dataRows(page)).toHaveCount(25);
		await expect(dataRows(page).first()).toContainText('Brazilian Feijoada');
		await expect(dataRows(page).last()).toContainText('Guacamole');
		await expect(pager(page)).toContainText('Rows 26–50 of 55');
		await expect(pager(page)).toContainText('Page 2 of 3');
	});

	test('first, previous, next and last link where they can go', async ({ page }) => {
		await page.goto('/admin/recipes');
		await expect(pager(page).getByRole('link', { name: 'First' })).toHaveCount(0);
		await expect(pager(page).getByRole('link', { name: 'Previous' })).toHaveCount(0);

		await pager(page).getByRole('link', { name: 'Last' }).click();

		await expect(page).toHaveURL('/admin/recipes?page=3');
		await expect(dataRows(page)).toHaveCount(5);
		await expect(dataRows(page).last()).toContainText('Mapo Tofu');
		await expect(pager(page).getByRole('link', { name: 'Next' })).toHaveCount(0);
		await expect(pager(page).getByRole('link', { name: 'Last' })).toHaveCount(0);

		await pager(page).getByRole('link', { name: 'Previous' }).click();
		await expect(page).toHaveURL('/admin/recipes?page=2');

		await pager(page).getByRole('link', { name: 'First' }).click();
		await expect(page).toHaveURL('/admin/recipes');
		await expect(dataRows(page).first()).toContainText('Classic Margherita Pizza');
	});

	test('a page size updates the URL and the row count, and the defaults stay out of the URL', async ({
		page
	}) => {
		await page.goto('/admin/recipes?page=2');

		await pager(page).getByRole('link', { name: '10 rows per page' }).click();

		// A new page size starts again at page 1.
		await expect(page).toHaveURL('/admin/recipes?perPage=10');
		await expect(dataRows(page)).toHaveCount(10);
		await expect(pager(page)).toContainText('Page 1 of 6');
		await expect(pager(page).getByRole('link', { name: '10 rows per page' })).toHaveAttribute(
			'aria-current',
			'true'
		);

		await pager(page).getByRole('link', { name: 'Next' }).click();
		await expect(page).toHaveURL('/admin/recipes?page=2&perPage=10');
		await expect(dataRows(page).first()).toContainText('Chicken Biryani');

		await pager(page).getByRole('link', { name: '25 rows per page' }).click();
		await expect(page).toHaveURL('/admin/recipes');
		await expect(dataRows(page)).toHaveCount(25);
	});

	test('an old link past the last page still links back to the last page', async ({ page }) => {
		await page.goto('/admin/recipes?page=10');

		await expect(page.getByRole('table')).toContainText('No recipes on this page.');
		await expect(pager(page)).toContainText('No rows on this page');
		await expect(pager(page)).toContainText('Page 10 of 3');
		await expect(pager(page).getByRole('link', { name: 'Next' })).toHaveCount(0);

		await pager(page).getByRole('link', { name: 'Last' }).click();

		await expect(page).toHaveURL('/admin/recipes?page=3');
		await expect(dataRows(page)).toHaveCount(5);
	});

	test('a page size from a shared link opens that page size', async ({ page }) => {
		await page.goto('/admin/recipes?page=2&perPage=50');

		await expect(dataRows(page)).toHaveCount(5);
		await expect(dataRows(page).first()).toContainText('Clam Chowder');
		await expect(pager(page)).toContainText('Page 2 of 2');
	});
});

test.describe('paging through posts, which the backend cannot count', () => {
	test('shows only previous and next, and next is absent on the last page', async ({ page }) => {
		await page.goto('/admin/posts');

		await expect(dataRows(page)).toHaveCount(25);
		await expect(pager(page)).toContainText('Rows 1–25');
		await expect(pager(page)).not.toContainText(' of ');
		await expect(pager(page).getByRole('link')).toHaveText(['10', '25', '50', '100', 'Next']);

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page).toHaveURL('/admin/posts?page=2');
		await expect(pager(page)).toContainText('Rows 26–50');
		await expect(pager(page).getByRole('link')).toHaveText([
			'10',
			'25',
			'50',
			'100',
			'Previous',
			'Next'
		]);

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page).toHaveURL('/admin/posts?page=3');
		await expect(dataRows(page)).toHaveCount(10);
		await expect(pager(page)).toContainText('Rows 51–60');
		await expect(pager(page).getByRole('link')).toHaveText(['10', '25', '50', '100', 'Previous']);
	});
});

test.describe('an old link with bad or unknown params', () => {
	test('opens page 1 on the server', async ({ page }) => {
		const response = await page.goto('/admin/recipes?page=abc&perPage=1000&foo=1');

		expect(response?.status()).toBe(200);
		await expect(dataRows(page)).toHaveCount(25);
		await expect(dataRows(page).first()).toContainText('Classic Margherita Pizza');
	});

	test('rewrites the URL without them, adding no history entry @js', async ({ page, context }) => {
		const clean = await context.newPage();
		await clean.goto('/admin/recipes');
		const historyLength = await clean.evaluate(() => history.length);

		await page.goto('/admin/recipes?page=abc&foo=1');

		await expect(page).toHaveURL('/admin/recipes');
		await expect(dataRows(page).first()).toContainText('Classic Margherita Pizza');
		expect(await page.evaluate(() => history.length)).toBe(historyLength);
	});

	test('keeps good params while it drops the rest @js', async ({ page }) => {
		await page.goto('/admin/recipes?foo=1&page=2&perPage=1000');

		await expect(page).toHaveURL('/admin/recipes?page=2');
		await expect(dataRows(page).first()).toContainText('Brazilian Feijoada');
	});
});

test.describe('the getList remote function', () => {
	/**
	 * Re-encode a captured remote query payload with some args changed. A payload is Kit's
	 * url-safe base64 of a devalue array, where an object maps each key to the index of its value.
	 */
	function withArgs(payload: string, changes: Record<string, unknown>): string {
		const nodes = JSON.parse(Buffer.from(payload, 'base64url').toString()) as unknown[];
		const args = nodes.find(
			(node): node is Record<string, number> =>
				typeof node === 'object' && node !== null && !Array.isArray(node) && 'perPage' in node
		);
		if (!args) throw new Error(`No list params in the payload ${JSON.stringify(nodes)}`);
		for (const [key, value] of Object.entries(changes)) {
			args[key] = nodes.push(value) - 1;
		}
		return Buffer.from(JSON.stringify(nodes)).toString('base64url');
	}

	test('rejects a page size over the cap or an unknown key with a 400, before the Provider @js', async ({
		page,
		request
	}) => {
		// Kit names remote functions by a hash, so learn the URL from the browser's own request.
		await page.goto('/admin/recipes');
		// Wait for the response, so the browser's own call is done before the backend is reset.
		const remoteResponse = page.waitForResponse((r) => r.url().includes('/_app/remote/'));
		await pager(page).getByRole('link', { name: 'Next' }).click();
		const captured = new URL((await remoteResponse).url());
		const payload = captured.searchParams.get('payload') ?? '';
		const call = (changes: Record<string, unknown>) =>
			request.get(`${captured.pathname}?payload=${withArgs(payload, changes)}`);

		await request.post(`${BACKEND_URL}/reset`);

		for (const changes of [{ perPage: 101 }, { foo: 1 }, { limit: 100000 }]) {
			const response = await call(changes);
			// A remote query answers with the error's status in its body.
			expect(await response.json(), JSON.stringify(changes)).toMatchObject({
				type: 'error',
				error: { status: 400 }
			});
		}
		const providerCalls = await request.get(`${BACKEND_URL}/requests`);
		expect(await providerCalls.json()).toEqual([]);

		// A good call does reach the Provider, so the empty log above means something.
		const good = await call({ perPage: 100 });
		expect(await good.json()).toMatchObject({ type: 'result' });
		const afterGood = await request.get(`${BACKEND_URL}/requests`);
		expect(await afterGood.json()).toEqual(['GET /recipes?page=2&perPage=100']);
	});
});
