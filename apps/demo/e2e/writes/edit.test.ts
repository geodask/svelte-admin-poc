// Editing a record. These tests write to the demo backend, so they run one at a time, after the
// read-only tests (see playwright.config.ts), and with JavaScript on and off.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, hydrated, test } from '../fixtures.ts';
import { valueOf } from '../list-helpers.ts';

/** The record the demo backend holds for a user, read past the admin. */
async function storedUser(request: APIRequestContext, id: number) {
	return (await (await request.get(`${BACKEND_URL}/users/${id}`)).json()) as Record<
		string,
		unknown
	>;
}

/** The `PUT /users/...` requests the demo backend has received so far. */
async function userUpdates(request: APIRequestContext) {
	const log = (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
	return log.filter((line) => line.startsWith('PUT /users/'));
}

const usesJavaScript = () => test.info().project.use.javaScriptEnabled !== false;

/** Open a user's edit View, ready to type into: with JavaScript, once it is hydrated. */
async function openEditView(page: Page, id: number) {
	await page.goto(`/admin/users/${id}/edit`);
	if (usesJavaScript()) await hydrated(page);
}

const save = (page: Page) => page.getByRole('button', { name: 'Save' }).click();
const breadcrumb = (page: Page) => page.getByRole('navigation', { name: 'breadcrumb' });

/** The edit View's inputs, by their accessible names (a required marker is not part of one). */
const nameInput = (page: Page) => page.getByRole('textbox', { name: 'Name', exact: true });
const emailInput = (page: Page) => page.getByRole('textbox', { name: 'Email', exact: true });
const phoneInput = (page: Page) => page.getByRole('textbox', { name: 'Phone', exact: true });
const roleSelect = (page: Page) => page.getByRole('combobox', { name: 'Role', exact: true });
const activeCheckbox = (page: Page) => page.getByRole('checkbox', { name: 'Active', exact: true });
const joinedAtInput = (page: Page) =>
	page.getByRole('textbox', { name: 'Joined at (UTC)', exact: true });

test.describe('the users edit View', () => {
	test('opens from "Edit" on the detail View, prefilled with every value', async ({ page }) => {
		await page.goto('/admin/users/2');

		await page.getByRole('link', { name: 'Edit' }).click();

		await expect(page).toHaveURL('/admin/users/2/edit');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit Grace Hopper');
		await expect(page).toHaveTitle('Edit Grace Hopper · Users');
		await expect(nameInput(page)).toHaveValue('Grace Hopper');
		await expect(emailInput(page)).toHaveValue('grace@example.com');
		await expect(phoneInput(page)).toHaveValue('+44 20 7946 0002');
		await expect(roleSelect(page)).toHaveValue('editor');
		await expect(activeCheckbox(page)).toBeChecked();
		// Shown in UTC, as the Views show dates.
		await expect(joinedAtInput(page)).toHaveValue('2023-02-15T09:00');
		await expect(page.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
			'href',
			'/admin/users/2'
		);
	});

	test('prefills an unchecked checkbox and leaves an empty Field empty', async ({ page }) => {
		// Radia Perlman has left, and has no phone number.
		await openEditView(page, 12);

		await expect(nameInput(page)).toHaveValue('Radia Perlman');
		await expect(activeCheckbox(page)).not.toBeChecked();
		await expect(phoneInput(page)).toHaveValue('');
	});

	test('saves a changed role and lands on the detail View, then the list shows it', async ({
		page,
		request
	}) => {
		await openEditView(page, 2);
		await roleSelect(page).selectOption('viewer');

		await save(page);

		await expect(page).toHaveURL('/admin/users/2');
		await expect(page.getByRole('heading', { level: 1, name: 'Grace Hopper' })).toBeVisible();
		await expect(valueOf(page, 'Role')).toHaveText('viewer');
		// Every other Field kept its value.
		await expect(valueOf(page, 'Email')).toHaveText('grace@example.com');
		await expect(valueOf(page, 'Phone')).toHaveText('+44 20 7946 0002');
		await expect(valueOf(page, 'Joined at')).toHaveText('Feb 15, 2023');
		expect(await storedUser(request, 2)).toEqual({
			id: 2,
			name: 'Grace Hopper',
			email: 'grace@example.com',
			phone: '+44 20 7946 0002',
			role: 'viewer',
			active: true,
			joinedAt: '2023-02-15T09:00:00.000Z'
		});

		await breadcrumb(page).getByRole('link', { name: 'Users' }).click();
		await expect(page).toHaveURL('/admin/users');
		await expect(
			page.getByRole('list', { name: 'Users' }).getByRole('listitem').filter({ hasText: 'Grace' })
		).toContainText('viewer');
	});

	test('clearing an optional Field and saving removes its value', async ({ page, request }) => {
		await openEditView(page, 2);
		await phoneInput(page).fill('');

		await save(page);

		await expect(page).toHaveURL('/admin/users/2');
		await expect(valueOf(page, 'Phone')).toHaveText('—');
		expect(await storedUser(request, 2)).not.toHaveProperty('phone');
	});

	test('a failed save keeps the edited values, not the old ones, and saves nothing', async ({
		page,
		request
	}) => {
		const before = (await userUpdates(request)).length;
		await openEditView(page, 2);
		await roleSelect(page).selectOption('viewer');
		await phoneInput(page).fill('+1 555 0100');
		await activeCheckbox(page).uncheck();
		await nameInput(page).fill('');

		await save(page);

		await expect(nameInput(page)).toHaveAccessibleDescription('Required');
		await expect(nameInput(page)).toHaveValue('');
		await expect(roleSelect(page)).toHaveValue('viewer');
		await expect(phoneInput(page)).toHaveValue('+1 555 0100');
		await expect(activeCheckbox(page)).not.toBeChecked();
		await expect(emailInput(page)).toHaveValue('grace@example.com');
		// The heading still names the record as it is stored.
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit Grace Hopper');
		// Without JavaScript the form posted to the page itself, which shows the issues.
		await expect(page).toHaveURL(/\/admin\/users\/2\/edit(\?|$)/);
		expect(await userUpdates(request)).toHaveLength(before);
	});

	test('a failed save then a fixed one saves what was typed', async ({ page, request }) => {
		await openEditView(page, 2);
		await roleSelect(page).selectOption('admin');
		await nameInput(page).fill('');
		await save(page);
		await expect(nameInput(page)).toHaveAccessibleDescription('Required');

		await nameInput(page).fill('Rear Admiral Grace Hopper');
		await save(page);

		await expect(page).toHaveURL('/admin/users/2');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Rear Admiral Grace Hopper' })
		).toBeVisible();
		await expect(valueOf(page, 'Role')).toHaveText('admin');
		expect(await storedUser(request, 2)).toMatchObject({
			name: 'Rear Admiral Grace Hopper',
			role: 'admin'
		});
	});

	test('back on the detail View, shows the new values without a reload or a refetch @js', async ({
		page
	}) => {
		await page.goto('/admin/users/2');
		await hydrated(page);
		await expect(valueOf(page, 'Role')).toHaveText('editor');
		// Marks this document, so a full reload would show as the mark disappearing.
		await page.evaluate(() => ((window as unknown as { marked: boolean }).marked = true));
		await page.getByRole('link', { name: 'Edit' }).click();
		await expect(roleSelect(page)).toHaveValue('editor');

		const reads: string[] = [];
		page.on('request', (sent) => {
			if (sent.method() === 'GET' && sent.url().includes('/_app/remote/')) reads.push(sent.url());
		});
		await roleSelect(page).selectOption('viewer');
		await save(page);

		await expect(page).toHaveURL('/admin/users/2');
		await expect(valueOf(page, 'Role')).toHaveText('viewer');
		expect(await page.evaluate(() => (window as unknown as { marked?: boolean }).marked)).toBe(
			true
		);
		// The save set the record the detail View reads, so it was not asked for again.
		expect(reads).toEqual([]);
	});
});

test.describe('an edit form whose hidden id names another record', () => {
	test('is refused before the backend is asked, and changes nothing', async ({ page, request }) => {
		const before = (await userUpdates(request)).length;
		await openEditView(page, 2);
		// A crafted post: the edit View of user 2, carrying the id of user 3.
		await page.locator('main form input[type=hidden]').evaluate((input: HTMLInputElement) => {
			input.value = '3';
		});
		await roleSelect(page).selectOption('admin');

		await save(page);

		await expect(page).not.toHaveURL(/\/admin\/users\/3$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Server error' })).toBeVisible();
		expect(await userUpdates(request)).toHaveLength(before);
		expect(await storedUser(request, 3)).toMatchObject({ name: 'Alan Turing', role: 'editor' });
	});
});

test.describe('the edit View for a user that does not exist', () => {
	test('shows "not found" with a link back to the list', async ({ page }) => {
		const response = await page.goto('/admin/users/999/edit');

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
		await expect(page.locator('main form')).toHaveCount(0);

		await page.getByRole('link', { name: 'Back to Users' }).click();

		await expect(page).toHaveURL('/admin/users');
	});

	test('is a 404 page for a malformed id', async ({ page }) => {
		const response = await page.goto('/admin/users/abc/edit');

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
	});
});
