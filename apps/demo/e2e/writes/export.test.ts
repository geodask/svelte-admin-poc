// Exporting a list View as CSV, with a record written to the demo backend or a fault injected
// into it. These run one at a time, with nothing beside them (see playwright.config.ts). Export
// needs JavaScript, so every test here does.
import type { Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, hydrated, injectFault, test } from '../fixtures.ts';
import { csvColumn, dataRows, exportButton, exportCsv } from '../list-helpers.ts';

/** What a spreadsheet would run as a formula if the export wrote it as it is. */
const FORMULA = '=HYPERLINK("https://example.com","Win a prize")';

/** Open a list View, hydrated and with its records shown, so its export can be started. */
async function openList(page: Page, path: string) {
	await page.goto(path);
	await hydrated(page);
	await expect(dataRows(page).first()).toBeVisible();
}

test.describe('exporting a list as CSV', () => {
	test('writes text that starts like a formula with an apostrophe in front @js', async ({
		page,
		request
	}) => {
		const created = await request.post(`${BACKEND_URL}/recipes`, {
			data: {
				name: FORMULA,
				cuisine: '+Fusion',
				difficulty: 'Easy',
				prepTimeMinutes: 5,
				servings: 2,
				vegetarian: true,
				tags: ['@weeknight', 'Quick'],
				ingredients: [{ name: 'Toast' }],
				publishedAt: '2024-05-01T12:00:00.000Z',
				nutrition: { proteinGrams: 3, carbsGrams: 20 },
				instructions: '-Toast the bread'
			}
		});
		expect(created.status()).toBe(201);
		await openList(page, '/admin/recipes?q=HYPERLINK');

		const { rows } = await exportCsv(page);

		expect(rows).toHaveLength(2);
		expect(csvColumn(rows, 'Name')).toEqual([`'${FORMULA}`]);
		expect(csvColumn(rows, 'Cuisine')).toEqual(["'+Fusion"]);
		expect(csvColumn(rows, 'Tags')).toEqual(["'@weeknight, Quick"]);
		expect(csvColumn(rows, 'Instructions')).toEqual(["'-Toast the bread"]);
		// Numbers are never guarded.
		expect(csvColumn(rows, 'Prep time (min)')).toEqual(['5']);
	});

	test('a failed export shows why, downloads nothing, and can be tried again @js', async ({
		page,
		request
	}) => {
		const downloads: string[] = [];
		page.on('download', (download) => downloads.push(download.suggestedFilename()));
		await openList(page, '/admin/recipes');
		await injectFault(request, { status: 500, method: 'GET', path: '/recipes' });

		await exportButton(page).click();

		await expect(page.getByRole('alert')).toHaveText('An unexpected error occurred.');
		await expect(exportButton(page)).toHaveText('Try again');
		await expect(exportButton(page)).toBeEnabled();
		expect(downloads).toEqual([]);

		// The fault is used up, so trying again downloads the file.
		const { rows } = await exportCsv(page);

		expect(rows).toHaveLength(56);
		await expect(page.getByRole('alert')).toHaveCount(0);
		await expect(exportButton(page)).toHaveText('Export CSV');
	});

	test('shows progress and can’t be started twice while it runs @js', async ({ page, request }) => {
		await openList(page, '/admin/recipes');
		await injectFault(request, { delayMs: 1500, method: 'GET', path: '/recipes' });
		const download = page.waitForEvent('download');

		await exportButton(page).click();

		await expect(exportButton(page)).toHaveText('Exporting…');
		await expect(exportButton(page)).toBeDisabled();
		await download;
		await expect(exportButton(page)).toHaveText('Export CSV');
		await expect(exportButton(page)).toBeEnabled();
	});
});
