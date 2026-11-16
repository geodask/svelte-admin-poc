import { expect, hydrated, test } from './fixtures.ts';
import {
	applyFilters,
	backendRequestsDuring,
	backendRequestsFor,
	captureGetList,
	columnCells,
	dataRows,
	expectLanded,
	filterForm,
	filtersToggle,
	isJs,
	names,
	openFilters,
	pager,
	selectedCount,
	uniquePage
} from './list-helpers.ts';

test.describe('filtering recipes by difficulty and vegetarian', () => {
	test('one difficulty filters with eq, two with in, on the server', async ({ page, request }) => {
		// A page size no other test asks for, one per project, so the request log check only finds
		// this test's requests. Every match fits on one page.
		const perPage = isJs() ? 91 : 92;
		await page.goto(`/admin/recipes?perPage=${perPage}`);

		const one = await backendRequestsDuring(request, async () => {
			await applyFilters(page, (form) => form.getByRole('checkbox', { name: 'Hard' }).check());
			await expectLanded(page, `/admin/recipes?perPage=${perPage}&difficulty=Hard`);
			await expect(dataRows(page)).toHaveCount(12);
		});
		expect(one).toContain(`GET /recipes?page=1&perPage=${perPage}&difficulty=Hard`);
		const hard = await (await columnCells(page, 'Difficulty')).allInnerTexts();
		expect(hard.every((text) => text.trim() === 'Hard')).toBe(true);

		const two = await backendRequestsDuring(request, async () => {
			await applyFilters(page, (form) => form.getByRole('checkbox', { name: 'Easy' }).check());
			await expectLanded(page, `/admin/recipes?perPage=${perPage}&difficulty=Easy&difficulty=Hard`);
			await expect(dataRows(page)).toHaveCount(27);
		});
		expect(two).toContain(`GET /recipes?page=1&perPage=${perPage}&difficulty=Easy&difficulty=Hard`);
		const easyOrHard = await (await columnCells(page, 'Difficulty')).allInnerTexts();
		expect(easyOrHard.every((text) => ['Easy', 'Hard'].includes(text.trim()))).toBe(true);

		// The checkboxes show what the list is filtered by.
		await openFilters(page);
		await expect(filterForm(page).getByRole('checkbox', { name: 'Easy' })).toBeChecked();
		await expect(filterForm(page).getByRole('checkbox', { name: 'Medium' })).not.toBeChecked();
		await expect(filterForm(page).getByRole('checkbox', { name: 'Hard' })).toBeChecked();
	});

	test('the vegetarian choice filters both ways and clears with Any', async ({ page }) => {
		await page.goto('/admin/recipes?perPage=100');
		const vegetarianCells = async () =>
			(await (await columnCells(page, 'Vegetarian')).allInnerTexts()).map((text) => text.trim());

		await applyFilters(page, (form) => form.getByRole('radio', { name: 'Yes' }).check());
		await expectLanded(page, '/admin/recipes?perPage=100&vegetarian=true');
		await expect(dataRows(page)).toHaveCount(17);
		expect((await vegetarianCells()).every((text) => text === 'Yes')).toBe(true);

		await applyFilters(page, (form) => form.getByRole('radio', { name: 'No' }).check());
		await expectLanded(page, '/admin/recipes?perPage=100&vegetarian=false');
		await expect(dataRows(page)).toHaveCount(38);
		expect((await vegetarianCells()).every((text) => text === 'No')).toBe(true);

		await applyFilters(page, (form) => form.getByRole('radio', { name: 'Any' }).check());
		await expectLanded(page, '/admin/recipes?perPage=100');
		await expect(dataRows(page)).toHaveCount(55);
	});

	test('two filters combine with AND', async ({ page }) => {
		await page.goto('/admin/recipes');

		await applyFilters(page, async (form) => {
			await form.getByRole('checkbox', { name: 'Hard' }).check();
			await form.getByRole('radio', { name: 'Yes' }).check();
		});

		await expectLanded(page, '/admin/recipes?difficulty=Hard&vegetarian=true');
		await expect(names(page)).toHaveText([
			'Saag (Spinach) with Makki di Roti',
			'South Indian Masala Dosa',
			'Pierogi'
		]);
	});

	test('the toggle counts the filters on, and Clear filters shows the whole list', async ({
		page
	}) => {
		await page.goto('/admin/recipes');
		await expect(filtersToggle(page)).toHaveText(/^\s*Filters\s*$/);

		await page.goto('/admin/recipes?difficulty=Easy&difficulty=Medium&vegetarian=true');
		await expect(filtersToggle(page)).toHaveText(/^\s*Filters\s*2\s*$/);
		await expect(dataRows(page)).toHaveCount(14);

		await openFilters(page);
		await filterForm(page).getByRole('link', { name: 'Clear filters' }).click();

		await expect(page).toHaveURL('/admin/recipes');
		await expect(filtersToggle(page)).toHaveText(/^\s*Filters\s*$/);
		await expect(dataRows(page)).toHaveCount(25);
		await expect(pager(page)).toContainText('of 55');
	});

	test('a filter change starts at page 1 and keeps the search, sort and page size', async ({
		page
	}) => {
		await page.goto('/admin/recipes?page=2&perPage=5&sort=name&q=chicken');

		await applyFilters(page, (form) => form.getByRole('checkbox', { name: 'Easy' }).check());

		await expectLanded(page, '/admin/recipes?perPage=5&sort=name&q=chicken&difficulty=Easy');
		await expect(names(page)).toHaveText(['Chicken Tacos', 'Mango Salsa Chicken']);

		// Clear filters keeps them too.
		await openFilters(page);
		await filterForm(page).getByRole('link', { name: 'Clear filters' }).click();
		await expect(page).toHaveURL('/admin/recipes?perPage=5&sort=name&q=chicken');
	});

	test('pager, page-size, sort and search links keep the filters', async ({ page }) => {
		await page.goto('/admin/recipes?perPage=5&difficulty=Hard');

		await pager(page).getByRole('link', { name: 'Next' }).click();
		await expect(page).toHaveURL('/admin/recipes?page=2&perPage=5&difficulty=Hard');

		await pager(page).getByRole('link', { name: '10 rows per page' }).click();
		await expect(page).toHaveURL('/admin/recipes?perPage=10&difficulty=Hard');

		await page.getByRole('columnheader', { name: 'Name', exact: true }).getByRole('link').click();
		await expect(page).toHaveURL('/admin/recipes?perPage=10&sort=name&difficulty=Hard');
		await expect(names(page).first()).toHaveText('Brazilian Feijoada');

		const searchBox = page.getByRole('searchbox', { name: 'Search recipes' });
		await searchBox.fill('chicken');
		await searchBox.press('Enter');
		// Without JavaScript the search form posts its hidden inputs before the search box.
		await expect(page).toHaveURL(
			isJs()
				? '/admin/recipes?perPage=10&sort=name&q=chicken&difficulty=Hard'
				: '/admin/recipes?perPage=10&sort=name&difficulty=Hard&q=chicken'
		);
		await expect(names(page)).toHaveText(['Chicken Biryani']);
	});

	test('selected rows stay selected across a filter change @js', async ({ page }) => {
		await page.goto('/admin/recipes');
		await hydrated(page);
		await page.getByRole('checkbox', { name: 'Select Classic Margherita Pizza' }).check();
		await page.getByRole('checkbox', { name: 'Select Chicken Alfredo Pasta' }).check();

		await applyFilters(page, (form) => form.getByRole('checkbox', { name: 'Easy' }).check());
		await expect(page).toHaveURL('/admin/recipes?difficulty=Easy');

		await expect(selectedCount(page)).toHaveText('2 selected');
		await expect(
			page.getByRole('checkbox', { name: 'Select Classic Margherita Pizza' })
		).toBeChecked();
	});

	test('Back undoes a filter change @js', async ({ page }) => {
		await page.goto('/admin/recipes');
		await hydrated(page);

		await applyFilters(page, (form) => form.getByRole('checkbox', { name: 'Hard' }).check());
		await expect(page).toHaveURL('/admin/recipes?difficulty=Hard');
		await expect(dataRows(page)).toHaveCount(12);

		await page.goBack();
		await expect(page).toHaveURL('/admin/recipes');
		await expect(dataRows(page)).toHaveCount(25);
	});

	test('submitting the panel with every control blank shows the whole list', async ({ page }) => {
		await page.goto('/admin/recipes?perPage=10');

		await applyFilters(page, async () => {});

		// Without JavaScript the form posts its blank controls; the list ignores them.
		await expectLanded(page, '/admin/recipes?perPage=10');
		const posted = new URL(page.url()).searchParams;
		if (isJs()) {
			expect([...posted.values()]).not.toContain('');
		} else {
			expect(posted.get('vegetarian')).toBe('');
			expect(posted.get('name.contains')).toBe('');
			expect(posted.get('prepTimeMinutes.gte')).toBe('');
		}
		await expect(dataRows(page)).toHaveCount(10);
		await expect(names(page).first()).toHaveText('Classic Margherita Pizza');
		await expect(filtersToggle(page)).toHaveText(/^\s*Filters\s*$/);
	});
});

