// Exporting a list View as CSV. Export is a remote command, so it needs JavaScript: without it
// only the absence of the button is checked. The expected records are read from the demo backend
// directly, with the same params, so a test checks the file against the backend, not the admin.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../backend/config.ts';
import { expect, test } from './fixtures.ts';
import { csvColumn, dataRows, exportButton, exportCsv } from './list-helpers.ts';

const usesJavaScript = () => test.info().project.use.javaScriptEnabled !== false;

/** Every record the demo backend holds for a list query, read past the admin, in its order. */
async function backendRecords(request: APIRequestContext, resource: string, query: string) {
	const response = await request.get(`${BACKEND_URL}/${resource}?perPage=100&${query}`);
	const { data } = (await response.json()) as { data: Record<string, unknown>[] };
	return data;
}

/** The note an export that stopped at the cap shows beside the button. */
const exportNote = (page: Page) => page.getByRole('status').filter({ hasText: /^Exported/ });

test.describe('exporting a list as CSV', () => {
	test('downloads every record matching the search, sort and filters, across pages, in order @js', async ({
		page,
		request
	}) => {
		const expected = await backendRecords(
			request,
			'recipes',
			'q=a&sort=prepTimeMinutes&order=desc&vegetarian=false'
		);
		// More than one page of the list View, so the export isn't just the page shown.
		expect(expected.length).toBeGreaterThan(10);
		await page.goto(
			'/admin/recipes?perPage=10&sort=prepTimeMinutes&order=desc&q=a&vegetarian=false'
		);
		await expect(dataRows(page)).toHaveCount(10);

		const { filename, rows } = await exportCsv(page);

		expect(filename).toMatch(/^recipes-\d{4}-\d{2}-\d{2}\.csv$/);
		// Labelled headers, one per Field that isn't hidden, in schema order.
		expect(rows[0].slice(0, 8)).toEqual([
			'ID',
			'Name',
			'Cuisine',
			'Difficulty',
			'Prep time (min)',
			'Servings',
			'Calories',
			'Vegetarian'
		]);
		expect(rows[0]).toContain('Instructions');
		expect(rows[0]).not.toContain('Internal notes');
		expect(csvColumn(rows, 'ID')).toEqual(expected.map((recipe) => String(recipe.id)));
		expect(csvColumn(rows, 'Name')).toEqual(expected.map((recipe) => recipe.name));
		expect(new Set(csvColumn(rows, 'Vegetarian'))).toEqual(new Set(['false']));
		// The whole list fit under the cap, so there is no note.
		await expect(exportNote(page)).toHaveCount(0);
		await expect(exportButton(page)).toHaveText('Export CSV');
	});

	test('follows the default sort when the list names none, from the replaced users View @js', async ({
		page,
		request
	}) => {
		const expected = await backendRecords(request, 'users', 'sort=name&order=asc');
		await page.goto('/admin/users');
		// The replaced card list gets the button through the Theme's Toolbar.
		await expect(page.getByRole('list', { name: 'Users' })).toBeVisible();
		await expect(exportButton(page)).toHaveText('Export CSV');

		const { filename, rows } = await exportCsv(page);

		expect(filename).toMatch(/^users-\d{4}-\d{2}-\d{2}\.csv$/);
		expect(csvColumn(rows, 'Name')).toEqual(expected.map((user) => user.name));
		expect(rows).toHaveLength(expected.length + 1);
	});

	test('stops at the posts’ cap of 50 and says so @js', async ({ page }) => {
		await page.goto('/admin/posts');

		const { rows } = await exportCsv(page);

		// Newest first, by the default sort: posts 60 down to 11, of the 60 there are.
		expect(rows).toHaveLength(51);
		expect(csvColumn(rows, 'ID')).toEqual(Array.from({ length: 50 }, (_, i) => String(60 - i)));
		// The backend can't count posts, so the note has no total.
		await expect(exportNote(page)).toHaveText('Exported the first 50 records');
	});

	test('shows no Export button without JavaScript', async ({ page }) => {
		test.skip(usesJavaScript(), 'Only a page without JavaScript must hide the button');

		for (const path of ['/admin/recipes', '/admin/users']) {
			await page.goto(path);
			await expect(page.getByRole('link', { name: 'New' })).toBeVisible();
			await expect(exportButton(page)).toHaveCount(0);
		}
	});
});
