// A date that doesn't exist, typed into a create or edit form. These tests write to the demo
// backend, so they run one at a time, after the read-only tests (see playwright.config.ts), and
// with JavaScript on and off.
//
// Chromium's `date` and `datetime-local` inputs never send a day that doesn't exist: they send
// nothing instead. A browser that shows them as plain text boxes (as Safari did before 14.1) or
// an app's Kind with a text input sends what was typed, so these tests turn the input into a
// text box first, as such a browser shows it.
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, test } from '../fixtures.ts';
import { fillRecipe, open, save, stored, textbox, usesJavaScript } from '../form-helpers.ts';

/** The `POST /recipes` and `PUT /recipes/...` requests the demo backend has received so far. */
async function recipeWrites(request: APIRequestContext) {
	const log = (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
	return log.filter((line) => line === 'POST /recipes' || line.startsWith('PUT /recipes/'));
}

/** A form's date input by its label, made a text box that takes any text, as some browsers show it. */
async function asTextBox(page: Page, label: string): Promise<Locator> {
	const input = textbox(page, label);
	await input.evaluate((element: HTMLInputElement) => {
		element.type = 'text';
	});
	return input;
}

/**
 * Check that the input still holds the text typed into it. Without JavaScript the server sent
 * the page back with it, as the input's `value`: Chromium's own date input clears a day that
 * doesn't exist, but a browser with a text box shows it.
 */
async function expectKept(input: Locator, typed: string) {
	if (usesJavaScript()) await expect(input).toHaveValue(typed);
	else await expect(input).toHaveAttribute('value', typed);
}

const dates = [
	{ what: 'a date Field', label: 'Last cooked', typed: '2024-02-30', issue: 'Invalid ISO date' },
	{
		what: 'a datetime Field',
		label: 'Published at (UTC)',
		typed: '2024-02-30T10:00',
		issue: 'Invalid ISO datetime'
	}
];

for (const { what, label, typed, issue } of dates) {
	test.describe(`30 February in ${what}`, () => {
		test('is an issue on its input when creating a recipe, which keeps the text and saves nothing', async ({
			page,
			request
		}) => {
			const before = (await recipeWrites(request)).length;
			await open(page, '/admin/recipes/new');
			await fillRecipe(page);
			await (await asTextBox(page, label)).fill(typed);

			await save(page);

			const input = textbox(page, label);
			await expect(input).toHaveAccessibleDescription(issue);
			await expect(input).toHaveAttribute('aria-invalid', 'true');
			await expectKept(input, typed);
			// Without JavaScript the form posted to the page itself, which shows the issue.
			await expect(page).toHaveURL(/\/admin\/recipes\/new(\?|$)/);
			expect(await recipeWrites(request)).toHaveLength(before);
		});

		test('is an issue on its input when editing a recipe, which keeps the text and saves nothing', async ({
			page,
			request
		}) => {
			const record = await stored(request, 'recipes', 1);
			const before = (await recipeWrites(request)).length;
			await open(page, '/admin/recipes/1/edit');
			await (await asTextBox(page, label)).fill(typed);

			await save(page);

			const input = textbox(page, label);
			await expect(input).toHaveAccessibleDescription(issue);
			await expect(input).toHaveAttribute('aria-invalid', 'true');
			await expectKept(input, typed);
			await expect(page).toHaveURL(/\/admin\/recipes\/1\/edit(\?|$)/);
			expect(await recipeWrites(request)).toHaveLength(before);
			expect(await stored(request, 'recipes', 1)).toEqual(record);
		});
	});
}
