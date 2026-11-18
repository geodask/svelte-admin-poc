// Saving a post's author, a Reference to users, and the post it replies to, a Reference to posts,
// through the edit View. Until the Reference picker, each is edited as the target's id. These tests write to the demo backend, so they
// run one at a time, with JavaScript on and off.
import type { APIRequestContext } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { posts } from '../../backend/seed.ts';
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

// A post may reply to another, an optional self-Reference. Until the Reference picker, it is
// edited as the replied-to post's id too. Post 60 replies to post 1; post 1 replies to none.
test.describe('the post a post replies to, on the edit View', () => {
	test('is an input for the post’s id, and a save sets it', async ({ page, request }) => {
		await page.goto('/admin/posts/1/edit');
		if (test.info().project.use.javaScriptEnabled !== false) await hydrated(page);
		const replyTo = page.getByRole('spinbutton', { name: 'Reply to', exact: true });
		await expect(replyTo).toHaveValue('');

		await replyTo.fill('2');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page).toHaveURL('/admin/posts/1');
		await expect(valueOf(page, 'Reply to')).toHaveText(posts[1].title);
		await expect(valueOf(page, 'Reply to').getByRole('link')).toHaveAttribute(
			'href',
			'/admin/posts/2'
		);
		expect(await storedPost(request, 1)).toMatchObject({ id: 1, replyToId: 2 });
	});

	test('cleared, removes it', async ({ page, request }) => {
		await page.goto('/admin/posts/60/edit');
		if (test.info().project.use.javaScriptEnabled !== false) await hydrated(page);
		const replyTo = page.getByRole('spinbutton', { name: 'Reply to', exact: true });
		await expect(replyTo).toHaveValue('1');

		await replyTo.fill('');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page).toHaveURL('/admin/posts/60');
		expect(await storedPost(request, 60)).not.toHaveProperty('replyToId');
	});
});
