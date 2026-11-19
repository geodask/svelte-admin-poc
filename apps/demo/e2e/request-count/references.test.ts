// How many requests the References on a page of posts make to the demo backend. Every test's
// requests land in the one request log, so these run one at a time, with JavaScript on and off.
// Users' Provider has `getMany`, so a page's authors are one request. The posts Provider has
// none, so the posts that a page's posts reply to are one `getOne` each.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { DANGLING_POST, MISSING_USER_ID, posts, REPLIES, users } from '../../backend/seed.ts';
import { expect, test } from '../fixtures.ts';
import { backendRequestsDuring, columnCells, dataRows } from '../list-helpers.ts';

/** The posts list's first page, newest first (posts 60 to 41), and every backend request it made. */
async function openPostsList(page: Page, request: APIRequestContext) {
	return backendRequestsDuring(request, async () => {
		await page.goto('/admin/posts');
		await expect(dataRows(page)).toHaveCount(20);
	});
}

/** The ids a `GET /users?…` request asks for, sorted, and its page size. */
function idsAskedFor(line: string) {
	const query = new URL(line.split(' ')[1], BACKEND_URL).searchParams;
	return {
		ids: query
			.getAll('id')
			.map(Number)
			.toSorted((a, b) => a - b),
		perPage: query.get('perPage')
	};
}

test.describe('a page of posts', () => {
	test("looks its authors up with one request, and shows every author's name", async ({
		page,
		request
	}) => {
		const log = await openPostsList(page, request);

		// Posts 60 to 41 are by users 1 to 5, and post 57 by the missing user 99. (The filter panel's
		// author picker asks for the first page of users too, for its select; it names no id.)
		const userRequests = log.filter(
			(line) => line.startsWith('GET /users') && idsAskedFor(line).ids.length > 0
		);
		expect(userRequests).toHaveLength(1);
		expect(idsAskedFor(userRequests[0])).toEqual({ ids: [1, 2, 3, 4, 5, 99], perPage: '6' });
		const shown = posts.toReversed().slice(0, 20);
		await expect(await columnCells(page, 'Author')).toHaveText(
			shown.map((post) =>
				post.id === DANGLING_POST
					? `${MISSING_USER_ID} (not found)`
					: users.find((user) => user.id === post.userId)!.name
			)
		);
	});

	test('looks each replied-to post up with one getOne', async ({ page, request }) => {
		const log = await openPostsList(page, request);

		// Posts 60, 59, 58 and 45 reply to posts 1, 2, 1 and 44: one request per distinct id.
		const repliedTo = [...new Set(Object.values(REPLIES))];
		expect(log.filter((line) => /^GET \/posts\/\d+$/.test(line)).toSorted()).toEqual(
			repliedTo.map((id) => `GET /posts/${id}`).toSorted()
		);
		// The posts Provider has no getMany, so no request asks for posts by id.
		expect(log.filter((line) => line.startsWith('GET /posts?') && line.includes('id='))).toEqual(
			[]
		);
		const replyTo = await columnCells(page, 'Reply to');
		await expect(replyTo.nth(0)).toHaveText(posts[0].title);
		await expect(replyTo.getByRole('link')).toHaveCount(4);
	});
});
