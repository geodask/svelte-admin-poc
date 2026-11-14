import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../backend/config.ts';
import { expect, hydrated, test } from './fixtures.ts';

/** The value shown beside a top-level Field label on the detail View. */
const valueOf = (page: Page, label: string) =>
	page.locator(`xpath=//dt[normalize-space(text())="${label}"]/following-sibling::dd[1]`).first();

/** The demo backend's log of resource requests, e.g. `GET /recipes/1`. */
async function backendLog(request: APIRequestContext) {
	return (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
}

/**
 * The backend requests that reached post 59, encoded or not. Tests run in parallel against one
 * backend, and no other test asks for post 59, so any such request came from the crafted id.
 */
async function requestsForPost59(request: APIRequestContext) {
	return (await backendLog(request)).filter((line) => /posts(\/|%2F)59/i.test(line));
}

test.describe('the recipes detail View', () => {
	test('opens from the list, with the Record title as its heading', async ({ page }) => {
		await page.goto('/admin/recipes');

		await page.getByRole('link', { name: 'Classic Margherita Pizza' }).click();

		await expect(page).toHaveURL('/admin/recipes/1');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Classic Margherita Pizza' })
		).toBeVisible();
		await expect(page).toHaveTitle('Classic Margherita Pizza · Recipes');

		await page.getByRole('link', { name: 'Recipes' }).click();
		await expect(page).toHaveURL('/admin/recipes');
		await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
	});

	test('is rendered on the server', async ({ page }) => {
		const response = await page.goto('/admin/recipes/2');

		expect(response?.status()).toBe(200);
		const html = (await response?.text()) ?? '';
		expect(html).toContain('Vegetarian Stir-Fry');
		expect(html).toContain('Prepare the ingredients for Vegetarian Stir-Fry');
	});

	test("shows every Field that isn't hidden, in schema order, including left-off ones", async ({
		page
	}) => {
		await page.goto('/admin/recipes/2');

		// Nested terms are the object Field's own Fields, under its label.
		await expect(page.getByRole('term')).toHaveText([
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
			'Source ID',
			'Nutrition',
			'Protein grams',
			'Carbs grams',
			// `list: false`, so only here, with its description.
			'Instructions How to cook it'
		]);
		await expect(page.locator('main')).not.toContainText('Internal notes');
		await expect(page.locator('main')).not.toContainText('Imported batch');
	});

	test('formats each value by its Kind, not as JSON', async ({ page }) => {
		await page.goto('/admin/recipes/2');

		await expect(valueOf(page, 'ID')).toHaveText('2');
		await expect(valueOf(page, 'Name')).toHaveText('Vegetarian Stir-Fry');
		await expect(valueOf(page, 'Difficulty')).toHaveText('Medium');
		await expect(valueOf(page, 'Calories')).toHaveText('265');
		await expect(valueOf(page, 'Vegetarian')).toHaveText('Yes');
		// The whole list, not cut to three items as in the list View.
		await expect(valueOf(page, 'Tags')).toHaveText('Vegetarian, Quick, Vegan, Healthy, Weeknight');
		await expect(valueOf(page, 'Review count')).toHaveText('1,287');
		// 23:30 UTC on January 8th: the date is in UTC, whatever the time zone.
		await expect(valueOf(page, 'Published at')).toHaveText('Jan 8, 2024');
		await expect(valueOf(page, 'Source ID')).toHaveText('9,001');
		await expect(valueOf(page, 'Protein grams')).toHaveText('11');
		await expect(valueOf(page, 'Carbs grams')).toHaveText('42');
		await expect(valueOf(page, 'Instructions')).toHaveText(
			'Prepare the ingredients for Vegetarian Stir-Fry, then cook and serve.'
		);
		await expect(page.locator('main')).not.toContainText('{');
	});

	test('shows an empty optional Field as a dash', async ({ page }) => {
		await page.goto('/admin/recipes/3');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chocolate Chip Cookies');
		await expect(valueOf(page, 'Calories')).toHaveText('—');
		await expect(valueOf(page, 'Vegetarian')).toHaveText('No');
	});

	test('names a post by its title, its Record title', async ({ page }) => {
		await page.goto('/admin/posts');

		await page
			.getByRole('link', { name: 'A beginner guide to weeknight dinners (part 1)' })
			.click();

		await expect(page).toHaveURL('/admin/posts/1');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(
			'A beginner guide to weeknight dinners (part 1)'
		);
		await expect(valueOf(page, 'Body')).toHaveText('Notes on weeknight dinners.');
	});

	test.describe('in a browser far from UTC, with another language', () => {
		test.use({ timezoneId: 'Pacific/Kiritimati', locale: 'de-DE' });

		test('hydrates without a mismatch and keeps the same formats @js', async ({ page }) => {
			const warnings: string[] = [];
			page.on('console', (message) => {
				if (/hydration/i.test(message.text())) warnings.push(message.text());
			});

			await page.goto('/admin/recipes/2');
			await hydrated(page);
			await page.waitForLoadState('networkidle');

			expect(warnings).toEqual([]);
			await expect(valueOf(page, 'Published at')).toHaveText('Jan 8, 2024');
			await expect(valueOf(page, 'Review count')).toHaveText('1,287');
		});
	});
});

