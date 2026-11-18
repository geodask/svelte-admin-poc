// Text, number and date filters: the text box, the from-to ranges, the narrowed exact-text filter,
// and the list URL's operator suffixes (`name.contains`, `prepTimeMinutes.gte`).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
	applyFilters,
	backendRequestsDuring,
	columnCells,
	dataRows,
	expectLanded,
	filterForm,
	filtersToggle,
	isJs,
	names,
	openFilters
} from './list-helpers.ts';

/** A from-to range in the filter panel, by its Field's label (with "(UTC)" for a datetime). */
const range = (page: Page, label: string) => {
	const group = filterForm(page).getByRole('group', { name: label });
	return { from: group.getByLabel('From'), to: group.getByLabel('To') };
};

/** The values of a column, as numbers. */
async function numbersIn(page: Page, label: string): Promise<number[]> {
	return (await (await columnCells(page, label)).allInnerTexts()).map((text) => Number(text));
}

test.describe('a text filter', () => {
	test('typing part of a recipe name filters with contains, ignoring case', async ({
		page,
		request
	}) => {
		// A page size no other test asks for, one per project, so the request log check only finds
		// this test's requests.
		const perPage = isJs() ? 81 : 82;
		await page.goto(`/admin/recipes?perPage=${perPage}`);

		const log = await backendRequestsDuring(request, async () => {
			await applyFilters(page, (form) =>
				form.getByRole('textbox', { name: 'Name', exact: true }).fill('STIR-fry')
			);
			await expectLanded(page, `/admin/recipes?perPage=${perPage}&name.contains=STIR-fry`);
			await expect(names(page)).toHaveText(['Vegetarian Stir-Fry', 'Beef and Broccoli Stir-Fry']);
		});
		expect(log).toContain(`GET /recipes?page=1&perPage=${perPage}&name.contains=STIR-fry`);

		// The text box shows what the list is filtered by.
		await openFilters(page);
		await expect(filterForm(page).getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
			'STIR-fry'
		);
	});

	test('the narrowed cuisine filter is one text box that matches exactly, with eq', async ({
		page,
		request
	}) => {
		const perPage = isJs() ? 83 : 84;
		await page.goto(`/admin/recipes?perPage=${perPage}`);
		const cuisine = filterForm(page).getByRole('textbox', { name: 'Cuisine', exact: true });

		const log = await backendRequestsDuring(request, async () => {
			await applyFilters(page, () => cuisine.fill('Italian'));
			await expectLanded(page, `/admin/recipes?perPage=${perPage}&cuisine=Italian`);
			await expect(dataRows(page)).toHaveCount(5);
		});
		expect(log).toContain(`GET /recipes?page=1&perPage=${perPage}&cuisine=Italian`);
		const cuisines = await (await columnCells(page, 'Cuisine')).allInnerTexts();
		expect(cuisines.every((text) => text.trim() === 'Italian')).toBe(true);

		// Part of a cuisine matches nothing: it is never sent as `contains`.
		await applyFilters(page, () => cuisine.fill('Ital'));
		await expectLanded(page, `/admin/recipes?perPage=${perPage}&cuisine=Ital`);
		await expect(page.getByText('No recipes match the filters.')).toBeVisible();
	});

	test('the URL takes repeated cuisine params as in, one box per value', async ({ page }) => {
		await page.goto('/admin/recipes?cuisine=Thai&cuisine=Italian');

		await expect(names(page)).toHaveText([
			'Classic Margherita Pizza',
			'Chicken Alfredo Pasta',
			'Tomato Basil Bruschetta',
			'Caprese Salad',
			'Shrimp Scampi Pasta',
			'Thai Green Curry',
			'Pad Thai'
		]);
		await expect(filtersToggle(page)).toHaveText(/^\s*Filters\s*1\s*$/);

		// The cuisine control shows one box per value, so clearing one leaves the other as eq.
		await openFilters(page);
		await expect(
			filterForm(page).getByRole('textbox', { name: 'Cuisine', exact: true })
		).toHaveValue('Italian');
		const thai = filterForm(page).getByRole('textbox', { name: 'Cuisine 2' });
		await expect(thai).toHaveValue('Thai');
		await applyFilters(page, () => thai.fill(''));
		await expectLanded(page, '/admin/recipes?cuisine=Italian');
		await expect(dataRows(page)).toHaveCount(5);

		// Typing in the one box left replaces the filter.
		await applyFilters(page, () =>
			filterForm(page).getByRole('textbox', { name: 'Cuisine', exact: true }).fill('Thai')
		);
		await expectLanded(page, '/admin/recipes?cuisine=Thai');
		await expect(names(page)).toHaveText(['Thai Green Curry', 'Pad Thai']);
	});

	test('the URL drops contains on the narrowed cuisine, and the backend never gets it', async ({
		page,
		request
	}) => {
		const perPage = isJs() ? 85 : 86;
		const log = await backendRequestsDuring(request, async () => {
			const response = await page.goto(`/admin/recipes?perPage=${perPage}&cuisine.contains=Ital`);
			// Rendered on the server as the whole list, with or without JavaScript.
			expect(await response?.text()).toContain('Classic Margherita Pizza');
			await expect(dataRows(page)).toHaveCount(55);
			if (isJs()) await expect(page).toHaveURL(`/admin/recipes?perPage=${perPage}`);
		});

		expect(log).toContain(`GET /recipes?page=1&perPage=${perPage}`);
		expect(log.filter((line) => line.includes('cuisine.contains'))).toEqual([]);
	});
});

