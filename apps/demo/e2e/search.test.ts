import type { Page } from '@playwright/test';
import { expect, hydrated, test } from './fixtures.ts';
import { backendRequestsFor, captureGetList, dataRows, pager, uniquePage } from './list-helpers.ts';

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search recipes' });

/** The Name cell of each data row. Recipes show their name in the second column. */
const names = (page: Page) => dataRows(page).locator('td:nth-child(2)');

test.describe('searching recipes, which are searchable', () => {
	test('submitting the search form shows only matching recipes, and the URL holds only q', async ({
		page
	}) => {
		await page.goto('/admin/recipes');

		await searchBox(page).fill('pasta');
		await searchBox(page).press('Enter');

		await expect(page).toHaveURL('/admin/recipes?q=pasta');
		await expect(names(page)).toHaveText(['Chicken Alfredo Pasta', 'Shrimp Scampi Pasta']);
		await expect(pager(page)).toContainText('Rows 1–2 of 2');
		await expect(searchBox(page)).toHaveValue('pasta');
	});

	test('searching from page 2 lands on page 1 and keeps the page size', async ({ page }) => {
		await page.goto('/admin/recipes?page=2&perPage=5');

		await searchBox(page).fill('chicken');
		await searchBox(page).press('Enter');

		await expect(page).toHaveURL('/admin/recipes?perPage=5&q=chicken');
		await expect(pager(page)).toContainText('Rows 1–5 of 7');
		await expect(pager(page)).toContainText('Page 1 of 2');
		await expect(names(page)).toHaveText([
			'Chicken Alfredo Pasta',
			'Mango Salsa Chicken',
			'Chicken Biryani',
			'Chicken Karahi',
			'Butter Chicken (Murgh Makhani)'
		]);

		// The pager keeps the search.
		await pager(page).getByRole('link', { name: 'Next' }).click();
		await expect(page).toHaveURL('/admin/recipes?page=2&perPage=5&q=chicken');
		await expect(names(page)).toHaveText(['Chicken Tacos', 'Kung Pao Chicken']);

		// So does a new page size, which starts again at page 1.
		await pager(page).getByRole('link', { name: '10 rows per page' }).click();
		await expect(page).toHaveURL('/admin/recipes?perPage=10&q=chicken');
		await expect(dataRows(page)).toHaveCount(7);
	});

	test('a search from a shared link opens with the search box filled in', async ({ page }) => {
		const response = await page.goto('/admin/recipes?q=PASTA');

		// The matching recipes are in the HTML the server sent.
		const html = (await response?.text()) ?? '';
		expect(html).toContain('Shrimp Scampi Pasta');
		expect(html).not.toContain('Classic Margherita Pizza');
		await expect(searchBox(page)).toHaveValue('PASTA');
		await expect(names(page)).toHaveText(['Chicken Alfredo Pasta', 'Shrimp Scampi Pasta']);
	});

	test('a search that matches nothing says so', async ({ page }) => {
		await page.goto('/admin/recipes?q=durian');

		await expect(dataRows(page)).toHaveText(['No recipes match “durian”.']);
		await expect(pager(page)).toContainText('No rows on this page');
	});

	test('typing shows matching recipes, and Back still leaves the list @js', async ({ page }) => {
		await page.goto('/admin/posts');
		await page.goto('/admin/recipes');
		await hydrated(page);
		const historyLength = await page.evaluate(() => history.length);

		await searchBox(page).pressSequentially('pasta', { delay: 50 });

		await expect(page).toHaveURL('/admin/recipes?q=pasta');
		await expect(names(page)).toHaveText(['Chicken Alfredo Pasta', 'Shrimp Scampi Pasta']);
		await expect(searchBox(page)).toBeFocused();
		await expect(searchBox(page)).toHaveValue('pasta');
		expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(historyLength + 1);

		await page.goBack();
		await expect(page).toHaveURL('/admin/posts');
	});

	test('typing from page 2 lands on page 1 and keeps the page size @js', async ({ page }) => {
		await page.goto('/admin/recipes?page=2&perPage=5');
		await hydrated(page);

		await searchBox(page).pressSequentially('chicken');

		await expect(page).toHaveURL('/admin/recipes?perPage=5&q=chicken');
		await expect(pager(page)).toContainText('Page 1 of 2');
	});

	test('clearing the search box takes q out of the URL @js', async ({ page }) => {
		await page.goto('/admin/recipes?q=pasta');
		await hydrated(page);

		await searchBox(page).clear();

		await expect(page).toHaveURL('/admin/recipes');
		await expect(dataRows(page)).toHaveCount(25);
	});

	test('submitting an empty search names no empty param @js', async ({ page }) => {
		await page.goto('/admin/recipes?perPage=10&q=pasta');
		await hydrated(page);

		await searchBox(page).clear();
		await searchBox(page).press('Enter');

		await expect(page).toHaveURL('/admin/recipes?perPage=10');
		await expect(dataRows(page)).toHaveCount(10);
	});
});

test.describe('posts, which are not searchable', () => {
	test('show no search box, and ignore q in the URL', async ({ page }) => {
		await page.goto('/admin/posts?q=bread');

		await expect(page.getByRole('search')).toHaveCount(0);
		await expect(page.getByRole('searchbox')).toHaveCount(0);
		await expect(dataRows(page)).toHaveCount(25);
	});

	test('drop q from the URL @js', async ({ page }) => {
		await page.goto('/admin/posts?q=bread&page=2');

		await expect(page).toHaveURL('/admin/posts?page=2');
	});
});

test.describe('the getList remote function with a search', () => {
	test('is rejected with a 400 for posts, before the Provider @js', async ({ page, request }) => {
		await page.goto('/admin/posts');
		const call = await captureGetList(page, request, () =>
			pager(page).getByRole('link', { name: 'Next' }).click()
		);
		const marker = uniquePage();

		const response = await call({ page: marker, search: 'bread' });

		expect(await response.json()).toMatchObject({ type: 'error', error: { status: 400 } });
		expect(await backendRequestsFor(request, marker)).toEqual([]);
	});

	test('reaches the Provider as q for recipes, and an empty search is rejected @js', async ({
		page,
		request
	}) => {
		await page.goto('/admin/recipes');
		const call = await captureGetList(page, request, () =>
			pager(page).getByRole('link', { name: 'Next' }).click()
		);
		const marker = uniquePage();

		const empty = await call({ page: marker, search: '' });
		expect(await empty.json()).toMatchObject({ type: 'error', error: { status: 400 } });

		const good = await call({ page: marker, search: 'pasta' });
		expect(await good.json()).toMatchObject({ type: 'result' });
		expect(await backendRequestsFor(request, marker)).toEqual([
			`GET /recipes?page=${marker}&perPage=25&q=pasta`
		]);
	});
});
