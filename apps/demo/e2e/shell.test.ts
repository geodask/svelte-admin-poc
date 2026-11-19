import type { Page } from '@playwright/test';
import { expect, hydrated, test } from './fixtures.ts';
import { serverLog } from './server-log.ts';

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

	// Each list asks its own remote functions for its own sort: posts open sorted by id, which
	// recipes can't sort by. A switch that paired the new Resource with the old one's remote
	// functions, even for a moment, would ask the old ones for the new list, and they'd reject it.
	for (const { from, fromLabel, to } of [
		{
			from: '/admin/users?sort=joinedAt&order=desc&role=editor',
			fromLabel: 'Users',
			to: 'Recipes'
		},
		{
			from: '/admin/recipes?sort=name&order=desc&difficulty=Easy',
			fromLabel: 'Recipes',
			to: 'Posts'
		},
		{
			from: '/admin/posts?sort=viewCount&order=desc&status=published',
			fromLabel: 'Posts',
			to: 'Recipes'
		}
	]) {
		test(`moves from a sorted and filtered list of ${fromLabel} to ${to} @js`, async ({ page }) => {
			const rejected: string[] = [];
			page.on('response', (response) => {
				if (response.url().includes('/_app/remote/') && response.status() >= 400) {
					rejected.push(`${response.status()} ${response.url()}`);
				}
			});
			await page.goto(from);
			await hydrated(page);
			const logBefore = (await serverLog()).length;

			await resourceNav(page).getByRole('link', { name: to }).click();

			await expect(page).toHaveURL(`/admin/${to.toLowerCase()}`);
			await expect(page.getByRole('heading', { level: 1, name: to })).toBeVisible();
			await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible();
			await expect(page.getByRole('alert')).toHaveCount(0);
			expect(rejected).toEqual([]);
			// Nor did the old Resource's remote functions fail their schema on the server.
			const logged = (await serverLog()).slice(logBefore);
			expect(logged).not.toContain(
				`${fromLabel.toLowerCase()}.remote.ts) schema validation failed`
			);
		});
	}

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

test('every sidebar and breadcrumb href is under /admin', async ({ page }) => {
	await page.goto('/admin/users/2');
	await expect(breadcrumb(page).getByRole('listitem')).toHaveText(['Users', 'Grace Hopper']);

	const hrefs = await sidebar(page)
		.or(breadcrumb(page))
		.getByRole('link')
		.evaluateAll((links) => links.map((link) => link.getAttribute('href')));

	expect(hrefs).toEqual([
		// The brand, which leads to the first Resource.
		'/admin/recipes',
		// The Resource links.
		'/admin/recipes',
		'/admin/posts',
		'/admin/users',
		// The breadcrumb back to the list.
		'/admin/users'
	]);
});

test.describe('on the create View', () => {
	test('keeps the Resource active and reads Resource / New in the breadcrumb', async ({ page }) => {
		await page.goto('/admin/users/new');

		await expect(resourceNav(page).getByRole('link', { name: 'Users' })).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect(resourceNav(page).locator('a[aria-current]')).toHaveCount(1);
		await expect(breadcrumb(page).getByRole('listitem')).toHaveText(['Users', 'New']);
		await breadcrumb(page).getByRole('link', { name: 'Users' }).click();
		await expect(page).toHaveURL('/admin/users');
	});
});

test.describe('on the edit View', () => {
	test('keeps the Resource active and reads Resource / Record title / Edit', async ({ page }) => {
		await page.goto('/admin/users/2/edit');

		await expect(resourceNav(page).getByRole('link', { name: 'Users' })).toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect(resourceNav(page).locator('a[aria-current]')).toHaveCount(1);
		await expect(breadcrumb(page).getByRole('listitem')).toHaveText([
			'Users',
			'Grace Hopper',
			'Edit'
		]);
		await expect(breadcrumb(page).getByRole('link', { name: 'Users' })).toHaveAttribute(
			'href',
			'/admin/users'
		);

		await breadcrumb(page).getByRole('link', { name: 'Grace Hopper' }).click();

		await expect(page).toHaveURL('/admin/users/2');
	});
});
