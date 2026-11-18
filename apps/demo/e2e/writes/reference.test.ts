// Saving a post's author, a Reference to users, through the edit View. Until the Reference
// picker, the author is edited as the user's id. These tests write to the demo backend, so they
// run one at a time, with JavaScript on and off.
import type { APIRequestContext } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { expect, hydrated, test } from '../fixtures.ts';
import { valueOf } from '../list-helpers.ts';

/** The record the demo backend holds for a post, read past the admin. */
async function storedPost(request: APIRequestContext, id: number) {
	return (await (await request.get(`${BACKEND_URL}/posts/${id}`)).json()) as Record<
		string,
		unknown
	>;
}

test.describe("a post's author on the edit View", () => {
	test('is an input for the user’s id, and a save changes the author', async ({
		page,
		request
	}) => {
		await page.goto('/admin/posts/1/edit');
		if (test.info().project.use.javaScriptEnabled !== false) await hydrated(page);
		const author = page.getByRole('spinbutton', { name: 'Author', exact: true });
		await expect(author).toHaveValue('1');

		await author.fill('3');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page).toHaveURL('/admin/posts/1');
		await expect(valueOf(page, 'Author')).toHaveText('Alan Turing');
		await expect(valueOf(page, 'Author').getByRole('link')).toHaveAttribute(
			'href',
			'/admin/users/3'
		);
		expect(await storedPost(request, 1)).toMatchObject({ id: 1, userId: 3 });
	});
});
