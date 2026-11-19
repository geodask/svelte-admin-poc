// Editing recipes' source id, a number or a slug, with the app's `numberOrSlug` Kind: a text input
// whose `fromInput` reads digits as a number and a slug as text, and whose `toInput` prefills the
// value as text. These tests write to the demo backend, so they run one at a time, after the
// read-only tests (see playwright.config.ts), and with JavaScript on and off: without it, only
// the server converts.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import { valueOf } from '../list-helpers.ts';
import { fillRecipe, form, open, save, stored, textbox } from '../form-helpers.ts';

const sourceId = (page: Page) => textbox(page, 'Source ID');

test.describe("a recipe's source id, a number or a slug edited as text", () => {
	test('is prefilled as text, whether it is a slug or a number', async ({ page }) => {
		await open(page, '/admin/recipes/1/edit');
		await expect(sourceId(page)).toHaveValue('dj-1');
		await expect(sourceId(page)).toHaveAttribute('placeholder', 'e.g. 42 or abc-1');

		await open(page, '/admin/recipes/2/edit');
		await expect(sourceId(page)).toHaveValue('9001');
	});

	test('saves digits as a number', async ({ page, request }) => {
		await open(page, '/admin/recipes/1/edit');

		await sourceId(page).fill('42');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/1');
		await expect(valueOf(page, 'Source ID')).toHaveText('42');
		expect((await stored(request, 'recipes', 1)).sourceId).toBe(42);
	});

	test('saves a slug as text', async ({ page, request }) => {
		await open(page, '/admin/recipes/2/edit');

		await sourceId(page).fill('abc-1');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/2');
		await expect(valueOf(page, 'Source ID')).toHaveText('abc-1');
		expect((await stored(request, 'recipes', 2)).sourceId).toBe('abc-1');
	});

	test('saves an unchanged number as a number, not as its text', async ({ page, request }) => {
		await open(page, '/admin/recipes/2/edit');

		await textbox(page, 'Cuisine').fill('Fusion');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/2');
		expect(await stored(request, 'recipes', 2)).toMatchObject({
			cuisine: 'Fusion',
			sourceId: 9001
		});
	});

	test('a value it refuses shows the message under the input, keeps it, and saves nothing', async ({
		page,
		request
	}) => {
		await open(page, '/admin/recipes/1/edit');

		await sourceId(page).fill('abc 1');
		await save(page);

		await expect(sourceId(page)).toHaveAccessibleDescription(
			'Enter a number or a slug, such as 42 or abc-1'
		);
		await expect(sourceId(page)).toHaveValue('abc 1');
		await expect(page).toHaveURL(/\/admin\/recipes\/1\/edit(\?|$)/);
		expect((await stored(request, 'recipes', 1)).sourceId).toBe('dj-1');
	});

	test('left empty, reports "Required"', async ({ page }) => {
		await open(page, '/admin/recipes/1/edit');

		await sourceId(page).fill('');
		await save(page);

		await expect(sourceId(page)).toHaveAccessibleDescription('Required');
		await expect(form(page)).toContainText('Required');
	});

	test('is set on the create View, and the backend keeps it', async ({ page, request }) => {
		await open(page, '/admin/recipes/new');

		await fillRecipe(page);
		await sourceId(page).fill('77');
		await save(page);

		// The seed has 55 recipes, so the new one is the 56th.
		await expect(page).toHaveURL('/admin/recipes/56');
		expect((await stored(request, 'recipes', 56)).sourceId).toBe(77);
	});
});
