// The demo replaces the users list View with an app route of its own (a card grid) built from
// the core's `createListView` and the Theme's exported parts. Recipes and posts keep the stock
// list View.
import type { Page } from '@playwright/test';
import { expect, hydrated, test } from './fixtures.ts';
import { dataRows, pager } from './list-helpers.ts';

/** The replaced View's cards, one per user on the page. */
const cards = (page: Page) => page.getByRole('list', { name: 'Users' }).getByRole('listitem');

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search users' });

const selectedCount = (page: Page) => page.getByText(/^\d+ selected$/);

const openInSidebar = (page: Page, label: string) =>
	page.getByRole('navigation', { name: 'Resources' }).getByRole('link', { name: label }).click();

test.describe('the replaced users list View', () => {
	test('renders the app’s card grid on the server, not the stock table', async ({ page }) => {
		const response = await page.goto('/admin/users');

		expect(response?.status()).toBe(200);
		expect((await response?.text()) ?? '').toContain('Radia Perlman');
		await expect(page).toHaveTitle('Users');
		await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
		await expect(page.getByRole('table')).toHaveCount(0);
		await expect(cards(page)).toHaveCount(12);
		// Each Field the list shows, by its Kind, through the Theme's Field display.
		await expect(cards(page).first()).toContainText('Ada Lovelace');
		await expect(cards(page).first()).toContainText('ada@example.com');
		await expect(cards(page).first()).toContainText('admin');
		await expect(cards(page).first()).toContainText('Jan 15, 2023');
		await expect(cards(page).nth(3)).toContainText('No');
	});

	test('recipes and posts still render the stock list View', async ({ page }) => {
		await page.goto('/admin/recipes');
		await expect(dataRows(page)).toHaveCount(25);
		await expect(cards(page)).toHaveCount(0);

		await page.goto('/admin/posts');
		await expect(dataRows(page)).toHaveCount(25);
		await expect(cards(page)).toHaveCount(0);
	});

	test('a card links to the user’s detail View', async ({ page }) => {
		await page.goto('/admin/users');

		await cards(page).first().getByRole('link', { name: 'Ada Lovelace' }).click();

		await expect(page).toHaveURL('/admin/users/1');
		await expect(page.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeVisible();
	});

	test('searching through the exported toolbar keeps the stock URL params', async ({ page }) => {
		await page.goto('/admin/users?page=2&perPage=5');

		await searchBox(page).fill('grace');
		await searchBox(page).press('Enter');

		await expect(page).toHaveURL('/admin/users?perPage=5&q=grace');
		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('Grace Hopper');
		await expect(searchBox(page)).toHaveValue('grace');
	});

	test('a search from a shared link finds users by name or email', async ({ page }) => {
		await page.goto('/admin/users?q=grace');

		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('Grace Hopper');
		await expect(cards(page).first()).toContainText('grace@example.com');
		await expect(searchBox(page)).toHaveValue('grace');

		await page.goto('/admin/users?q=radia%40example');
		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('Radia Perlman');
	});

	test('a search that matches nothing says so', async ({ page }) => {
		await page.goto('/admin/users?q=nobody');

		await expect(cards(page)).toHaveText(['No users match “nobody”.']);
		await expect(pager(page)).toContainText('No rows on this page');
	});

	test('the exported pager changes page and page size with the stock URL params', async ({
		page
	}) => {
		await page.goto('/admin/users');
		await expect(pager(page)).toContainText('Rows 1–12 of 12');

		await pager(page).getByRole('link', { name: '10 rows per page' }).click();

		await expect(page).toHaveURL('/admin/users?perPage=10');
		await expect(cards(page)).toHaveCount(10);
		await expect(pager(page)).toContainText('Page 1 of 2');

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page).toHaveURL('/admin/users?page=2&perPage=10');
		await expect(cards(page)).toHaveCount(2);
		await expect(cards(page).first()).toContainText('John McCarthy');
		await expect(pager(page)).toContainText('Rows 11–12 of 12');

		await pager(page).getByRole('link', { name: '25 rows per page' }).click();
		await expect(page).toHaveURL('/admin/users');
		await expect(cards(page)).toHaveCount(12);
	});

	test('typing a search updates the cards and the URL in place @js', async ({ page }) => {
		await page.goto('/admin/users');
		await hydrated(page);

		await searchBox(page).pressSequentially('radia');

		await expect(page).toHaveURL('/admin/users?q=radia');
		await expect(cards(page)).toHaveCount(1);
		await expect(cards(page).first()).toContainText('Radia Perlman');
	});

	test('drops bad and unknown params from the URL, as the stock View does @js', async ({
		page
	}) => {
		await page.goto('/admin/users?perPage=abc&sort=name&page=1');

		await expect(page).toHaveURL('/admin/users');
		await expect(cards(page)).toHaveCount(12);
	});
});

test.describe('selection on the replaced users list View @js', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/users');
		await hydrated(page);
	});

	test('counts the users selected with the exported checkbox', async ({ page }) => {
		await page.getByRole('checkbox', { name: 'Select Ada Lovelace' }).check();
		await page.getByRole('checkbox', { name: 'Select Grace Hopper' }).check();

		await expect(selectedCount(page)).toHaveText('2 selected');

		await page.getByRole('checkbox', { name: 'Select Ada Lovelace' }).uncheck();

		await expect(selectedCount(page)).toHaveText('1 selected');
	});

	test('carries no selection into another Resource, or back', async ({ page }) => {
		// Users 1 and 2: posts 1 and 2 have the same ids.
		await page.getByRole('checkbox', { name: 'Select Ada Lovelace' }).check();
		await page.getByRole('checkbox', { name: 'Select Grace Hopper' }).check();
		await expect(selectedCount(page)).toHaveText('2 selected');

		await openInSidebar(page, 'Posts');

		await expect(page.getByRole('heading', { level: 1, name: 'Posts' })).toBeVisible();
		await expect(dataRows(page)).toHaveCount(25);
		await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);
		await expect(selectedCount(page)).toHaveCount(0);

		await openInSidebar(page, 'Users');

		await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
		await expect(cards(page)).toHaveCount(12);
		await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);
		await expect(selectedCount(page)).toHaveCount(0);
	});
});
