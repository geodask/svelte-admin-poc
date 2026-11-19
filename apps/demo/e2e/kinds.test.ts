// Kinds: recipes' rating names the app's `stars` Kind, and the app replaces the built-in boolean
// Kind's cell. Both registered in admin.ts. Read-only, with JavaScript on and off.
import { expect, test } from './fixtures.ts';
import { columnCells, dataRows, sortLink, valueOf } from './list-helpers.ts';

/** The ratings a column of stars shows, read from their screen-reader text; `null` for none. */
async function ratingsShown(cells: Awaited<ReturnType<typeof columnCells>>) {
	return (await cells.allTextContents()).map((text) => {
		const rating = /(\d) out of 5 stars/.exec(text);
		return rating === null ? null : Number(rating[1]);
	});
}

test.describe("recipes' rating, shown with the app's stars Kind", () => {
	test('shows stars in the list View, rendered on the server', async ({ page }) => {
		const response = await page.goto('/admin/recipes');

		expect(await response?.text()).toContain('1 out of 5 stars');
		const ratings = await columnCells(page, 'Rating');
		// Stars for the eye, the rating as text for screen readers.
		await expect(ratings.nth(0)).toHaveText('★☆☆☆☆ 1 out of 5 stars');
		await expect(ratings.nth(1)).toHaveText('★★★★☆ 4 out of 5 stars');
		await expect(ratings.nth(0).locator('[aria-hidden="true"]')).toHaveText('★☆☆☆☆');
		// The fourth recipe has no rating: an empty cell, as for any empty value.
		await expect(ratings.nth(3)).toHaveText('');
	});

	test('shows stars on the detail View, and a dash for no rating', async ({ page }) => {
		await page.goto('/admin/recipes/2');
		await expect(valueOf(page, 'Rating')).toHaveText('★★★★☆ 4 out of 5 stars');

		await page.goto('/admin/recipes/4');
		await expect(valueOf(page, 'Rating')).toHaveText('—');
	});

	test('sorts as a number from its header, with missing ratings last either way', async ({
		page
	}) => {
		await page.goto('/admin/recipes?perPage=100');

		await sortLink(page, 'Rating').click();
		await expect(page).toHaveURL('/admin/recipes?perPage=100&sort=rating');
		await expect(dataRows(page).first()).toContainText('Classic Margherita Pizza');
		const ascending = await ratingsShown(await columnCells(page, 'Rating'));
		// 42 of the 55 recipes have a rating, and the 13 without come last.
		expect(ascending.slice(42)).toEqual(Array(13).fill(null));
		const rated = ascending.slice(0, 42) as number[];
		expect(rated).toEqual(rated.toSorted((a, b) => a - b));
		expect([rated[0], rated.at(-1)]).toEqual([1, 5]);

		await sortLink(page, 'Rating').click();
		await expect(page).toHaveURL('/admin/recipes?perPage=100&sort=rating&order=desc');
		await expect(dataRows(page).first()).toContainText('Caprese Salad');
		const descending = await ratingsShown(await columnCells(page, 'Rating'));
		expect(descending.slice(42)).toEqual(Array(13).fill(null));
		expect(descending.slice(0, 42)).toEqual(rated.toReversed());
	});
});

test.describe("the app's boolean cell, which replaces only the built-in boolean Kind's cell", () => {
	test('shows ✓ and ✗ in the list View, with "Yes" and "No" for screen readers', async ({
		page
	}) => {
		await page.goto('/admin/recipes');

		const vegetarian = await columnCells(page, 'Vegetarian');
		await expect(vegetarian.nth(0)).toHaveText('✓ Yes');
		await expect(vegetarian.nth(2)).toHaveText('✗ No');
		await expect(vegetarian.nth(0).locator('[aria-hidden="true"]')).toHaveText('✓');
		await expect(vegetarian.nth(0).locator('.sr-only')).toHaveText('Yes');
	});

	test('leaves the detail View with the Theme\'s "Yes" and "No"', async ({ page }) => {
		await page.goto('/admin/recipes/1');
		await expect(valueOf(page, 'Vegetarian')).toHaveText('Yes');

		await page.goto('/admin/recipes/3');
		await expect(valueOf(page, 'Vegetarian')).toHaveText('No');
	});
});
