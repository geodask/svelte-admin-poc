// The active filter chips under the toolbar: one per filter in the URL, each a link with × that
// removes only that filter.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { columnCells, dataRows, filtersToggle, names } from './list-helpers.ts';

/** The active filter chips, in order. */
const chips = (page: Page) => page.getByRole('list', { name: 'Active filters' }).getByRole('link');

/** The chip of one filter, by its label. Its link is named "Remove filter …". */
const chip = (page: Page, label: string) =>
	page
		.getByRole('list', { name: 'Active filters' })
		.getByRole('link', { name: `Remove filter ${label}`, exact: true });

/** Expect the chips to show these labels, in order. */
const expectChips = (page: Page, labels: string[]) =>
	expect(chips(page)).toHaveText(labels.map((label) => `Remove filter ${label}`));

test.describe('the active filter chips', () => {
	test('show each filter with its Field label and value', async ({ page }) => {
		await page.goto(
			'/admin/recipes?difficulty=Easy&difficulty=Medium&vegetarian=true&name.contains=a&prepTimeMinutes.gte=10&prepTimeMinutes.lte=30'
		);

		await expectChips(page, [
			'Name contains a',
			'Difficulty: Easy, Medium',
			'Prep time (min) ≤ 30',
			'Prep time (min) ≥ 10',
			'Vegetarian: Yes'
		]);
		await expect(filtersToggle(page)).toHaveText(/^\s*Filters\s*5\s*$/);
	});

	test('× removes only that filter, keeping the search, sort, page size and other filters, at page 1', async ({
		page
	}) => {
		await page.goto(
			'/admin/recipes?page=2&perPage=10&sort=prepTimeMinutes&order=desc&q=a&difficulty=Easy&difficulty=Medium&vegetarian=false&prepTimeMinutes.gte=10'
		);
		await expectChips(page, ['Difficulty: Easy, Medium', 'Prep time (min) ≥ 10', 'Vegetarian: No']);

		await chip(page, 'Vegetarian: No').click();

		await expect(page).toHaveURL(
			'/admin/recipes?perPage=10&sort=prepTimeMinutes&order=desc&q=a&difficulty=Easy&difficulty=Medium&prepTimeMinutes.gte=10'
		);
		await expectChips(page, ['Difficulty: Easy, Medium', 'Prep time (min) ≥ 10']);
		await expect(dataRows(page)).toHaveCount(10);
		await expect(page.getByRole('searchbox')).toHaveValue('a');
		const difficulties = await (await columnCells(page, 'Difficulty')).allInnerTexts();
		expect(difficulties.every((text) => ['Easy', 'Medium'].includes(text.trim()))).toBe(true);
		const prepTimes = (await (await columnCells(page, 'Prep time (min)')).allInnerTexts()).map(
			Number
		);
		expect(prepTimes.every((minutes) => minutes >= 10)).toBe(true);
		expect(prepTimes).toEqual([...prepTimes].sort((a, b) => b - a));

		// Removing an `in` removes every value of it.
		await chip(page, 'Difficulty: Easy, Medium').click();
		await expect(page).toHaveURL(
			'/admin/recipes?perPage=10&sort=prepTimeMinutes&order=desc&q=a&prepTimeMinutes.gte=10'
		);
		await expectChips(page, ['Prep time (min) ≥ 10']);
	});

	test('show a filter only the URL can set, and remove it', async ({ page }) => {
		await page.goto('/admin/recipes?perPage=100&prepTimeMinutes.lt=20');
		await expectChips(page, ['Prep time (min) < 20']);
		const prepTimes = (await (await columnCells(page, 'Prep time (min)')).allInnerTexts()).map(
			Number
		);
		expect(prepTimes.length).toBeGreaterThan(0);
		expect(prepTimes.every((minutes) => minutes < 20)).toBe(true);

		await chip(page, 'Prep time (min) < 20').click();

		await expect(page).toHaveURL('/admin/recipes?perPage=100');
		await expect(chips(page)).toHaveCount(0);
		await expect(dataRows(page)).toHaveCount(55);
	});

	test('are not shown while no filter is on', async ({ page }) => {
		await page.goto('/admin/recipes?q=pasta&sort=name');
		await expect(names(page).first()).toBeVisible();
		await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);

		// Empty filter params, as a form without JavaScript posts them, are no filters either.
		await page.goto('/admin/recipes?name.contains=&vegetarian=&prepTimeMinutes.gte=');
		await expect(names(page).first()).toBeVisible();
		await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
	});

	test('show on the replaced users card list through the toolbar', async ({ page }) => {
		await page.goto('/admin/users?role=admin&active=true');
		await expectChips(page, ['Role: admin', 'Active: Yes']);

		await chip(page, 'Role: admin').click();

		await expect(page).toHaveURL('/admin/users?active=true');
		await expectChips(page, ['Active: Yes']);
		await expect(page.getByRole('list', { name: 'Users' }).getByRole('listitem')).not.toHaveCount(
			0
		);
	});
});

test.describe('a date and time chip', () => {
	// Far from UTC, so a label written in the browser's own time zone would differ.
	test.use({ timezoneId: 'Pacific/Auckland' });

	test('shows the date and time in UTC', async ({ page }) => {
		await page.goto('/admin/recipes?publishedAt.gte=2024-03-01T22:30');
		await expectChips(page, ['Published at ≥ Mar 1, 2024, 22:30 UTC']);
	});
});
