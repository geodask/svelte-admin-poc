import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
	backendRequestsFor,
	captureGetList,
	columnHeader,
	dataRows,
	pager,
	sortArrow,
	sortLink,
	uniquePage
} from './list-helpers.ts';

// Posts open newest first (`defaultSort: { field: 'id', order: 'desc' }`) at 20 rows a page
// (`perPage: 20`); users open in name order. Neither default is ever written to the URL.

/** The ID cell of each data row: the second cell, after the selection checkbox. */
const ids = (page: Page) => dataRows(page).locator('td:nth-child(2)');

/** Check that the posts list is sorted by id, as the ID header says. */
async function expectSortedById(page: Page, order: 'asc' | 'desc', first: string) {
	await expect(ids(page).first()).toHaveText(first);
	await expect(columnHeader(page, 'ID')).toHaveAttribute(
		'aria-sort',
		order === 'asc' ? 'ascending' : 'descending'
	);
	await expect(sortArrow(page, 'ID', order)).toBeVisible();
	await expect(page.locator('th[aria-sort]')).toHaveCount(1);
}

test.describe("a Resource's default sort", () => {
	test('posts open newest first with nothing in the URL, and the ID header says so', async ({
		page
	}) => {
		await page.goto('/admin/posts');

		await expect(page).toHaveURL('/admin/posts');
		await expectSortedById(page, 'desc', '60');
		await expect(ids(page).last()).toHaveText('41');
	});

	test('reaches every page of posts, which the backend pages without a total', async ({ page }) => {
		await page.goto('/admin/posts');

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page).toHaveURL('/admin/posts?page=2');
		await expectSortedById(page, 'desc', '40');
	});

	test('is sent to the backend', async ({ page, request }) => {
		// Pages no other test asks for, so the request log only holds this test's requests.
		const postsPage = uniquePage();
		const usersPage = uniquePage();

		await page.goto(`/admin/posts?page=${postsPage}`);
		await expect(page.getByRole('table')).toContainText('No posts on this page.');
		await page.goto(`/admin/users?page=${usersPage}`);
		await expect(page.getByText('No users on this page.')).toBeVisible();

		expect(await backendRequestsFor(request, postsPage)).toEqual([
			`GET /posts?page=${postsPage}&perPage=20&sort=id&order=desc`
		]);
		expect(await backendRequestsFor(request, usersPage)).toEqual([
			`GET /users?page=${usersPage}&perPage=25&sort=name&order=asc`
		]);
	});

	test('users open in name order with nothing in the URL', async ({ page }) => {
		await page.goto('/admin/users');

		await expect(page).toHaveURL('/admin/users');
		const cards = page.getByRole('list', { name: 'Users' }).getByRole('listitem');
		await expect(cards.getByRole('link')).toHaveText([
			'Ada Lovelace',
			'Alan Turing',
			'Barbara Liskov',
			'Dennis Ritchie',
			'Donald Knuth',
			'Edsger Dijkstra',
			'Frances Allen',
			'Grace Hopper',
			'John McCarthy',
			'Katherine Johnson',
			'Margaret Hamilton',
			'Radia Perlman'
		]);
	});

	test("its own Field's header toggles between the two orders, never unsorted", async ({
		page
	}) => {
		await page.goto('/admin/posts');

		await sortLink(page, 'ID').click();
		await expect(page).toHaveURL('/admin/posts?sort=id');
		await expectSortedById(page, 'asc', '1');

		await sortLink(page, 'ID').click();
		await expect(page).toHaveURL('/admin/posts');
		await expectSortedById(page, 'desc', '60');

		await sortLink(page, 'ID').click();
		await expect(page).toHaveURL('/admin/posts?sort=id');
		await expectSortedById(page, 'asc', '1');
	});

	test('another header cycles ascending, descending, then back to the default', async ({
		page
	}) => {
		await page.goto('/admin/posts');
		const title = columnHeader(page, 'Title');

		await sortLink(page, 'Title').click();
		await expect(page).toHaveURL('/admin/posts?sort=title');
		await expect(title).toHaveAttribute('aria-sort', 'ascending');
		await expect(columnHeader(page, 'ID')).not.toHaveAttribute('aria-sort');
		await expect(ids(page).first()).toHaveText('7');

		await sortLink(page, 'Title').click();
		await expect(page).toHaveURL('/admin/posts?sort=title&order=desc');
		await expect(title).toHaveAttribute('aria-sort', 'descending');
		await expect(ids(page).first()).toHaveText('57');

		await sortLink(page, 'Title').click();
		await expect(page).toHaveURL('/admin/posts');
		await expect(title).not.toHaveAttribute('aria-sort');
		await expectSortedById(page, 'desc', '60');
	});

	test("its own Field's header sorts ascending first when another Field is sorted", async ({
		page
	}) => {
		await page.goto('/admin/posts?sort=title');

		await sortLink(page, 'ID').click();

		await expect(page).toHaveURL('/admin/posts?sort=id');
		await expectSortedById(page, 'asc', '1');
	});

	test('is given to the Provider when getList is asked for no sort @js', async ({
		page,
		request
	}) => {
		await page.goto('/admin/posts');
		const call = await captureGetList(page, request, () =>
			pager(page).getByRole('link', { name: 'Next' }).click()
		);
		const marker = uniquePage();

		const unsorted = await call({ page: marker, sort: undefined });
		expect(await unsorted.json()).toMatchObject({ type: 'result' });
		const sorted = await call({ page: marker, sort: { field: 'title', order: 'asc' } });
		expect(await sorted.json()).toMatchObject({ type: 'result' });

		expect(await backendRequestsFor(request, marker)).toEqual([
			`GET /posts?page=${marker}&perPage=20&sort=id&order=desc`,
			`GET /posts?page=${marker}&perPage=20&sort=title&order=asc`
		]);
	});
});