test.describe('an empty filtered list', () => {
	test('says no records match the search and the filters', async ({ page }) => {
		await page.goto('/admin/recipes?q=chicken&vegetarian=true');

		await expect(page.getByText('No recipes match “chicken” and the filters.')).toBeVisible();
	});

	test('says no records match the filters, in the replaced users View too', async ({ page }) => {
		await page.goto('/admin/users?role=admin&active=false');

		await expect(page.getByText('No users match the filters.')).toBeVisible();
	});
});

test.describe('a list URL with filters it cannot use', () => {
	for (const [what, search, rows, first] of [
		['an unknown filter', '?rating=5&foo=bar', 25, 'Classic Margherita Pizza'],
		['a bad enum value', '?difficulty=Spicy', 25, 'Classic Margherita Pizza'],
		['a non-boolean vegetarian', '?vegetarian=maybe', 25, 'Classic Margherita Pizza'],
		['a bad value beside a good one', '?difficulty=Hard&vegetarian=yes', 12, 'Chicken Biryani']
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
			['?rating=5&page=2', '/admin/recipes?page=2'],
			['?difficulty=Spicy', '/admin/recipes'],
			['?vegetarian=maybe&difficulty=Easy', '/admin/recipes?difficulty=Easy'],
			['?vegetarian=', '/admin/recipes'],
			['?difficulty=Hard&difficulty=Easy', '/admin/recipes?difficulty=Easy&difficulty=Hard']
		]) {
			await page.goto(`/admin/recipes${search}`);
			await expect(page).toHaveURL(clean);
		}
	});
});

