// The demo replaces the posts create View with an app route of its own, built on the core's
// `createFormView` and the Theme's exported form parts, with the Fields laid out its own way.
// It must behave like the stock create View. These tests write to the demo backend, so they run
// one at a time, after the read-only tests (see playwright.config.ts), and with JavaScript on
// and off.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, hydrated, test } from '../fixtures.ts';
import { valueOf } from '../list-helpers.ts';
import { choose, picker, usesJavaScript } from '../reference-picker.ts';

/** The `POST /posts` requests the demo backend has received so far. */
async function postCreates(request: APIRequestContext) {
	const log = (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
	return log.filter((line) => line === 'POST /posts');
}

/** The record the demo backend holds, read past the admin. */
async function stored(request: APIRequestContext, id: number) {
	return (await (await request.get(`${BACKEND_URL}/posts/${id}`)).json()) as Record<
		string,
		unknown
	>;
}

/** Open the posts create View, ready to type into: with JavaScript, once it is hydrated. */
async function openCreateView(page: Page) {
	await page.goto('/admin/posts/new');
	if (usesJavaScript()) await hydrated(page);
}

const save = (page: Page) => page.getByRole('button', { name: 'Save' }).click();

/** The View's inputs, by their accessible names (a required marker is not part of one). */
const titleInput = (page: Page) => page.getByRole('textbox', { name: 'Title', exact: true });
const bodyInput = (page: Page) => page.getByRole('textbox', { name: 'Body', exact: true });
const firstTag = (page: Page) => page.getByRole('textbox', { name: 'Tags 1', exact: true });
const statusSelect = (page: Page) => page.getByRole('combobox', { name: 'Status', exact: true });
/** The author's Reference picker: a select without JavaScript, a combobox with it. */
const authorPicker = (page: Page) => picker(page, 'Author');
/** The box beside the body that holds the status and the author. */
const publishing = (page: Page) => page.getByRole('complementary', { name: 'Publishing' });

/** Fill every Field of the posts create View. */
async function fillPost(page: Page) {
	await titleInput(page).fill('Sourdough at altitude');
	await bodyInput(page).fill('Less yeast, more water.');
	await firstTag(page).fill('Baking bread');
	await statusSelect(page).selectOption('draft');
	// The author is chosen by name, through the Theme's Reference picker.
	await choose(page, 'Author', 'Alan Turing', 'alan');
}

test.describe('the replaced posts create View', () => {
	test('renders the app’s own layout on the server, from the "New" link', async ({ page }) => {
		await page.goto('/admin/posts');

		await page.getByRole('link', { name: 'New' }).click();

		await expect(page).toHaveURL('/admin/posts/new');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write a post');
		await expect(page).toHaveTitle('New · Posts');
		// The status and the author sit in their own box, beside the body.
		await expect(publishing(page).getByRole('combobox', { name: 'Status' })).toBeVisible();
		await expect(picker(publishing(page), 'Author')).toBeVisible();
		await expect(publishing(page).getByRole('textbox')).toHaveCount(0);
		// No input for the Field the backend owns.
		await expect(page.getByLabel('Views')).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
			'href',
			'/admin/posts'
		);
		// The shell still knows where it is.
		await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toContainText('New');
	});

	test('saves a new post and lands on its detail View', async ({ page, request }) => {
		await openCreateView(page);
		await fillPost(page);

		await save(page);

		await expect(page).toHaveURL('/admin/posts/61');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Sourdough at altitude' })
		).toBeVisible();
		await expect(valueOf(page, 'Status')).toHaveText('draft');
		await expect(valueOf(page, 'Author')).toHaveText('Alan Turing');
		await expect(valueOf(page, 'Tags')).toHaveText('Baking bread');
		// The backend counts the views, starting at 0.
		await expect(valueOf(page, 'Views')).toHaveText('0');
		expect(await stored(request, 61)).toEqual({
			id: 61,
			title: 'Sourdough at altitude',
			userId: 3,
			status: 'draft',
			tags: ['Baking bread'],
			body: 'Less yeast, more water.',
			viewCount: 0
		});
	});

	test('reports the same issues as the stock View, keeps the input, and creates nothing', async ({
		page,
		request
	}) => {
		const before = (await postCreates(request)).length;
		await openCreateView(page);
		await firstTag(page).fill('Baking bread');

		await save(page);

		// The title is rendered by the app itself, with the Theme's issue list under it.
		await expect(titleInput(page)).toHaveAccessibleDescription('Required');
		await expect(titleInput(page)).toHaveAttribute('aria-invalid', 'true');
		await expect(bodyInput(page)).toHaveAccessibleDescription('Required');
		await expect(statusSelect(page)).toHaveAccessibleDescription('Required');
		// The author's picker reports it under itself, as any input does.
		await expect(authorPicker(page)).toHaveAccessibleDescription('Required');
		// Tags may be left empty.
		await expect(firstTag(page)).not.toHaveAttribute('aria-invalid', 'true');
		await expect(firstTag(page)).toHaveValue('Baking bread');
		// Without JavaScript the form posted to the page itself, which shows the issues.
		await expect(page).toHaveURL(/\/admin\/posts\/new(\?|$)/);
		expect(await postCreates(request)).toHaveLength(before);
	});

	test('the issues follow typing once the form has been submitted @js', async ({ page }) => {
		await openCreateView(page);
		await save(page);
		await expect(titleInput(page)).toHaveAccessibleDescription('Required');

		await titleInput(page).fill('Sourdough at altitude');

		await expect(titleInput(page)).not.toHaveAttribute('aria-invalid', 'true');
		await expect(bodyInput(page)).toHaveAccessibleDescription('Required');
	});
});