test.describe('a recipe id that parses but names no recipe', () => {
	test('shows "not found" and links back to the recipes list, not the error page', async ({
		page
	}) => {
		const response = await page.goto('/admin/recipes/999');

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
		await expect(page).toHaveTitle('Not found · Recipes');

		await page.getByRole('link', { name: 'Back to Recipes' }).click();

		await expect(page).toHaveURL('/admin/recipes');
		await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
	});

	test('shows "not found" when opened from another record @js', async ({ page }) => {
		await page.goto('/admin/recipes/1');
		await hydrated(page);

		// A client-side navigation, so the remote getOne fails in the browser, not during SSR.
		await page.evaluate(() => {
			const link = document.createElement('a');
			link.href = '/admin/recipes/999';
			link.textContent = 'A missing recipe';
			document.querySelector('main')?.append(link);
		});
		await page.getByRole('link', { name: 'A missing recipe' }).click();

		await expect(page).toHaveURL('/admin/recipes/999');
		await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Back to Recipes' })).toHaveAttribute(
			'href',
			'/admin/recipes'
		);
	});
});

test.describe('a recipe id that names no recipe', () => {
	for (const param of ['abc', '01', '1.0', '1e0']) {
		test(`/admin/recipes/${param} is a 404 page that never asks the backend`, async ({
			page,
			request
		}) => {
			const response = await page.goto(`/admin/recipes/${param}`);

			expect(response?.status()).toBe(404);
			await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
			expect(await backendLog(request)).not.toContain(`GET /recipes/${param}`);
		});
	}

	test('..%2Fposts%2F59 is a 404 page and never reaches a post', async ({ page, request }) => {
		const response = await page.goto('/admin/recipes/..%2Fposts%2F59');

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
		await expect(page.locator('body')).not.toContainText('Myths about knife skills');
		expect(await requestsForPost59(request)).toEqual([]);
	});

	test('a crafted string id sent to the remote getOne is rejected before the Provider @js', async ({
		page,
		request
	}) => {
		await page.goto('/admin/recipes');
		await hydrated(page);
		const remoteResponse = page.waitForResponse((r) => r.url().includes('/_app/remote/'));
		await page.getByRole('link', { name: 'Vegetarian Stir-Fry' }).click();
		const captured = new URL((await remoteResponse).url());

		// The browser's own call: Kit's url-safe base64 of the devalue-encoded id, 2.
		const payload = captured.searchParams.get('payload') ?? '';
		expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual([2]);

		// The same query with the id as a string that would climb to a post.
		const crafted = Buffer.from(JSON.stringify(['../posts/59'])).toString('base64url');
		const response = await request.get(`${captured.pathname}?payload=${crafted}`);

		expect(await response.json()).toMatchObject({ type: 'error', error: { status: 400 } });
		expect(await requestsForPost59(request)).toEqual([]);
	});
});