test.describe('the getList remote function with filters', () => {
	test('is rejected for a filter the Resource does not allow, before the Provider @js', async ({
		page,
		request
	}) => {
		await page.goto('/admin/recipes');
		const call = await captureGetList(page, request, () =>
			pager(page).getByRole('link', { name: 'Next' }).click()
		);
		const marker = uniquePage();

		for (const filters of [
			// Servings aren't filterable.
			[{ field: 'servings', operator: 'eq', value: 4 }],
			// Cuisine is narrowed to exact matches.
			[{ field: 'cuisine', operator: 'contains', value: 'Ital' }],
			// An enum has no range.
			[{ field: 'difficulty', operator: 'gte', value: 'Easy' }],
			// A boolean has no `in`.
			[{ field: 'vegetarian', operator: 'in', value: [true, false] }],
			// An `in` of 101 values (the core's unit tests check the bound with distinct ones).
			[
				{
					field: 'difficulty',
					operator: 'in',
					value: Array.from({ length: 101 }, (_, i) => ['Easy', 'Medium', 'Hard'][i % 3])
				}
			],
			// The same Field and operator twice.
			[
				{ field: 'vegetarian', operator: 'eq', value: true },
				{ field: 'vegetarian', operator: 'eq', value: false }
			]
		]) {
			const rejected = await call({ page: marker, filters });
			expect(await rejected.json()).toMatchObject({ type: 'error', error: { status: 400 } });
		}
		expect(await backendRequestsFor(request, marker)).toEqual([]);

		const good = await call({
			page: marker,
			filters: [
				{ field: 'vegetarian', operator: 'eq', value: true },
				{ field: 'difficulty', operator: 'in', value: ['Hard', 'Easy'] }
			]
		});
		expect(await good.json()).toMatchObject({ type: 'result' });
		// In the canonical form: schema order, values in the enum's order.
		expect(await backendRequestsFor(request, marker)).toEqual([
			`GET /recipes?page=${marker}&perPage=25&difficulty=Easy&difficulty=Hard&vegetarian=true`
		]);
	});
});

test.describe('filtering the other Resources', () => {
	test('posts filter by status', async ({ page }) => {
		await page.goto('/admin/posts');

		await applyFilters(page, (form) => form.getByRole('checkbox', { name: 'draft' }).check());

		await expectLanded(page, '/admin/posts?status=draft');
		await expect(dataRows(page)).toHaveCount(15);
		const statuses = await (await columnCells(page, 'Status')).allInnerTexts();
		expect(statuses.every((text) => text.trim() === 'draft')).toBe(true);
	});

	test('the replaced users card list gets the filter panel through the Toolbar', async ({
		page
	}) => {
		await page.goto('/admin/users');
		const cards = page.getByRole('list', { name: 'Users' }).getByRole('listitem');

		await applyFilters(page, async (form) => {
			await form.getByRole('checkbox', { name: 'editor' }).check();
			await form.getByRole('radio', { name: 'No' }).check();
		});

		await expectLanded(page, '/admin/users?role=editor&active=false');
		await expect(cards).toHaveCount(3);
		// In the default order, by name.
		await expect(cards.nth(0)).toContainText('Katherine Johnson');
		await expect(cards.nth(1)).toContainText('Margaret Hamilton');
		await expect(cards.nth(2)).toContainText('Radia Perlman');
		await expect(filtersToggle(page)).toHaveText(/^\s*Filters\s*2\s*$/);
	});
});
