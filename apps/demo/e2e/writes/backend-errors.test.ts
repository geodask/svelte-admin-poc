// A save the backend refuses. These tests write to the demo backend and inject faults into it,
// so they run one at a time, after the read-only tests, with nothing beside them (see
// playwright.config.ts), and with JavaScript on and off.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, hydrated, injectFault, test } from '../fixtures.ts';
import { serverLog } from '../server-log.ts';

const usesJavaScript = () => test.info().project.use.javaScriptEnabled !== false;

/** Open a page of the admin, ready to type into: with JavaScript, once it is hydrated. */
async function open(page: Page, path: string) {
	await page.goto(path);
	if (usesJavaScript()) await hydrated(page);
}

/** How many users the demo backend holds, read past the admin. */
async function storedUserCount(request: APIRequestContext) {
	const response = await request.get(`${BACKEND_URL}/users?perPage=100`);
	return ((await response.json()) as { total: number }).total;
}

const save = (page: Page) => page.getByRole('button', { name: 'Save' }).click();
const form = (page: Page) => page.locator('main form');
/** The message at the top of the form, for a refused save no input is to blame for. */
const formMessage = (page: Page) => form(page).locator(':scope > [role=alert]:first-child');

/** The users form's inputs, by their accessible names (a required marker is not part of one). */
const nameInput = (page: Page) => page.getByRole('textbox', { name: 'Name', exact: true });
const emailInput = (page: Page) => page.getByRole('textbox', { name: 'Email', exact: true });
const phoneInput = (page: Page) => page.getByRole('textbox', { name: 'Phone', exact: true });
const roleSelect = (page: Page) => page.getByRole('combobox', { name: 'Role', exact: true });
const activeCheckbox = (page: Page) => page.getByRole('checkbox', { name: 'Active', exact: true });
const joinedAtInput = (page: Page) =>
	page.getByRole('textbox', { name: 'Joined at (UTC)', exact: true });

/** Fill every Field of the users create View, with `email`. */
async function fillUser(page: Page, email: string) {
	await nameInput(page).fill('Lin Clark');
	await emailInput(page).fill(email);
	await phoneInput(page).fill('+1 555 0199');
	await roleSelect(page).selectOption('editor');
	await activeCheckbox(page).check();
	await joinedAtInput(page).fill('2024-03-01T23:30');
}

/** Check that the users create View still shows what `fillUser` typed. */
async function expectUserKept(page: Page, email: string) {
	await expect(nameInput(page)).toHaveValue('Lin Clark');
	await expect(emailInput(page)).toHaveValue(email);
	await expect(phoneInput(page)).toHaveValue('+1 555 0199');
	await expect(roleSelect(page)).toHaveValue('editor');
	await expect(activeCheckbox(page)).toBeChecked();
	await expect(joinedAtInput(page)).toHaveValue('2024-03-01T23:30');
}

test.describe('a backend rule broken by one Field', () => {
	test('shows its message under that input, keeps every value, and creates nothing', async ({
		page,
		request
	}) => {
		const before = await storedUserCount(request);
		await open(page, '/admin/users/new');
		// Grace Hopper already has this email; only the backend can tell.
		await fillUser(page, 'grace@example.com');

		await save(page);

		await expect(emailInput(page)).toHaveAccessibleDescription(
			'A user with this email already exists'
		);
		await expect(emailInput(page)).toHaveAttribute('aria-invalid', 'true');
		await expectUserKept(page, 'grace@example.com');
		await expect(formMessage(page)).toHaveCount(0);
		// Without JavaScript the form posted to the page itself, which shows the issue.
		await expect(page).toHaveURL(/\/admin\/users\/new(\?|$)/);
		expect(await storedUserCount(request)).toBe(before);
	});

	test('then a fixed save creates the record', async ({ page }) => {
		await open(page, '/admin/users/new');
		await fillUser(page, 'grace@example.com');
		await save(page);
		await expect(emailInput(page)).toHaveAccessibleDescription(
			'A user with this email already exists'
		);

		await emailInput(page).fill('lin@example.com');
		await save(page);

		await expect(page).toHaveURL('/admin/users/13');
		await expect(page.getByRole('heading', { level: 1, name: 'Lin Clark' })).toBeVisible();
	});
});

