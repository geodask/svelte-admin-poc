import type { Page } from '@playwright/test';
import { expect, hydrated, test } from './fixtures.ts';
import { dataRows, pager } from './list-helpers.ts';

/** The checkbox that selects one row, by its record's Record title. */
const rowCheckbox = (page: Page, title: string) =>
	page.getByRole('checkbox', { name: `Select ${title}` });

const headerCheckbox = (page: Page) =>
	page.getByRole('checkbox', { name: 'Select all on this page' });

/** The rows whose checkbox is ticked. */
const selectedRows = (page: Page) =>
	dataRows(page).filter({ has: page.getByRole('checkbox', { checked: true }) });

const selectedCount = (page: Page) => page.getByText(/^\d+ selected$/);

const openInSidebar = (page: Page, label: string) =>
	page.getByRole('navigation', { name: 'Resources' }).getByRole('link', { name: label }).click();

test.describe('row selection @js', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/admin/recipes');
		await hydrated(page);
	});

	test('counts the rows selected with their checkboxes', async ({ page }) => {
		await rowCheckbox(page, 'Classic Margherita Pizza').check();
		await rowCheckbox(page, 'Vegetarian Stir-Fry').check();

		await expect(selectedCount(page)).toHaveText('2 selected');
		await expect(selectedRows(page)).toHaveCount(2);

		await rowCheckbox(page, 'Classic Margherita Pizza').uncheck();

		await expect(selectedCount(page)).toHaveText('1 selected');
		await expect(selectedRows(page)).toHaveCount(1);
	});

	test('selects and clears every row on the page from the header', async ({ page }) => {
		await rowCheckbox(page, 'Classic Margherita Pizza').check();
		// Some rows on the page are selected, but not all.
		await expect(headerCheckbox(page)).toBeChecked({ indeterminate: true });

		await headerCheckbox(page).check();

		await expect(selectedRows(page)).toHaveCount(25);
		await expect(selectedCount(page)).toHaveText('25 selected');
		await expect(headerCheckbox(page)).toBeChecked();

		await headerCheckbox(page).uncheck();

		await expect(selectedRows(page)).toHaveCount(0);
		await expect(selectedCount(page)).toHaveCount(0);
		await expect(headerCheckbox(page)).not.toBeChecked();
	});

	test('keeps the selection while paging through the same Resource', async ({ page }) => {
		await headerCheckbox(page).check();

		await pager(page).getByRole('link', { name: 'Next' }).click();

		await expect(page).toHaveURL('/admin/recipes?page=2');
		// The next page's rows aren't selected, but the count still covers the first page's.
		await expect(selectedRows(page)).toHaveCount(0);
		await expect(headerCheckbox(page)).not.toBeChecked();
		await expect(selectedCount(page)).toHaveText('25 selected');
	});

	test('carries no selection into another Resource', async ({ page }) => {
		// Recipes 1 and 2: posts 1 and 2 have the same ids. (Posts, since the demo replaces the
		// users list View with one of its own.)
		await rowCheckbox(page, 'Classic Margherita Pizza').check();
		await rowCheckbox(page, 'Vegetarian Stir-Fry').check();
		await expect(selectedCount(page)).toHaveText('2 selected');

		await openInSidebar(page, 'Posts');

		await expect(page.getByRole('heading', { level: 1, name: 'Posts' })).toBeVisible();
		await expect(dataRows(page).first()).toContainText('A beginner guide to weeknight dinners');
		await expect(selectedRows(page)).toHaveCount(0);
		await expect(headerCheckbox(page)).not.toBeChecked();
		await expect(selectedCount(page)).toHaveCount(0);
	});

	test('brings no stale selection back between Resources', async ({ page }) => {
		await rowCheckbox(page, 'Classic Margherita Pizza').check();
		await rowCheckbox(page, 'Vegetarian Stir-Fry').check();
		await openInSidebar(page, 'Posts');
		await expect(page.getByRole('heading', { level: 1, name: 'Posts' })).toBeVisible();

		await openInSidebar(page, 'Recipes');
		await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
		await expect(dataRows(page).first()).toContainText('Classic Margherita Pizza');
		// Switching Resources cleared the earlier selection.
		await expect(selectedRows(page)).toHaveCount(0);
		await rowCheckbox(page, 'Chocolate Chip Cookies').check();

		// The count covers only what was selected in recipes now.
		await expect(selectedCount(page)).toHaveText('1 selected');

		await page.goBack();

		await expect(page.getByRole('heading', { level: 1, name: 'Posts' })).toBeVisible();
		await expect(dataRows(page).first()).toContainText('A beginner guide to weeknight dinners');
		await expect(selectedRows(page)).toHaveCount(0);
		await expect(selectedCount(page)).toHaveCount(0);
	});
});

test.describe('row selection without JavaScript', () => {
	// Runs with JavaScript on too: the server-rendered list must work either way.
	test('leaves the list usable, with the checkboxes disabled until hydration', async ({
		page,
		javaScriptEnabled
	}) => {
		const response = await page.goto('/admin/recipes');

		expect(response?.status()).toBe(200);
		await expect(dataRows(page)).toHaveCount(25);
		await expect(headerCheckbox(page)).toBeVisible();
		await expect(rowCheckbox(page, 'Classic Margherita Pizza')).toBeVisible();
		await expect(selectedCount(page)).toHaveCount(0);
		if (!javaScriptEnabled) {
			// Selection needs JavaScript, so its checkboxes can't be ticked to no effect.
			await expect(headerCheckbox(page)).toBeDisabled();
			await expect(rowCheckbox(page, 'Classic Margherita Pizza')).toBeDisabled();
		}

		// The pager and the record links still work.
		await pager(page).getByRole('link', { name: 'Next' }).click();
		await expect(page).toHaveURL('/admin/recipes?page=2');
		await expect(dataRows(page).first()).not.toContainText('Classic Margherita Pizza');
		await page.getByRole('link', { name: 'Brazilian Feijoada' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Brazilian Feijoada' })).toBeVisible();
	});
});
