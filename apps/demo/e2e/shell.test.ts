import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { dataRows } from './list-helpers.ts';

const sidebar = (page: Page) => page.getByRole('complementary');
const resourceNav = (page: Page) => page.getByRole('navigation', { name: 'Resources' });
const breadcrumb = (page: Page) => page.getByRole('navigation', { name: 'breadcrumb' });

test.describe('the sidebar', () => {
	test('lists every Resource under its group, each with its icon', async ({ page }) => {
		await page.goto('/admin/posts');

		const nav = resourceNav(page);
		await expect(nav.getByRole('group', { name: 'Content' }).getByRole('link')).toHaveText([
			'Recipes',
			'Posts'
		]);
		await expect(nav.getByRole('group', { name: 'People' }).getByRole('link')).toHaveText([
			'Users'
		]);
		await expect(
			nav.getByRole('link', { name: 'Recipes' }).locator('svg.lucide-chef-hat')
		).toHaveCount(1);
		await expect(
			nav.getByRole('link', { name: 'Posts' }).locator('svg.lucide-newspaper')
		).toHaveCount(1);
		await expect(nav.getByRole('link', { name: 'Users' }).locator('svg.lucide-users')).toHaveCount(
			1
		);
	});

	test('marks the current Resource active on its list View', async ({ page }) => {
		await page.goto('/admin/users');

		await expect(resourceNav(page).getByRole('link', { name: 'Users' })).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect(resourceNav(page).locator('a[aria-current]')).toHaveCount(1);
	});

	test('keeps the Resource active on its detail View', async ({ page }) => {
		await page.goto('/admin/recipes/1');

		await expect(resourceNav(page).getByRole('link', { name: 'Recipes' })).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect(resourceNav(page).locator('a[aria-current]')).toHaveCount(1);
	});

	test('moves between Resources', async ({ page }) => {
		await page.goto('/admin/recipes');

		await resourceNav(page).getByRole('link', { name: 'Users' }).click();

		await expect(page).toHaveURL('/admin/users');
		await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
		await expect(resourceNav(page).getByRole('link', { name: 'Users' })).toHaveAttribute(
			'aria-current',
			'true'
		);
	});

	test("shows the app's brand and user menu", async ({ page }) => {
		await page.goto('/admin/recipes');

		await expect(sidebar(page).getByText('Ada Lovelace')).toBeVisible();
		await sidebar(page).getByText('ada@example.com').click();
		await expect(sidebar(page).getByText('The demo has no sign-in.')).toBeVisible();

		await page.goto('/admin/users');
		await sidebar(page).getByRole('link', { name: 'Svelte Admin Demo' }).click();
		await expect(page).toHaveURL('/admin/recipes');
	});
});

test.describe('the breadcrumb', () => {
	test('shows the Resource on its list View', async ({ page }) => {
		await page.goto('/admin/recipes');

		await expect(breadcrumb(page).getByRole('listitem')).toHaveText(['Recipes']);
		await expect(breadcrumb(page).getByRole('link')).toHaveCount(0);
	});

	test('leads from a detail View back to its list, then names the record', async ({ page }) => {
		await page.goto('/admin/recipes/1');

		await expect(breadcrumb(page).getByRole('listitem')).toHaveText([
			'Recipes',
			'Classic Margherita Pizza'
		]);
		await breadcrumb(page).getByRole('link', { name: 'Recipes' }).click();

		await expect(page).toHaveURL('/admin/recipes');
		await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
	});

	test('says "Not found" for a record that does not exist', async ({ page }) => {
		await page.goto('/admin/users/999');

		await expect(breadcrumb(page).getByRole('listitem')).toHaveText(['Users', 'Not found']);
	});
});

test('every Resource link and breadcrumb href is under /admin', async ({ page }) => {
	await page.goto('/admin/users/2');
	await expect(breadcrumb(page).getByRole('listitem')).toHaveText(['Users', 'Grace Hopper']);

	const hrefs = await resourceNav(page)
		.or(breadcrumb(page))
		.getByRole('link')
		.evaluateAll((links) => links.map((link) => link.getAttribute('href')));

	expect(hrefs).toEqual(['/admin/recipes', '/admin/posts', '/admin/users', '/admin/users']);
});

test('the users list shows the seeded users and searches them by name', async ({ page }) => {
	await page.goto('/admin/users?q=grace');

	await expect(dataRows(page)).toHaveCount(1);
	await expect(dataRows(page).first()).toContainText('Grace Hopper');
	await expect(dataRows(page).first()).toContainText('grace@example.com');
});