test.describe('a backend issue on a Field the form has no input for', () => {
	test('shows its message at the top of the form', async ({ page, request }) => {
		await open(page, '/admin/users/2/edit');
		await roleSelect(page).selectOption('viewer');
		// The email is set once on create, so the edit View shows it as text, not as an input.
		const issue = { path: ['email'], message: 'This email bounced; update it first' };
		await injectFault(request, {
			status: 422,
			body: { issues: [issue] },
			method: 'PUT',
			path: '/users/2'
		});

		await save(page);

		await expect(formMessage(page)).toHaveText(issue.message);
		await expect(roleSelect(page)).toHaveValue('viewer');
		await expect(page).toHaveURL(/\/admin\/users\/2\/edit(\?|$)/);
	});
});

test.describe('a conflict from the backend', () => {
	test('on create shows its message at the top of the form and keeps the input', async ({
		page,
		request
	}) => {
		const before = await storedUserCount(request);
		await open(page, '/admin/users/new');
		await fillUser(page, 'lin@example.com');
		await injectFault(request, { status: 409, method: 'POST', path: '/users' });

		await save(page);

		await expect(formMessage(page)).toHaveText('Conflict');
		await expectUserKept(page, 'lin@example.com');
		await expect(page).toHaveURL(/\/admin\/users\/new(\?|$)/);
		expect(await storedUserCount(request)).toBe(before);
	});

	test('on edit shows its message at the top of the form and keeps the input', async ({
		page,
		request
	}) => {
		await open(page, '/admin/users/2/edit');
		await roleSelect(page).selectOption('viewer');
		await phoneInput(page).fill('+1 555 0100');
		await injectFault(request, { status: 409, method: 'PUT', path: '/users/2' });

		await save(page);

		await expect(formMessage(page)).toHaveText('Conflict');
		await expect(roleSelect(page)).toHaveValue('viewer');
		await expect(phoneInput(page)).toHaveValue('+1 555 0100');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit Grace Hopper');
		await expect(page).toHaveURL(/\/admin\/users\/2\/edit(\?|$)/);
	});
});

test.describe('saving the edit View of a record deleted meanwhile', () => {
	test('says "This record no longer exists" and recreates nothing', async ({ page, request }) => {
		await open(page, '/admin/users/3/edit');
		await expect(nameInput(page)).toHaveValue('Alan Turing');
		await nameInput(page).fill('Alan M. Turing');
		// Someone else deletes the record while it is being edited.
		expect((await request.delete(`${BACKEND_URL}/users/3`)).status()).toBe(204);

		await save(page);

		await expect(page.getByRole('alert')).toContainText('This record no longer exists');
		if (usesJavaScript()) {
			// The form stays, with what was typed.
			await expect(formMessage(page)).toHaveText('This record no longer exists');
			await expect(nameInput(page)).toHaveValue('Alan M. Turing');
		} else {
			// The page is rendered again and the record can't load: it links back to the list.
			await expect(page.getByRole('link', { name: 'Back to Users' })).toBeVisible();
		}
		expect((await request.get(`${BACKEND_URL}/users/3`)).status()).toBe(404);
	});
});

test.describe('an unexpected backend error on a save', () => {
	test('shows a safe generic message, and the server logs the error @js', async ({
		page,
		request
	}) => {
		const marker = `Replica lag on users ${crypto.randomUUID()}`;
		await open(page, '/admin/users/new');
		await fillUser(page, 'lin@example.com');
		await injectFault(request, { status: 500, message: marker, method: 'POST', path: '/users' });

		await save(page);

		await expect(page.getByRole('heading', { level: 1, name: 'Server error' })).toBeVisible();
		await expect(page.getByText('Something went wrong on our end.')).toBeVisible();
		const html = await page.content();
		for (const leak of [marker, 'REST Provider', 'localhost:4100', '    at ']) {
			expect(html).not.toContain(leak);
		}
		await expect.poll(serverLog).toContain(marker);
		await expect.poll(serverLog).toMatch(/REST Provider: POST \S+\/users failed with 500/);
	});
});
