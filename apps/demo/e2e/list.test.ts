import { expect, test } from './fixtures.ts';

test.describe('the recipes list View', () => {
	test('shows the first page of seeded recipes, rendered on the server', async ({ page }) => {
		const response = await page.goto('/admin/recipes');

		expect(response?.status()).toBe(200);
		// The records are in the HTML the server sent, not fetched later by the browser.
		const html = (await response?.text()) ?? '';
		expect(html).toContain('Classic Margherita Pizza');
		expect(html).toContain('Lebanese Falafel Wrap');

		await expect(page).toHaveTitle('Recipes');
		await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();

		const rows = page.getByRole('table').getByRole('row');
		// One header row, then the first page: recipes 1 to 25 of 30.
		await expect(rows).toHaveCount(1 + 25);
		await expect(rows.nth(1)).toContainText('Classic Margherita Pizza');
		await expect(rows.nth(1)).toContainText('Pizza, Vegetarian');
		await expect(rows.nth(25)).toContainText('Lebanese Falafel Wrap');
		await expect(page.getByRole('table')).not.toContainText('Brazilian Feijoada');
	});

	test('shows the Field labels in schema order, without hidden and left-off Fields', async ({
		page
	}) => {
		await page.goto('/admin/recipes');

		await expect(page.getByRole('columnheader')).toHaveText([
			'ID',
			'Name',
			'Cuisine',
			'Difficulty',
			'Prep time (min)',
			'Servings',
			'Calories',
			'Vegetarian',
			'Tags',
			'Review count',
			'Published at',
			'Source ID'
		]);
		// `nutrition` is an object, `instructions` is `list: false`, `internalNotes` is hidden.
		const table = page.getByRole('table');
		await expect(table).not.toContainText('Nutrition');
		await expect(table).not.toContainText('Instructions');
		await expect(table).not.toContainText('How to cook it');
		await expect(table).not.toContainText('Internal notes');
		await expect(table).not.toContainText('Imported batch');
	});

	test('formats each value by its Kind', async ({ page }) => {
		await page.goto('/admin/recipes');

		const rows = page.getByRole('table').getByRole('row');
		await expect(rows.nth(1).getByRole('cell')).toHaveText([
			'1',
			'Classic Margherita Pizza',
			'Italian',
			'Easy',
			'20',
			'4',
			'250',
			'Yes',
			'Pizza, Vegetarian',
			'1,250',
			// 23:30 UTC on January 1st: the date is in UTC, whatever the time zone.
			'Jan 1, 2024',
			'dj-1'
		]);
		// A long list is cut to three items and "+N".
		await expect(rows.nth(2).getByRole('cell').nth(8)).toHaveText('Vegetarian, Quick, Vegan +2');
		// No and an empty optional Field.
		await expect(rows.nth(3).getByRole('cell').nth(7)).toHaveText('No');
		await expect(rows.nth(3).getByRole('cell').nth(6)).toHaveText('');
	});

	test.describe('in a browser far from UTC, with another language', () => {
		test.use({ timezoneId: 'Pacific/Kiritimati', locale: 'de-DE' });

		test('hydrates without a mismatch and keeps the same formats @js', async ({ page }) => {
			const warnings: string[] = [];
			page.on('console', (message) => {
				if (/hydration/i.test(message.text())) warnings.push(message.text());
			});

			await page.goto('/admin/recipes');
			await page.waitForLoadState('networkidle');

			expect(warnings).toEqual([]);
			const firstRow = page.getByRole('table').getByRole('row').nth(1);
			await expect(firstRow).toContainText('Jan 1, 2024');
			await expect(firstRow).toContainText('1,250');
		});
	});
});
