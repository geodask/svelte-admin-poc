import { DANGLING_POST, MISSING_USER_ID } from '../backend/seed.ts';
import { expect, test } from './fixtures.ts';
import {
	backendRequestsDuring,
	backendRequestsFor,
	captureGetList,
	captureLookup,
	columnCells,
	dataRows,
	openInSidebar,
	pager,
	uniquePage,
	valueOf
} from './list-helpers.ts';

// A post's author is a Reference to users: the Views show the user's name, linked to the user's
// detail View. Post 1's author is user 1, Ada Lovelace; post 2's is user 2, Grace Hopper. Post
// 57's author names no user.

test.describe("a post's author, a Reference to users", () => {
	test('shows in the list View as the user’s name, linked to the user', async ({ page }) => {
		await page.goto('/admin/posts?sort=id');

		const authors = await columnCells(page, 'Author');
		await expect(authors.nth(0)).toHaveText('Ada Lovelace');
		await expect(authors.nth(1)).toHaveText('Grace Hopper');
		await expect(authors.nth(0).getByRole('link')).toHaveAttribute('href', '/admin/users/1');

		await authors.nth(1).getByRole('link', { name: 'Grace Hopper' }).click();

		await expect(page).toHaveURL('/admin/users/2');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grace Hopper');
	});

	test('is in the server-rendered list View', async ({ page }) => {
		const response = await page.goto('/admin/posts?sort=id');

		const html = (await response?.text()) ?? '';
		expect(html).toContain('href="/admin/users/1"');
		expect(html).toContain('Ada Lovelace');
	});

	test('shows on the detail View as the user’s name, linked to the user', async ({ page }) => {
		await page.goto('/admin/posts/1');

		await expect(valueOf(page, 'Author')).toHaveText('Ada Lovelace');
		await expect(valueOf(page, 'Author').getByRole('link')).toHaveAttribute(
			'href',
			'/admin/users/1'
		);

		await valueOf(page, 'Author').getByRole('link').click();

		await expect(page).toHaveURL('/admin/users/1');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ada Lovelace');
	});

	test('that names no user shows its id, muted, and the list still renders', async ({ page }) => {
		// Newest first: posts 60 to 41, so post 57 is the fourth row.
		await page.goto('/admin/posts');

		await expect(dataRows(page)).toHaveCount(20);
		const dangling = (await columnCells(page, 'Author')).nth(60 - DANGLING_POST);
		await expect(dangling).toHaveText(`${MISSING_USER_ID} (not found)`);
		await expect(dangling.getByText(String(MISSING_USER_ID))).toHaveClass(/text-muted-foreground/);
		await expect(dangling.getByRole('link')).toHaveCount(0);
		// Every other author still shows by name, as a link.
		await expect((await columnCells(page, 'Author')).getByRole('link')).toHaveCount(19);
	});

	test('that names no user shows its id on the detail View too', async ({ page }) => {
		await page.goto(`/admin/posts/${DANGLING_POST}`);

		await expect(valueOf(page, 'Author')).toHaveText(`${MISSING_USER_ID} (not found)`);
		await expect(valueOf(page, 'Author').getByRole('link')).toHaveCount(0);
	});
});

test.describe("crafted calls with a post's author", () => {
	test('a getList filter on the author with another operator than eq is rejected @js', async ({
		page,
		request
	}) => {
		await page.goto('/admin/posts');
		const call = await captureGetList(page, request, () =>
			pager(page).getByRole('link', { name: 'Next' }).click()
		);
		const marker = uniquePage();

		for (const filters of [
			[{ field: 'userId', operator: 'gte', value: 3 }],
			[{ field: 'userId', operator: 'in', value: [3, 4] }],
			[{ field: 'userId', operator: 'eq', value: '3' }]
		]) {
			const rejected = await call({ page: marker, filters });
			expect(await rejected.json()).toMatchObject({ type: 'error', error: { status: 400 } });
		}
		expect(await backendRequestsFor(request, marker)).toEqual([]);

		const good = await call({
			page: marker,
			filters: [{ field: 'userId', operator: 'eq', value: 3 }]
		});
		expect(await good.json()).toMatchObject({ type: 'result' });
		expect(await backendRequestsFor(request, marker)).toEqual([
			`GET /posts?page=${marker}&perPage=20&sort=id&order=desc&userId=3`
		]);
	});

	test('a lookup with a string id for a user is rejected @js', async ({ page, request }) => {
		await page.goto('/admin/users');
		// The users lookup: the posts list asks it for each author's name.
		const lookup = await captureLookup(page, request, () => openInSidebar(page, 'Posts'));
		// An id no other test asks for, so the request log shows only this test's requests.
		const id = 700_000 + Math.floor(Math.random() * 100_000);
		const asked = (log: string[]) => log.filter((line) => line === `GET /users/${id}`);

		const rejected = await backendRequestsDuring(request, async () => {
			const response = await lookup([String(id)]);
			expect(await response.json()).toMatchObject({ type: 'error', error: { status: 400 } });
		});
		expect(asked(rejected)).toEqual([]);

		const good = await backendRequestsDuring(request, async () => {
			const response = await lookup([id]);
			expect(await response.json()).toMatchObject({ type: 'result' });
		});
		expect(asked(good)).toEqual([`GET /users/${id}`]);
	});
});
