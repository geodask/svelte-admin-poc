// A number typed into a create or edit form, read by the same rule as a number filter: `1e3` is
// 1000, and a number with spaces around it is no number. These tests write to the demo backend,
// so they run one at a time, after the read-only tests (see playwright.config.ts), and with
// JavaScript on and off.
//
// Chromium's number input never sends spaces around a number: it sends nothing instead. A browser
// that shows it as a plain text box, or an app's Kind with a text input, sends what was typed, so
// the spaces tests turn the input into a text box first, as such a browser shows it.
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import { backendLog } from '../list-helpers.ts';
import {
	fillRecipe,
	open,
	save,
	spinbutton,
	stored,
	textbox,
	usesJavaScript
} from '../form-helpers.ts';

/** The `POST /recipes` and `PUT /recipes/...` requests the demo backend has received so far. */
async function recipeWrites(request: APIRequestContext) {
	return (await backendLog(request)).filter(
		(line) => line === 'POST /recipes' || line.startsWith('PUT /recipes/')
	);
}

/** The form's Servings input, made a text box that takes any text, as some browsers show it. */
async function servingsAsTextBox(page: Page): Promise<Locator> {
	await spinbutton(page, 'Servings').evaluate((element: HTMLInputElement) => {
		element.type = 'text';
	});
	return textbox(page, 'Servings');
}

/**
 * Check that the input still holds the text typed into it. Without JavaScript the server sent
 * the page back with it, as the input's `value`: Chromium's own number input clears text that is
 * no number, but a browser with a text box shows it.
 */
async function expectKept(input: Locator, typed: string) {
	if (usesJavaScript()) await expect(input).toHaveValue(typed);
	else await expect(input).toHaveAttribute('value', typed);
}

/**
 * Check that the Servings input shows the Field's issue: what was typed is no number. Without
 * JavaScript the server sent the page back, with Servings a number input again.
 */
async function expectNoNumber(page: Page, typed: string) {
	const input = usesJavaScript() ? textbox(page, 'Servings') : spinbutton(page, 'Servings');
	await expect(input).toHaveAccessibleDescription(/expected number/);
	await expect(input).toHaveAttribute('aria-invalid', 'true');
	await expectKept(input, typed);
}

test.describe('a number with spaces around it', () => {
	test('is an issue on its input when creating a recipe, which saves nothing', async ({
		page,
		request
	}) => {
		const before = (await recipeWrites(request)).length;
		await open(page, '/admin/recipes/new');
		await fillRecipe(page);
		await (await servingsAsTextBox(page)).fill(' 4 ');

		await save(page);

		await expectNoNumber(page, ' 4 ');
		// Without JavaScript the form posted to the page itself, which shows the issue.
		await expect(page).toHaveURL(/\/admin\/recipes\/new(\?|$)/);
		expect(await recipeWrites(request)).toHaveLength(before);
	});

	test('is an issue on its input when editing a recipe, which saves nothing', async ({
		page,
		request
	}) => {
		const record = await stored(request, 'recipes', 1);
		const before = (await recipeWrites(request)).length;
		await open(page, '/admin/recipes/1/edit');
		await (await servingsAsTextBox(page)).fill(' 4 ');

		await save(page);

		await expectNoNumber(page, ' 4 ');
		await expect(page).toHaveURL(/\/admin\/recipes\/1\/edit(\?|$)/);
		expect(await recipeWrites(request)).toHaveLength(before);
		expect(await stored(request, 'recipes', 1)).toEqual(record);
	});
});

test.describe('a number with an exponent', () => {
	test('saves as the number it writes when editing a recipe: 1e3 is 1000', async ({
		page,
		request
	}) => {
		await open(page, '/admin/recipes/1/edit');
		await spinbutton(page, 'Servings').fill('1e3');

		await save(page);

		await expect(page).toHaveURL('/admin/recipes/1');
		expect(await stored(request, 'recipes', 1)).toMatchObject({ servings: 1000 });
	});

	test('saves as the number it writes when creating a recipe', async ({ page, request }) => {
		await open(page, '/admin/recipes/new');
		await fillRecipe(page);
		await spinbutton(page, 'Prep time (min)').fill('2.5e1');

		await save(page);

		await expect(page).toHaveURL(/\/admin\/recipes\/\d+$/);
		const id = Number(new URL(page.url()).pathname.split('/').at(-1));
		expect(await stored(request, 'recipes', id)).toMatchObject({
			name: 'Lemon Risotto',
			prepTimeMinutes: 25
		});
	});
});
