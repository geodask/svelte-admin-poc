// Deleting the selected rows from the list View. These tests write to the demo backend and
// inject faults into it, so they run one at a time, after the read-only tests, with nothing
// beside them (see playwright.config.ts). Bulk delete needs JavaScript, so without it only the
// absence of its button is checked.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, hydrated, injectFault, test } from '../fixtures.ts';
import { dataRows, openInSidebar, pager, selectedCount } from '../list-helpers.ts';
import { serverLog } from '../server-log.ts';

/** Every request the demo backend has received so far (it keeps them across resets). */
async function backendLog(request: APIRequestContext): Promise<string[]> {
	return (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
}

/** The deletes the backend received since `before` (a length of its log), of any Resource. */
async function deletesSince(request: APIRequestContext, before: number) {
	return (await backendLog(request)).slice(before).filter((line) => line.startsWith('DELETE '));
}

/** Whether the demo backend still holds the record, read past the admin. */
async function stored(request: APIRequestContext, resource: string, id: number) {
	return (await request.get(`${BACKEND_URL}/${resource}/${id}`)).ok();
}

/**
 * Collect what reaches the page as an uncaught error, which includes an unhandled promise
 * rejection.
 */
function uncaughtErrors(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	return errors;
}

/** Open a list View, hydrated, so its rows can be selected. */
async function openList(page: Page, path: string) {
	await page.goto(path);
	await hydrated(page);
}

const rowCheckbox = (page: Page, title: string) =>
	page.getByRole('checkbox', { name: `Select ${title}`, exact: true });

const bulkDeleteButton = (page: Page) => page.getByRole('button', { name: /^Delete selected/ });
const dialog = (page: Page) => page.getByRole('dialog');
const confirmButton = (page: Page) =>
	dialog(page).getByRole('button', { name: 'Delete', exact: true });

test.describe('deleting the selected rows from the list View', () => {
	test('counts rows selected on every page, deletes them all, clears the selection and refreshes the list @js', async ({
		page,
		request
	}) => {
		const errors = uncaughtErrors(page);
		const before = (await backendLog(request)).length;
		await openList(page, '/admin/recipes');
		await expect(bulkDeleteButton(page)).toHaveCount(0);

		await rowCheckbox(page, 'Classic Margherita Pizza').check();
		await rowCheckbox(page, 'Vegetarian Stir-Fry').check();
		await expect(bulkDeleteButton(page)).toHaveText('Delete selected (2)');
		await pager(page).getByRole('link', { name: 'Next' }).click();
		await expect(page).toHaveURL('/admin/recipes?page=2');
		await rowCheckbox(page, 'Brazilian Feijoada').check();

		await bulkDeleteButton(page).click();

		await expect(dialog(page).getByRole('heading')).toHaveText(
			'Delete 3 selected records from Recipes?'
		);
		await expect(dialog(page)).toContainText("This can't be undone.");

		await confirmButton(page).click();

		await expect(dialog(page)).toHaveCount(0);
		await expect(selectedCount(page)).toHaveCount(0);
		await expect(bulkDeleteButton(page)).toHaveCount(0);
		// Page 2 now starts three recipes later: two left page 1, and Brazilian Feijoada is gone.
		await expect(page).toHaveURL('/admin/recipes?page=2');
		await expect(dataRows(page).first()).toContainText('Hawaiian Poke Bowl');
		await expect(page.getByRole('main')).not.toContainText('Brazilian Feijoada');
		await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);
		// The recipes Provider has no bulk route, so each recipe was deleted on its own.
		expect(await deletesSince(request, before)).toEqual([
			'DELETE /recipes/1',
			'DELETE /recipes/2',
			'DELETE /recipes/26'
		]);
		for (const id of [1, 2, 26]) expect(await stored(request, 'recipes', id)).toBe(false);
		expect(errors).toEqual([]);

		await pager(page).getByRole('link', { name: 'Previous' }).click();
		await expect(dataRows(page).first()).toContainText('Chocolate Chip Cookies');
	});

	test('names a single selected record in the singular @js', async ({ page }) => {
		await openList(page, '/admin/recipes');
		await rowCheckbox(page, 'Caprese Salad').check();

		await bulkDeleteButton(page).click();

		await expect(dialog(page).getByRole('heading')).toHaveText(
			'Delete 1 selected record from Recipes?'
		);
		await dialog(page).getByRole('button', { name: 'Cancel' }).click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(selectedCount(page)).toHaveText('1 selected');
	});

	test('deletes selected posts with one request to the bulk route @js', async ({
		page,
		request
	}) => {
		const before = (await backendLog(request)).length;
		// Oldest first, so posts 1 and 2 are on the first page.
		await openList(page, '/admin/posts?sort=id');
		await rowCheckbox(page, 'A beginner guide to weeknight dinners (part 1)').check();
		await rowCheckbox(page, 'Ten tips for baking bread (part 1)').check();

		await bulkDeleteButton(page).click();
		await expect(dialog(page).getByRole('heading')).toHaveText(
			'Delete 2 selected records from Posts?'
		);
		await confirmButton(page).click();

		await expect(dialog(page)).toHaveCount(0);
		await expect(page.getByRole('main')).not.toContainText(
			'A beginner guide to weeknight dinners (part 1)'
		);
		await expect(selectedCount(page)).toHaveCount(0);
		expect(await deletesSince(request, before)).toEqual(['DELETE /posts?id=1&id=2']);
		expect(await stored(request, 'posts', 1)).toBe(false);
		expect(await stored(request, 'posts', 2)).toBe(false);
	});

	test('reports how many were deleted when it fails partway, and keeps the rest selected @js', async ({
		page,
		request
	}) => {
		const errors = uncaughtErrors(page);
		const marker = `Disk full on shard ${crypto.randomUUID()}`;
		await openList(page, '/admin/recipes');
		// Recipes 3, 4 and 5, in that order: the second one fails.
		await rowCheckbox(page, 'Chocolate Chip Cookies').check();
		await rowCheckbox(page, 'Chicken Alfredo Pasta').check();
		await rowCheckbox(page, 'Mango Salsa Chicken').check();
		await injectFault(request, {
			status: 500,
			message: marker,
			path: '/recipes/4',
			method: 'DELETE'
		});

		await bulkDeleteButton(page).click();
		await confirmButton(page).click();

		const alert = dialog(page).getByRole('alert');
		await expect(alert).toContainText('An unexpected error occurred.');
		await expect(alert).toContainText('1 of 3 records was deleted.');
		await expect(dialog(page)).not.toContainText(marker);
		// The user sees a safe message; the server log keeps what the backend said.
		expect(await serverLog()).toContain(marker);
		// The heading now counts what is still selected, ready to try again.
		await expect(dialog(page).getByRole('heading')).toHaveText(
			'Delete 2 selected records from Recipes?'
		);
		await expect(dialog(page).getByRole('button', { name: 'Try again' })).toBeFocused();
		expect(await stored(request, 'recipes', 3)).toBe(false);
		expect(await stored(request, 'recipes', 4)).toBe(true);
		expect(await stored(request, 'recipes', 5)).toBe(true);

		await dialog(page).getByRole('button', { name: 'Cancel' }).click();

		await expect(dialog(page)).toHaveCount(0);
		await expect(page.getByRole('main')).not.toContainText('Chocolate Chip Cookies');
		await expect(rowCheckbox(page, 'Chicken Alfredo Pasta')).toBeChecked();
		await expect(rowCheckbox(page, 'Mango Salsa Chicken')).toBeChecked();
		await expect(selectedCount(page)).toHaveText('2 selected');
		expect(errors).toEqual([]);

		await bulkDeleteButton(page).click();
		await confirmButton(page).click();

		await expect(dialog(page)).toHaveCount(0);
		await expect(selectedCount(page)).toHaveCount(0);
		await expect(page.getByRole('main')).not.toContainText('Chicken Alfredo Pasta');
		await expect(page.getByRole('main')).not.toContainText('Mango Salsa Chicken');
		expect(errors).toEqual([]);
	});

	test('carries no selection into another Resource, so there is nothing to delete there @js', async ({
		page
	}) => {
		await openList(page, '/admin/recipes');
		await rowCheckbox(page, 'Classic Margherita Pizza').check();
		await rowCheckbox(page, 'Vegetarian Stir-Fry').check();
		await expect(bulkDeleteButton(page)).toHaveText('Delete selected (2)');

		await openInSidebar(page, 'Posts');

		await expect(page.getByRole('heading', { level: 1, name: 'Posts' })).toBeVisible();
		// Newest first, the posts' default sort.
		await expect(dataRows(page).first()).toContainText('A week of seasonal vegetables (part 8)');
		await expect(selectedCount(page)).toHaveCount(0);
		await expect(bulkDeleteButton(page)).toHaveCount(0);
	});

	test('the server refuses no ids, and more than 1,000, as invalid input @js', async ({
		page,
		request,
		baseURL
	}) => {
		await openList(page, '/admin/recipes');
		await rowCheckbox(page, 'Classic Margherita Pizza').check();
		// Learn the bulk delete command's URL from the browser's own call, without sending it:
		// Kit names remote functions by a hash.
		const commandUrl = new Promise<string>((resolve) => {
			void page.route('**/_app/remote/**', (route) => {
				if (route.request().method() !== 'POST') return route.continue();
				resolve(route.request().url());
				return route.abort();
			});
		});
		await bulkDeleteButton(page).click();
		await confirmButton(page).click();
		const url = await commandUrl;
		const before = (await backendLog(request)).length;

		/** Call the command with these ids, as Kit's client would send them (devalue, base64url). */
		const callWith = async (ids: number[]) => {
			const devalued = JSON.stringify([ids.map((_, index) => index + 1), ...ids]);
			const response = await request.post(url, {
				headers: { origin: baseURL ?? '' },
				data: { payload: Buffer.from(devalued).toString('base64url'), refreshes: [] }
			});
			return (await response.json()) as { type: string; error?: { status: number } };
		};

		for (const ids of [[], Array.from({ length: 1001 }, (_, index) => index + 1)]) {
			const answer = await callWith(ids);
			expect(answer.type).toBe('error');
			expect(answer.error?.status).toBe(400);
		}
		expect(await deletesSince(request, before)).toEqual([]);
		// The same call with one id is accepted: it is the ids that were refused.
		expect(await callWith([999_999])).toMatchObject({ type: 'result' });
		expect(await deletesSince(request, before)).toEqual(['DELETE /recipes/999999']);
		// The aborted call left the dialog open with a failure, and nothing deleted.
		await expect(dialog(page).getByRole('button', { name: 'Try again' })).toBeVisible();
		expect(await stored(request, 'recipes', 1)).toBe(true);
	});

	test('shows no bulk delete button without JavaScript', async ({ page }) => {
		test.skip(
			test.info().project.use.javaScriptEnabled !== false,
			'Only a page without JavaScript must hide the button'
		);

		await page.goto('/admin/recipes');

		await expect(dataRows(page)).toHaveCount(25);
		await expect(page.getByRole('link', { name: 'New' })).toBeVisible();
		await expect(bulkDeleteButton(page)).toHaveCount(0);
	});
});