test.describe('a number range', () => {
	test('a prep-time range filters both sides, and each side alone', async ({ page, request }) => {
		const perPage = isJs() ? 87 : 88;
		await page.goto(`/admin/recipes?perPage=${perPage}`);
		const prepTime = range(page, 'Prep time (min)');

		const both = await backendRequestsDuring(request, async () => {
			await applyFilters(page, async () => {
				await prepTime.from.fill('20');
				await prepTime.to.fill('30');
			});
			await expectLanded(
				page,
				`/admin/recipes?perPage=${perPage}&prepTimeMinutes.lte=30&prepTimeMinutes.gte=20`
			);
			await expect(dataRows(page)).toHaveCount(30);
		});
		expect(both).toContain(
			`GET /recipes?page=1&perPage=${perPage}&prepTimeMinutes.lte=30&prepTimeMinutes.gte=20`
		);
		expect((await numbersIn(page, 'Prep time (min)')).every((n) => n >= 20 && n <= 30)).toBe(true);

		// The inputs show the range; clearing the to side filters from one side only.
		await openFilters(page);
		await expect(prepTime.from).toHaveValue('20');
		await expect(prepTime.to).toHaveValue('30');
		const from = await backendRequestsDuring(request, async () => {
			await applyFilters(page, async () => {
				await prepTime.from.fill('30');
				await prepTime.to.fill('');
			});
			await expectLanded(page, `/admin/recipes?perPage=${perPage}&prepTimeMinutes.gte=30`);
			await expect(dataRows(page)).toHaveCount(16);
		});
		expect(from).toContain(`GET /recipes?page=1&perPage=${perPage}&prepTimeMinutes.gte=30`);
		expect((await numbersIn(page, 'Prep time (min)')).every((n) => n >= 30)).toBe(true);

		const to = await backendRequestsDuring(request, async () => {
			await applyFilters(page, async () => {
				await prepTime.from.fill('');
				await prepTime.to.fill('10');
			});
			await expectLanded(page, `/admin/recipes?perPage=${perPage}&prepTimeMinutes.lte=10`);
			await expect(dataRows(page)).toHaveCount(6);
		});
		expect(to).toContain(`GET /recipes?page=1&perPage=${perPage}&prepTimeMinutes.lte=10`);
		expect((await numbersIn(page, 'Prep time (min)')).every((n) => n <= 10)).toBe(true);
	});

	test('posts filter by author with a single id input, until the Reference picker', async ({
		page
	}) => {
		await page.goto('/admin/posts');
		await openFilters(page);
		// One input, since a Reference is filtered by equality only: no from and to.
		await expect(filterForm(page).getByRole('group', { name: 'Author' })).toHaveCount(0);

		await applyFilters(page, (form) => form.getByRole('spinbutton', { name: 'Author' }).fill('3'));

		await expectLanded(page, '/admin/posts?userId=3');
		await expect(dataRows(page)).toHaveCount(12);
		// User 3 wrote every one of them.
		expect(new Set(await (await columnCells(page, 'Author')).allInnerTexts())).toEqual(
			new Set(['Alan Turing'])
		);
	});
});