test.describe("a Resource's own page size", () => {
	test('posts page at 20 rows, which the page-size options offer, without it in the URL', async ({
		page
	}) => {
		await page.goto('/admin/posts');

		await expect(dataRows(page)).toHaveCount(20);
		await expect(pager(page)).toContainText('Rows 1–20');
		const sizes = pager(page).getByRole('link', { name: /rows per page$/ });
		await expect(sizes).toHaveText(['10', '20', '25', '50', '100']);
		await expect(pager(page).getByRole('link', { name: '20 rows per page' })).toHaveAttribute(
			'aria-current',
			'true'
		);

		await pager(page).getByRole('link', { name: '25 rows per page' }).click();
		await expect(page).toHaveURL('/admin/posts?perPage=25');
		await expect(dataRows(page)).toHaveCount(25);

		await pager(page).getByRole('link', { name: '20 rows per page' }).click();
		await expect(page).toHaveURL('/admin/posts');
		await expect(dataRows(page)).toHaveCount(20);
	});

	test('recipes keep the stock page sizes', async ({ page }) => {
		await page.goto('/admin/recipes');

		const sizes = pager(page).getByRole('link', { name: /rows per page$/ });
		await expect(sizes).toHaveText(['10', '25', '50', '100']);
	});
});

test.describe('a list URL that writes out a default', () => {
	const urls = [
		{
			what: 'the default sort',
			url: '/admin/posts?sort=id&order=desc',
			clean: '/admin/posts',
			first: '60'
		},
		{
			what: 'its own page size',
			url: '/admin/posts?perPage=20',
			clean: '/admin/posts',
			first: '60'
		},
		{
			what: 'both, beside a page',
			url: '/admin/posts?perPage=20&sort=id&order=desc&page=2',
			clean: '/admin/posts?page=2',
			first: '40'
		}
	];

	for (const { what, url, first } of urls) {
		test(`still renders the right list for ${what}`, async ({ page }) => {
			await page.goto(url);

			await expectSortedById(page, 'desc', first);
			await expect(dataRows(page)).toHaveCount(20);
		});
	}

	test('is cleaned in place @js', async ({ page }) => {
		for (const { url, clean } of [
			...urls,
			{ url: '/admin/users?sort=name&order=asc', clean: '/admin/users' }
		]) {
			await page.goto(url);
			await expect(page).toHaveURL(clean);
		}
	});
});
