import type { Page } from '@playwright/test';
import { expect, hydrated, test } from './fixtures.ts';
import {
	backendRequestsDuring,
	backendRequestsFor,
	captureGetList,
	columnCells,
	columnHeader,
	dataRows,
	pager,
	selectedCount,
	uniquePage
} from './list-helpers.ts';

/** The Name cell of each data row: the third cell, after the selection checkbox and the ID. */
const names = (page: Page) => dataRows(page).locator('td:nth-child(3)');

/** The arrow a sorted column's header shows for its direction. */
const arrow = (page: Page, label: string, order: 'asc' | 'desc') =>
	columnHeader(page, label).locator(
		order === 'asc' ? 'svg.lucide-arrow-up' : 'svg.lucide-arrow-down'
	);

/** The link in a sortable Field's column header, which sorts the list by it. */
const sortLink = (page: Page, label: string) =>
	columnHeader(page, label).getByRole('link', { name: label, exact: true });

test.describe('sorting recipes by a Field, from its column header', () => {
	test('a header sorts the whole list on the server, across pages', async ({ page, request }) => {
		// A page size no other test asks for, one per project, so the request log check below only
		// finds this test's requests. With 55 recipes the last page is page 8 at 7 rows a page, and
		// page 7 at 8.
		const perPage = test.info().project.name === 'js' ? 7 : 8;
		const lastPage = {
			7: { page: 8, first: 'Swedish Meatballs' },
			8: { page: 7, first: 'Spanish Paella' }
		}[perPage];
		await page.goto(`/admin/recipes?perPage=${perPage}`);
		const query = (n: number) => `GET /recipes?page=${n}&perPage=${perPage}&sort=name&order=asc`;

		const sorted = await backendRequestsDuring(request, async () => {
			await sortLink(page, 'Name').click();
			await expect(page).toHaveURL(`/admin/recipes?perPage=${perPage}&sort=name`);
			await expect(names(page).first()).toHaveText('Aloo Keema');
		});
		expect(sorted).toContain(query(1));

		// The pager keeps the sort, so the last page holds the end of the whole sorted list.
		const last = await backendRequestsDuring(request, async () => {
			await pager(page).getByRole('link', { name: 'Last' }).click();
			await expect(page).toHaveURL(
				`/admin/recipes?page=${lastPage.page}&perPage=${perPage}&sort=name`
			);
			await expect(names(page).first()).toHaveText(lastPage.first);
			await expect(names(page).last()).toHaveText('Vietnamese Pho');
		});
		expect(last).toContain(query(lastPage.page));
	});

	test('a number header sorts numbers as numbers, descending on the second click', async ({
		page
	}) => {
		await page.goto('/admin/recipes?sort=prepTimeMinutes');
		await expect(names(page).first()).toHaveText('Caprese Salad');

		await sortLink(page, 'Prep time (min)').click();

		await expect(page).toHaveURL('/admin/recipes?sort=prepTimeMinutes&order=desc');
		await expect(names(page).first()).toHaveText('Pierogi');
	});

	test('a header cycles ascending, descending, then unsorted, and says which', async ({ page }) => {
		await page.goto('/admin/recipes');
		const header = columnHeader(page, 'Name');
		await expect(page.locator('th[aria-sort]')).toHaveCount(0);

		await sortLink(page, 'Name').click();
		await expect(page).toHaveURL('/admin/recipes?sort=name');
		await expect(header).toHaveAttribute('aria-sort', 'ascending');
		await expect(arrow(page, 'Name', 'asc')).toBeVisible();
		await expect(page.locator('th[aria-sort]')).toHaveCount(1);

		await sortLink(page, 'Name').click();
		await expect(page).toHaveURL('/admin/recipes?sort=name&order=desc');
		await expect(header).toHaveAttribute('aria-sort', 'descending');
		await expect(arrow(page, 'Name', 'desc')).toBeVisible();
		await expect(arrow(page, 'Name', 'asc')).toHaveCount(0);
		await expect(names(page).first()).toHaveText('Vietnamese Pho');

		await sortLink(page, 'Name').click();
		await expect(page).toHaveURL('/admin/recipes');
		await expect(header).not.toHaveAttribute('aria-sort');
		await expect(arrow(page, 'Name', 'desc')).toHaveCount(0);
		await expect(names(page).first()).toHaveText('Classic Margherita Pizza');
	});

	test('sorting by another header replaces the sort', async ({ page }) => {
		await page.goto('/admin/recipes?sort=name&order=desc');

		await sortLink(page, 'Published at').click();
		await expect(page).toHaveURL('/admin/recipes?sort=publishedAt');
		await expect(columnHeader(page, 'Name')).not.toHaveAttribute('aria-sort');
		await expect(columnHeader(page, 'Published at')).toHaveAttribute('aria-sort', 'ascending');

		// Newest first: the seed publishes recipes a week apart, in id order.
		await sortLink(page, 'Published at').click();
		await expect(page).toHaveURL('/admin/recipes?sort=publishedAt&order=desc');
		await expect(names(page).first()).toHaveText('Mapo Tofu');
	});

	test('only sortable Fields have header links', async ({ page }) => {
		await page.goto('/admin/recipes');

		for (const label of ['Name', 'Prep time (min)', 'Calories', 'Published at']) {
			await expect(sortLink(page, label)).toHaveCount(1);
		}
		for (const label of ['ID', 'Cuisine', 'Difficulty', 'Servings', 'Vegetarian', 'Tags']) {
			await expect(columnHeader(page, label)).toHaveCount(1);
			await expect(columnHeader(page, label).getByRole('link')).toHaveCount(0);
		}
	});

	test('recipes without calories come last, ascending and descending', async ({ page }) => {
		// 55 recipes, 18 of them without a calorie count, all on one page.
		await page.goto('/admin/recipes?perPage=100');

		for (const [order, first] of [
			['asc', 'Classic Margherita Pizza'],
			['desc', 'Mapo Tofu']
		] as const) {
			await sortLink(page, 'Calories').click();
			await expect(arrow(page, 'Calories', order)).toBeVisible();
			await expect(names(page).first()).toHaveText(first);
			const calories = await (await columnCells(page, 'Calories')).allInnerTexts();
			expect(calories).toHaveLength(55);
			expect(calories.slice(0, 37).every((text) => text.trim() !== '')).toBe(true);
			expect(calories.slice(37).every((text) => text.trim() === '')).toBe(true);
		}
	});

	test('a sort starts at page 1 and keeps the search and the page size', async ({ page }) => {
		await page.goto('/admin/recipes?page=2&perPage=5&q=chicken');

		await sortLink(page, 'Name').click();

		await expect(page).toHaveURL('/admin/recipes?perPage=5&sort=name&q=chicken');
		await expect(names(page)).toHaveText([
			'Butter Chicken (Murgh Makhani)',
			'Chicken Alfredo Pasta',
			'Chicken Biryani',
			'Chicken Karahi',
			'Chicken Tacos'
		]);

		// A new search keeps the sort and the page size in turn.
		const searchBox = page.getByRole('searchbox', { name: 'Search recipes' });
		await searchBox.fill('pasta');
		await searchBox.press('Enter');
		await expect(page).toHaveURL('/admin/recipes?perPage=5&sort=name&q=pasta');
		await expect(names(page)).toHaveText(['Chicken Alfredo Pasta', 'Shrimp Scampi Pasta']);

		// So does a new page size.
		await pager(page).getByRole('link', { name: '10 rows per page' }).click();
		await expect(page).toHaveURL('/admin/recipes?perPage=10&sort=name&q=pasta');
	});

	test('selected rows stay selected across a sort @js', async ({ page }) => {
		await page.goto('/admin/recipes');
		await hydrated(page);
		await page.getByRole('checkbox', { name: 'Select Classic Margherita Pizza' }).check();
		await page.getByRole('checkbox', { name: 'Select Aloo Keema' }).check();

		await sortLink(page, 'Name').click();
		await expect(page).toHaveURL('/admin/recipes?sort=name');

		await expect(selectedCount(page)).toHaveText('2 selected');
		await expect(page.getByRole('checkbox', { name: 'Select Aloo Keema' })).toBeChecked();
	});
});

