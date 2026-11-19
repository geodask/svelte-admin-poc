// Read-only and hidden Fields in the forms: recipes' review count (owned by the backend), their
// internal notes (hidden), and users' email (set once on create). Also the
// placeholder and the help text an input shows. These tests write to the demo backend, so they
// run one at a time, after the tests that only read (see playwright.config.ts), and with
// JavaScript on and off.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import { valueOf } from '../list-helpers.ts';
import { fillRecipe, form, open, save, stored, textbox, usesJavaScript } from '../form-helpers.ts';

/**
 * Add an input to the form that no View renders, as a crafted post would. Kit names each input
 * after its Field then the form's id, and reads a name that starts with `n:` as a number, so the
 * crafted name copies the form's id from the `name` Field's input, which both forms here have.
 */
async function craftInput(page: Page, name: string, value: string) {
	await form(page).evaluate(
		(element, [name, value]) => {
			const named = element.querySelector<HTMLInputElement>('input[name^="name/"]')!;
			const input = document.createElement('input');
			input.type = 'hidden';
			input.name = name + named.name.slice('name'.length);
			input.value = value;
			element.append(input);
		},
		[name, value]
	);
}

test.describe("a recipe's read-only and hidden Fields", () => {
	test('have no input on the create View, and the backend fills them', async ({
		page,
		request
	}) => {
		await open(page, '/admin/recipes/new');

		for (const label of ['Review count', 'Internal notes']) {
			await expect(form(page).getByLabel(label, { exact: true })).toHaveCount(0);
			await expect(form(page).getByText(label, { exact: true })).toHaveCount(0);
		}

		await fillRecipe(page);
		await save(page);

		// The seed has 55 recipes, so the new one is the 56th.
		await expect(page).toHaveURL('/admin/recipes/56');
		await expect(page.getByRole('heading', { level: 1, name: 'Lemon Risotto' })).toBeVisible();
		await expect(valueOf(page, 'Review count')).toHaveText('0');
		expect(await stored(request, 'recipes', 56)).toMatchObject({
			name: 'Lemon Risotto',
			reviewCount: 0,
			internalNotes: 'Created in the admin'
		});
	});

	test('show as text on the edit View, and saving keeps them and the hidden notes', async ({
		page,
		request
	}) => {
		await open(page, '/admin/recipes/1/edit');

		await expect(valueOf(page, 'Review count')).toHaveText('1,250');
		await expect(form(page).getByRole('spinbutton', { name: 'Review count' })).toHaveCount(0);
		await expect(form(page).getByText('Internal notes', { exact: true })).toHaveCount(0);

		await textbox(page, 'Cuisine').fill('Neapolitan');
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/1');
		await expect(valueOf(page, 'Cuisine')).toHaveText('Neapolitan');
		expect(await stored(request, 'recipes', 1)).toMatchObject({
			cuisine: 'Neapolitan',
			reviewCount: 1250,
			internalNotes: 'Imported batch 1'
		});
	});

	test('a crafted post that sets the review count leaves it unchanged', async ({
		page,
		request
	}) => {
		test.skip(usesJavaScript(), 'A plain form post, without JavaScript');
		await open(page, '/admin/recipes/1/edit');
		await craftInput(page, 'n:reviewCount', '5');
		await craftInput(page, 'internalNotes', 'Overwritten');

		await save(page);

		await expect(page).toHaveURL('/admin/recipes/1');
		expect(await stored(request, 'recipes', 1)).toMatchObject({
			reviewCount: 1250,
			internalNotes: 'Imported batch 1'
		});
	});

	test('a crafted create that sets the review count gets the backend value', async ({
		page,
		request
	}) => {
		test.skip(usesJavaScript(), 'A plain form post, without JavaScript');
		await open(page, '/admin/recipes/new');
		await fillRecipe(page);
		await craftInput(page, 'n:reviewCount', '5000');

		await save(page);

		await expect(page).toHaveURL('/admin/recipes/56');
		expect(await stored(request, 'recipes', 56)).toMatchObject({ reviewCount: 0 });
	});
});

test.describe("a user's email, set once on create", () => {
	const email = (page: Page) => textbox(page, 'Email');

	test('is an input on the create View', async ({ page }) => {
		await open(page, '/admin/users/new');

		await expect(email(page)).toBeEditable();
		await expect(email(page)).toHaveJSProperty('type', 'email');
	});

	test('is text on the edit View, and saving keeps it', async ({ page, request }) => {
		await open(page, '/admin/users/2/edit');

		await expect(form(page).getByRole('textbox', { name: 'Email' })).toHaveCount(0);
		await expect(valueOf(page, 'Email')).toHaveText('grace@example.com');

		await textbox(page, 'Name').fill('Rear Admiral Grace Hopper');
		await save(page);

		await expect(page).toHaveURL('/admin/users/2');
		expect(await stored(request, 'users', 2)).toMatchObject({
			name: 'Rear Admiral Grace Hopper',
			email: 'grace@example.com'
		});
	});

	test('a crafted edit post that sets it leaves it unchanged', async ({ page, request }) => {
		test.skip(usesJavaScript(), 'A plain form post, without JavaScript');
		await open(page, '/admin/users/2/edit');
		await craftInput(page, 'email', 'mallory@example.com');

		await save(page);

		await expect(page).toHaveURL('/admin/users/2');
		expect(await stored(request, 'users', 2)).toMatchObject({ email: 'grace@example.com' });
	});
});

test.describe('placeholders and help text', () => {
	test('an input shows its placeholder', async ({ page }) => {
		await open(page, '/admin/recipes/new');

		await expect(textbox(page, 'Name')).toHaveAttribute(
			'placeholder',
			'e.g. Classic Margherita Pizza'
		);
		await open(page, '/admin/users/new');
		await expect(textbox(page, 'Email')).toHaveAttribute('placeholder', 'name@example.com');
	});

	test("recipes' instructions show their help text", async ({ page }) => {
		await open(page, '/admin/recipes/new');

		await expect(textbox(page, 'Instructions')).toHaveAccessibleDescription('How to cook it');
		await open(page, '/admin/recipes/1/edit');
		await expect(textbox(page, 'Instructions')).toHaveAccessibleDescription('How to cook it');
	});
});
