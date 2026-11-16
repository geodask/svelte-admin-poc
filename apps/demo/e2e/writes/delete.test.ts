// Deleting a record from its detail View. These tests write to the demo backend and inject
// faults into it, so they run one at a time, after the read-only tests, with nothing beside them
// (see playwright.config.ts). Deleting needs JavaScript, so without it only the absence of the
// Delete button is checked.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, hydrated, injectFault, test } from '../fixtures.ts';
import { dataRows } from '../list-helpers.ts';

const usesJavaScript = () => test.info().project.use.javaScriptEnabled !== false;

/** The `DELETE /recipes/...` requests the demo backend has received so far. */
async function recipeDeletes(request: APIRequestContext) {
	const log = (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
	return log.filter((line) => line.startsWith('DELETE /recipes/'));
}

/** Whether the demo backend still holds the recipe, read past the admin. */
async function recipeStored(request: APIRequestContext, id: number) {
	return (await request.get(`${BACKEND_URL}/recipes/${id}`)).ok();
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

/** Open a recipe's detail View, hydrated, so its Delete button is there. */
async function openRecipe(page: Page, id: number) {
	await page.goto(`/admin/recipes/${id}`);
	await hydrated(page);
}

const deleteButton = (page: Page) => page.getByRole('button', { name: 'Delete', exact: true });
const dialog = (page: Page) => page.getByRole('dialog');
const confirmButton = (page: Page) =>
	dialog(page).getByRole('button', { name: 'Delete', exact: true });

test.describe('deleting a recipe from its detail View', () => {
	test('opens a dialog that names the recipe, and Cancel deletes nothing @js', async ({
		page,
		request
	}) => {
		const before = (await recipeDeletes(request)).length;
		await openRecipe(page, 2);

		await deleteButton(page).click();

		await expect(dialog(page)).toBeVisible();
		await expect(dialog(page).getByRole('heading')).toHaveText('Delete Vegetarian Stir-Fry?');
		await expect(dialog(page)).toContainText("This can't be undone.");

		await dialog(page).getByRole('button', { name: 'Cancel' }).click();

		await expect(dialog(page)).toHaveCount(0);
		await expect(page).toHaveURL('/admin/recipes/2');
		expect((await recipeDeletes(request)).length).toBe(before);
		expect(await recipeStored(request, 2)).toBe(true);
	});

	test('lands on the recipes list without the recipe once confirmed @js', async ({
		page,
		request
	}) => {
		const errors = uncaughtErrors(page);
		await openRecipe(page, 2);

		await deleteButton(page).click();
		await confirmButton(page).click();

		await expect(page).toHaveURL('/admin/recipes');
		await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
		await expect(dataRows(page).first()).toContainText('Classic Margherita Pizza');
		// The third recipe moved up into the second row.
		await expect(dataRows(page).nth(1)).toContainText('Chocolate Chip Cookies');
		await expect(page.getByRole('main')).not.toContainText('Vegetarian Stir-Fry');
		expect(await recipeDeletes(request)).toContain('DELETE /recipes/2');
		expect(await recipeStored(request, 2)).toBe(false);
		expect(errors).toEqual([]);
	});

	test('shows progress while the delete runs @js', async ({ page, request }) => {
		await openRecipe(page, 2);
		await injectFault(request, { delayMs: 1500, path: '/recipes/2', method: 'DELETE' });

		await deleteButton(page).click();
		await confirmButton(page).click();

		const deleting = dialog(page).getByRole('button', { name: 'Deleting…' });
		await expect(deleting).toBeVisible();
		await expect(deleting).toBeDisabled();
		await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeDisabled();
		await expect(page).toHaveURL('/admin/recipes');
	});

	test('keeps the dialog open with a safe message when the backend fails, and Try again succeeds @js', async ({
		page,
		request
	}) => {
		const errors = uncaughtErrors(page);
		const marker = `Disk full on shard ${crypto.randomUUID()}`;
		await openRecipe(page, 2);
		await injectFault(request, {
			status: 500,
			message: marker,
			path: '/recipes/2',
			method: 'DELETE'
		});

		await deleteButton(page).click();
		await confirmButton(page).click();

		await expect(dialog(page).getByRole('alert')).toHaveText('An unexpected error occurred.');
		await expect(dialog(page)).not.toContainText(marker);
		await expect(page).toHaveURL('/admin/recipes/2');
		expect(await recipeStored(request, 2)).toBe(true);
		expect(errors).toEqual([]);

		await dialog(page).getByRole('button', { name: 'Try again' }).click();

		await expect(page).toHaveURL('/admin/recipes');
		await expect(page.getByRole('main')).not.toContainText('Vegetarian Stir-Fry');
		expect(await recipeStored(request, 2)).toBe(false);
		expect(errors).toEqual([]);
	});

	test('says "not found" when the recipe was already deleted @js', async ({ page, request }) => {
		const errors = uncaughtErrors(page);
		await openRecipe(page, 2);
		await injectFault(request, { status: 404, path: '/recipes/2', method: 'DELETE' });

		await deleteButton(page).click();
		await confirmButton(page).click();

		await expect(dialog(page).getByRole('alert')).toContainText('Not found');
		await expect(dialog(page).getByRole('button', { name: 'Try again' })).toBeEnabled();
		await expect(page).toHaveURL('/admin/recipes/2');
		expect(errors).toEqual([]);
	});

	test('shows no Delete button without JavaScript', async ({ page }) => {
		test.skip(usesJavaScript(), 'Only a page without JavaScript must hide the button');

		await page.goto('/admin/recipes/2');

		await expect(
			page.getByRole('heading', { level: 1, name: 'Vegetarian Stir-Fry' })
		).toBeVisible();
		await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
		await expect(deleteButton(page)).toHaveCount(0);
	});
});