test.describe('a list URL with a sort it cannot use', () => {
	for (const [what, search, first] of [
		[
			'a sort on a Field that is not sortable',
			'?sort=cuisine&order=desc&page=2',
			'Brazilian Feijoada'
		],
		['an order without a sort', '?order=desc', 'Classic Margherita Pizza'],
		['order=asc, the default', '?sort=name&order=asc', 'Aloo Keema']
	]) {
		test(`still renders the right list for ${what}`, async ({ page }) => {
			const response = await page.goto(`/admin/recipes${search}`);

			// Rendered on the server, with or without JavaScript.
			expect(await response?.text()).toContain(first);
			await expect(names(page).first()).toHaveText(first);
		});
	}

	test('is cleaned in place @js', async ({ page }) => {
		for (const [search, clean] of [
			['?sort=cuisine&order=desc&page=2', '/admin/recipes?page=2'],
			['?sort=rating', '/admin/recipes'],
			['?order=desc', '/admin/recipes'],
			['?sort=name&order=asc', '/admin/recipes?sort=name']
		]) {
			await page.goto(`/admin/recipes${search}`);
			await expect(page).toHaveURL(clean);
		}
	});
});

test.describe('sorting posts, which the backend pages without a total', () => {
	test('a sort reaches every page, with next and previous', async ({ page }) => {
		await page.goto('/admin/posts?sort=id&order=desc');
		await expect(dataRows(page).first().locator('td:nth-child(2)')).toHaveText('60');

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page).toHaveURL('/admin/posts?page=2&sort=id&order=desc');
		await expect(dataRows(page).first().locator('td:nth-child(2)')).toHaveText('35');
		await expect(columnHeader(page, 'ID')).toHaveAttribute('aria-sort', 'descending');
	});
});

test.describe('the getList remote function with a sort', () => {
	test('is rejected on a Field that is not sortable, before the Provider @js', async ({
		page,
		request
	}) => {
		await page.goto('/admin/recipes');
		const call = await captureGetList(page, request, () =>
			pager(page).getByRole('link', { name: 'Next' }).click()
		);
		const marker = uniquePage();

		for (const sort of [
			{ field: 'cuisine', order: 'asc' },
			{ field: 'rating', order: 'asc' },
			{ field: 'name', order: 'up' }
		]) {
			const rejected = await call({ page: marker, sort });
			expect(await rejected.json()).toMatchObject({ type: 'error', error: { status: 400 } });
		}
		expect(await backendRequestsFor(request, marker)).toEqual([]);

		const good = await call({ page: marker, sort: { field: 'name', order: 'desc' } });
		expect(await good.json()).toMatchObject({ type: 'result' });
		expect(await backendRequestsFor(request, marker)).toEqual([
			`GET /recipes?page=${marker}&perPage=25&sort=name&order=desc`
		]);
	});
});
