// Choosing a post's author, a Reference to users, and the post it replies to, a Reference to posts,
// with the Reference picker on the edit View: a plain select without JavaScript, a searchable
// combobox with it. These tests write to the demo backend, so they run one at a time, with
// JavaScript on and off.
import type { APIRequestContext, Page } from '@playwright/test';
import { BACKEND_URL } from '../../backend/config.ts';
import { DANGLING_POST, MISSING_USER_ID, posts, REPLIES, users } from '../../backend/seed.ts';
import { expect, hydrated, test } from '../fixtures.ts';
import { valueOf } from '../list-helpers.ts';
import { choose, clear, matches, picker, usesJavaScript } from '../reference-picker.ts';

/** The record the demo backend holds for a post, read past the admin. */
async function storedPost(request: APIRequestContext, id: number) {
	return (await (await request.get(`${BACKEND_URL}/posts/${id}`)).json()) as Record<
		string,
		unknown
	>;
}

/** Open a post's edit View, ready to type into: with JavaScript, once it is hydrated. */
async function openEditView(page: Page, id: number) {
	await page.goto(`/admin/posts/${id}/edit`);
	if (usesJavaScript()) await hydrated(page);
}

const save = (page: Page) => page.getByRole('button', { name: 'Save' }).click();

/** The users' names in their default order, by name: the order the author's select lists them. */
const userNames = users.map((user) => user.name).sort((a, b) => a.localeCompare(b));

/** A post's title, by its id. */
const titleOf = (id: number) => posts[id - 1].title;

// Post 1 is by Ada Lovelace (user 1) and replies to none.
test.describe("a post's author on the edit View", () => {
	test('shows the current author, and a save changes the author', async ({ page, request }) => {
		await openEditView(page, 1);
		const author = picker(page, 'Author');
		// The select holds the author's id; the combobox shows the author's name.
		await expect(author).toHaveValue(usesJavaScript() ? 'Ada Lovelace' : '1');

		// With JavaScript, part of the name finds the user.
		await choose(page, 'Author', 'Alan Turing', 'turi');
		await save(page);

		await expect(page).toHaveURL('/admin/posts/1');
		await expect(valueOf(page, 'Author')).toHaveText('Alan Turing');
		await expect(valueOf(page, 'Author').getByRole('link')).toHaveAttribute(
			'href',
			'/admin/users/3'
		);
		expect(await storedPost(request, 1)).toMatchObject({ id: 1, userId: 3 });
	});

	test('without JavaScript, is a select of every user by name, the current one chosen', async ({
		page
	}) => {
		test.skip(usesJavaScript(), 'Once hydrated, the picker is a combobox');
		await openEditView(page, 1);
		const author = picker(page, 'Author');

		// The first 50 users in their default order (all 12 of them) after "Choose…", since an
		// author is required.
		await expect(author.getByRole('option')).toHaveText(['Choose…', ...userNames]);
		await expect(author.locator('option:checked')).toHaveText('Ada Lovelace');
	});

	test('with JavaScript, the arrow keys move through the matches and Escape closes them @js', async ({
		page
	}) => {
		await openEditView(page, 1);
		const author = picker(page, 'Author');
		const users = matches(page, 'Author');

		// The arrow keys open every user, in their default order, on the current one.
		await author.press('ArrowDown');
		await expect(users).toHaveText(userNames);
		await expect(author).toHaveAttribute('aria-expanded', 'true');
		const active = users.and(page.getByRole('option', { selected: true }));
		await expect(active).toHaveText('Ada Lovelace');
		await author.press('ArrowDown');
		await expect(active).toHaveText(userNames[1]);
		await expect(author).toHaveAttribute(
			'aria-activedescendant',
			(await active.getAttribute('id'))!
		);

		// Escape closes the list and keeps the current author.
		await author.press('Escape');
		await expect(author).toHaveAttribute('aria-expanded', 'false');
		await expect(users).toHaveCount(0);
		await expect(author).toHaveValue('Ada Lovelace');

		// A search with no match says so.
		await author.fill('nobody at all');
		await expect(page.getByRole('status').filter({ hasText: 'No matches.' })).toBeAttached();
		await expect(users).toHaveCount(0);
		// Leaving the input shows the current author again.
		await page.getByRole('heading', { level: 1 }).click();
		await expect(author).toHaveValue('Ada Lovelace');
	});

	// Post 57's author, user 99, doesn't exist: the backend refuses to save it.
	test("that names no user shows as its id, and the backend's issue shows under the picker", async ({
		page,
		request
	}) => {
		await openEditView(page, DANGLING_POST);
		const author = picker(page, 'Author');
		if (!usesJavaScript()) {
			// The select holds every user, plus the current id, which names none.
			await expect(author.getByRole('option')).toHaveText([
				'Choose…',
				...userNames,
				`${MISSING_USER_ID} (not found)`
			]);
		}
		await expect(author).toHaveValue(String(MISSING_USER_ID));

		await save(page);

		await expect(author).toHaveAccessibleDescription('No user has this id');
		await expect(author).toHaveAttribute('aria-invalid', 'true');
		// The input is kept.
		await expect(author).toHaveValue(String(MISSING_USER_ID));
		await expect(page).toHaveURL(new RegExp(`/admin/posts/${DANGLING_POST}/edit(\\?|$)`));
		expect(await storedPost(request, DANGLING_POST)).toMatchObject({ userId: MISSING_USER_ID });

		// Choosing a user fixes it.
		await choose(page, 'Author', 'Grace Hopper', 'grace');
		await save(page);

		await expect(page).toHaveURL(`/admin/posts/${DANGLING_POST}`);
		expect(await storedPost(request, DANGLING_POST)).toMatchObject({ userId: 2 });
	});
});

