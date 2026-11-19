// Setting recipes' rating with the app's `stars` Kind input: a radio group with one choice per
// star, and "None". These tests write to the demo backend, so they run one at a time, after the
// read-only tests (see playwright.config.ts), and with JavaScript on and off.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import { valueOf } from '../list-helpers.ts';
import { fillRecipe, form, group, open, save, stored, textbox } from '../form-helpers.ts';

/** One choice of the rating's radio group, by its accessible name: "1 star" to "5 stars", "None". */
const rating = (page: Page, name: string) =>
	group(page, 'Rating').getByRole('radio', { name, exact: true });

test.describe("a recipe's rating, set with the stars Kind's radio group", () => {
	test('is one radio per star, then "None", with the current rating chosen', async ({ page }) => {
		await open(page, '/admin/recipes/2/edit');

		await expect(group(page, 'Rating').getByRole('radio')).toHaveCount(6);
		await expect(rating(page, '4 stars')).toBeChecked();
		await expect(rating(page, 'None')).not.toBeChecked();
		// A recipe without a rating has "None" chosen.
		await open(page, '/admin/recipes/4/edit');
		await expect(rating(page, 'None')).toBeChecked();
		await expect(group(page, 'Rating').getByRole('radio', { checked: true })).toHaveCount(1);
	});

	test('saves the rating chosen on the edit View', async ({ page, request }) => {
		await open(page, '/admin/recipes/2/edit');

		await rating(page, '2 stars').check();
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/2');
		await expect(valueOf(page, 'Rating')).toHaveText('★★☆☆☆ 2 out of 5 stars');
		expect(await stored(request, 'recipes', 2)).toMatchObject({ rating: 2 });
	});

	test('clears the rating with "None"', async ({ page, request }) => {
		await open(page, '/admin/recipes/2/edit');

		await rating(page, 'None').check();
		await save(page);

		await expect(page).toHaveURL('/admin/recipes/2');
		await expect(valueOf(page, 'Rating')).toHaveText('—');
		expect(await stored(request, 'recipes', 2)).not.toHaveProperty('rating');
	});

	test('saves the rating chosen on the create View', async ({ page, request }) => {
		await open(page, '/admin/recipes/new');
		await expect(rating(page, 'None')).toBeChecked();

		await fillRecipe(page);
		await rating(page, '5 stars').check();
		await save(page);

		// The seed has 55 recipes, so the new one is the 56th.
		await expect(page).toHaveURL('/admin/recipes/56');
		await expect(valueOf(page, 'Rating')).toHaveText('★★★★★ 5 out of 5 stars');
		expect(await stored(request, 'recipes', 56)).toMatchObject({ rating: 5 });
	});

	test('keeps the rating chosen when the save fails for another Field', async ({ page }) => {
		await open(page, '/admin/recipes/2/edit');

		await rating(page, '3 stars').check();
		await textbox(page, 'Name').fill('');
		await save(page);

		await expect(form(page)).toContainText('Required');
		await expect(rating(page, '3 stars')).toBeChecked();
	});
});