test.describe('a date range on a datetime Field', () => {
	// Far from UTC, so a range read in the browser's own time zone would select other recipes.
	test.use({ timezoneId: 'Pacific/Auckland' });

	test('filters in UTC, inclusive on both sides', async ({ page, request }) => {
		const perPage = isJs() ? 89 : 90;
		await page.goto(`/admin/recipes?perPage=${perPage}`);
		const publishedAt = range(page, 'Published at (UTC)');

		const log = await backendRequestsDuring(request, async () => {
			// Recipes are published every 7 days at 23:30 UTC: 5 Feb (the from bound itself), 12 and
			// 19 Feb are in; 26 Feb at 23:30 is a minute past the to bound.
			await applyFilters(page, async () => {
				await publishedAt.from.fill('2024-02-05T23:30');
				await publishedAt.to.fill('2024-02-26T23:29');
			});
			await expectLanded(
				page,
				`/admin/recipes?perPage=${perPage}` +
					'&publishedAt.lte=2024-02-26T23%3A29&publishedAt.gte=2024-02-05T23%3A30'
			);
			await expect(names(page)).toHaveText([
				'Quinoa Salad with Avocado',
				'Tomato Basil Bruschetta',
				'Beef and Broccoli Stir-Fry'
			]);
		});
		// The Provider sends the Field's own type: ISO datetime strings, in UTC.
		expect(log).toContain(
			`GET /recipes?page=1&perPage=${perPage}` +
				'&publishedAt.lte=2024-02-26T23%3A29%3A00.000Z&publishedAt.gte=2024-02-05T23%3A30%3A00.000Z'
		);

		await openFilters(page);
		await expect(publishedAt.from).toHaveValue('2024-02-05T23:30');
		await expect(publishedAt.to).toHaveValue('2024-02-26T23:29');
	});

	test('the users card list filters by when they joined, through the Toolbar', async ({ page }) => {
		await page.goto('/admin/users');
		const cards = page.getByRole('list', { name: 'Users' }).getByRole('listitem');
		const joinedAt = range(page, 'Joined at (UTC)');

		// Users joined on the 15th of each month of 2023, at 09:00 UTC.
		await applyFilters(page, async () => {
			await joinedAt.from.fill('2023-11-15T09:00');
		});

		await expectLanded(page, '/admin/users?joinedAt.gte=2023-11-15T09%3A00');
		// In the default order, by name.
		await expect(cards).toHaveCount(2);
		await expect(cards.nth(0)).toContainText('John McCarthy');
		await expect(cards.nth(1)).toContainText('Radia Perlman');
	});
});

test.describe('a list URL with a malformed number or date', () => {
	for (const [what, search, rows, first] of [
		['a number that is not one', '?prepTimeMinutes.gte=abc', 25, 'Classic Margherita Pizza'],
		[
			'a date that is no real day, beside a good bound',
			'?publishedAt.gte=2024-02-30T00:00&prepTimeMinutes.lte=10',
			6,
			'Caprese Salad'
		],
		['a datetime with a zone', '?publishedAt.gte=2024-02-01T00:00Z', 25, 'Classic Margherita Pizza']
	] as const) {
		test(`still renders the right list for ${what}`, async ({ page }) => {
			const response = await page.goto(`/admin/recipes${search}`);

			// Rendered on the server, with or without JavaScript.
			expect(await response?.text()).toContain(first);
			await expect(names(page).first()).toHaveText(first);
			await expect(dataRows(page)).toHaveCount(rows);
		});
	}

	test('is cleaned in place @js', async ({ page }) => {
		for (const [search, clean] of [
			['?prepTimeMinutes.gte=abc', '/admin/recipes'],
			['?prepTimeMinutes.gte=abc&prepTimeMinutes.lte=10', '/admin/recipes?prepTimeMinutes.lte=10'],
			['?publishedAt.gte=2024-02-30T00:00&page=2', '/admin/recipes?page=2'],
			['?publishedAt.lte=2024-03-01T10:30:00', '/admin/recipes?publishedAt.lte=2024-03-01T10%3A30'],
			['?name.contains=&prepTimeMinutes.gte=', '/admin/recipes']
		]) {
			await page.goto(`/admin/recipes${search}`);
			await expect(page).toHaveURL(clean);
		}
	});
});
