// Creating a record. These tests write to the demo backend, so they run one at a time, after the
// read-only tests (see playwright.config.ts), and with JavaScript on and off.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, hydrated, test } from '../fixtures.ts';

/** The value shown beside a Field label on the detail View. */
const valueOf = (page: Page, label: string) =>
	page.locator(`xpath=//dt[normalize-space(text())="${label}"]/following-sibling::dd[1]`).first();

/** The `POST /users` requests the demo backend has received so far. */
async function userCreates(request: APIRequestContext) {
	const log = (await (await request.get(`${BACKEND_URL}/requests`)).json()) as string[];
	return log.filter((line) => line === 'POST /users');
}

/** Open the users create View, ready to type into: with JavaScript, once it is hydrated. */
async function openCreateView(page: Page) {
	await page.goto('/admin/users/new');
	if (test.info().project.use.javaScriptEnabled !== false) await hydrated(page);
}

/** Fill every Field of the users create View. */
async function fillUser(page: Page) {
	await nameInput(page).fill('Lin Clark');
	await emailInput(page).fill('lin@example.com');
	await roleSelect(page).selectOption('editor');
	await activeCheckbox(page).check();
	await joinedAtInput(page).fill('2024-03-01T23:30');
}

const save = (page: Page) => page.getByRole('button', { name: 'Save' }).click();

/** The create View's inputs, by their accessible names (a required marker is not part of one). */
const nameInput = (page: Page) => page.getByRole('textbox', { name: 'Name', exact: true });
const emailInput = (page: Page) => page.getByRole('textbox', { name: 'Email', exact: true });
const roleSelect = (page: Page) => page.getByRole('combobox', { name: 'Role', exact: true });
const activeCheckbox = (page: Page) => page.getByRole('checkbox', { name: 'Active', exact: true });
const joinedAtInput = (page: Page) =>
	page.getByRole('textbox', { name: 'Joined at (UTC)', exact: true });

test.describe('the users create View', () => {
	test('opens from the "New" link on the users list View', async ({ page }) => {
		await page.goto('/admin/users');

		await page.getByRole('link', { name: 'New' }).click();

		await expect(page).toHaveURL('/admin/users/new');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('New record in Users');
		await expect(page).toHaveTitle('New · Users');
	});

	test('shows one labelled input per Field, in schema order, with required ones marked', async ({
		page
	}) => {
		await openCreateView(page);

		const form = page.locator('main form');
		await expect(form.locator('input:not([type=hidden]), select')).toHaveCount(5);
		await expect(nameInput(page)).toHaveJSProperty('type', 'text');
		await expect(emailInput(page)).toHaveJSProperty('type', 'email');
		await expect(roleSelect(page)).toHaveJSProperty('tagName', 'SELECT');
		await expect(activeCheckbox(page)).toHaveJSProperty('type', 'checkbox');
		await expect(joinedAtInput(page)).toHaveJSProperty('type', 'datetime-local');
		await expect(form.locator('label')).toHaveText([
			/^Name\s*\*$/,
			/^Email\s*\*$/,
			/^Role\s*\*$/,
			/^\s*Active\s*$/,
			/^Joined at\s*\(UTC\)\s*\*$/
		]);
		await expect(page.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
			'href',
			'/admin/users'
		);
	});

	test('saves a new user and lands on its detail View, then the list includes it', async ({
		page
	}) => {
		await openCreateView(page);
		await fillUser(page);

		await save(page);

		await expect(page).toHaveURL('/admin/users/13');
		await expect(page.getByRole('heading', { level: 1, name: 'Lin Clark' })).toBeVisible();
		await expect(valueOf(page, 'Email')).toHaveText('lin@example.com');
		await expect(valueOf(page, 'Role')).toHaveText('editor');
		await expect(valueOf(page, 'Active')).toHaveText('Yes');
		// Read in UTC, so 23:30 stays on March 1st.
		await expect(valueOf(page, 'Joined at')).toHaveText('Mar 1, 2024');

		await page.getByRole('navigation', { name: 'breadcrumb' }).getByRole('link').click();
		await expect(page).toHaveURL('/admin/users');
		await expect(page.getByRole('list', { name: 'Users' }).getByRole('listitem')).toHaveCount(13);
		await expect(page.getByRole('link', { name: 'Lin Clark' })).toBeVisible();
	});

	test('reports "Required" for an empty required Field, keeps the input, and creates nothing', async ({
		page,
		request
	}) => {
		const before = (await userCreates(request)).length;
		await openCreateView(page);
		await fillUser(page);
		await nameInput(page).fill('');

		await save(page);

		await expect(nameInput(page)).toHaveAccessibleDescription('Required');
		await expect(nameInput(page)).toHaveAttribute('aria-invalid', 'true');
		await expect(emailInput(page)).toHaveValue('lin@example.com');
		await expect(roleSelect(page)).toHaveValue('editor');
		await expect(activeCheckbox(page)).toBeChecked();
		await expect(joinedAtInput(page)).toHaveValue('2024-03-01T23:30');
		// Without JavaScript the form posted to the page itself, which shows the issues.
		await expect(page).toHaveURL(/\/admin\/users\/new(\?|$)/);
		expect(await userCreates(request)).toHaveLength(before);
	});

	test("shows the schema's message under an invalid email", async ({ page, request }) => {
		const before = (await userCreates(request)).length;
		await openCreateView(page);
		await fillUser(page);
		await emailInput(page).fill('lin');

		await save(page);

		await expect(emailInput(page)).toHaveAccessibleDescription('Invalid email address');
		await expect(nameInput(page)).toHaveValue('Lin Clark');
		expect(await userCreates(request)).toHaveLength(before);
	});

	test('checks the input before sending it, then follows typing @js', async ({ page }) => {
		const remoteWrites: string[] = [];
		page.on('request', (sent) => {
			if (sent.method() === 'POST' && sent.url().includes('/_app/remote/')) {
				remoteWrites.push(sent.url());
			}
		});
		await openCreateView(page);

		// Typing before the first save shows nothing yet.
		await emailInput(page).fill('lin');
		await nameInput(page).click();
		await expect(emailInput(page)).toHaveAccessibleDescription('');

		await save(page);

		await expect(nameInput(page)).toHaveAccessibleDescription('Required');
		await expect(emailInput(page)).toHaveAccessibleDescription('Invalid email address');
		expect(remoteWrites).toEqual([]);

		// Once saved, the issues follow what is typed.
		await emailInput(page).fill('lin@example.com');
		await expect(emailInput(page)).toHaveAccessibleDescription('');
		await expect(nameInput(page)).toHaveAccessibleDescription('Required');
		expect(remoteWrites).toEqual([]);
	});
});