// A post may reply to another, an optional self-Reference. Posts can't be searched, so the picker
// filters the newest 50 posts by title. Post 60 replies to post 1; post 1 replies to none.
test.describe('the post a post replies to, on the edit View', () => {
	test('is chosen by its title, and a save sets it', async ({ page, request }) => {
		await openEditView(page, 1);
		const replyTo = picker(page, 'Reply to');
		await expect(replyTo).toHaveValue('');

		// Post 50 is the only post among the newest 50 whose title holds "bread (part 7)".
		await choose(page, 'Reply to', titleOf(50), 'BREAD (part 7)');
		await save(page);

		await expect(page).toHaveURL('/admin/posts/1');
		await expect(valueOf(page, 'Reply to')).toHaveText(titleOf(50));
		await expect(valueOf(page, 'Reply to').getByRole('link')).toHaveAttribute(
			'href',
			'/admin/posts/50'
		);
		expect(await storedPost(request, 1)).toMatchObject({ id: 1, replyToId: 50 });
	});

	test('without JavaScript, is a select of the newest 50 posts plus the current one', async ({
		page
	}) => {
		test.skip(usesJavaScript(), 'Once hydrated, the picker is a combobox');
		await openEditView(page, 60);
		const replyTo = picker(page, 'Reply to');

		// Posts 60 to 11, newest first as the posts list opens, then post 1, which post 60 replies
		// to, after "—", since a reply is optional.
		const newest = Array.from({ length: 50 }, (_, index) => titleOf(60 - index));
		await expect(replyTo.getByRole('option')).toHaveText(['—', ...newest, titleOf(REPLIES[60])]);
		await expect(replyTo).toHaveValue('1');
	});

	test('cleared, removes it', async ({ page, request }) => {
		await openEditView(page, 60);
		const replyTo = picker(page, 'Reply to');
		await expect(replyTo).toHaveValue(usesJavaScript() ? titleOf(1) : '1');

		await clear(page, 'Reply to');
		await save(page);

		await expect(page).toHaveURL('/admin/posts/60');
		expect(await storedPost(request, 60)).not.toHaveProperty('replyToId');
		await expect(valueOf(page, 'Reply to')).toHaveText('—');
	});
});
