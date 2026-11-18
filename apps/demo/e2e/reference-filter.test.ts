// Filtering posts by their author, a Reference to users, with the Reference picker in the filter
// panel: a plain select in the GET form without JavaScript, a searchable combobox with it. The
// list URL holds the author's id (`userId=3`), and the chip names the author.
import type { Page } from '@playwright/test';
import { DANGLING_POST, MISSING_USER_ID, posts } from '../backend/seed.ts';
import { expect, hydrated, test } from './fixtures.ts';
import {
	columnCells,
	dataRows,
	expectLanded,
	filterForm,
	filtersToggle,
	openFilters
} from './list-helpers.ts';
import { choose, clear, picker, usesJavaScript } from './reference-picker.ts';

// User 3, Alan Turing, wrote 12 of the 60 posts.
const TURING_POSTS = posts.filter((post) => post.userId === 3).length;

/** The row of active filter chips, and the chip of one filter by its label. */
const chipList = (page: Page) => page.getByRole('list', { name: 'Active filters' });
const chip = (page: Page, label: string) =>
	chipList(page).getByRole('link', { name: `Remove filter ${label}`, exact: true });

/** Open a list of posts with its filter panel open, ready to type into once hydrated. */
async function openPosts(page: Page, search = '') {
	await page.goto(`/admin/posts${search}`);
	if (usesJavaScript()) await hydrated(page);
	await openFilters(page);
}

/** Apply the filter form. */
const apply = (page: Page) => filterForm(page).getByRole('button', { name: 'Apply' }).click();

/** The authors the list shows, each once. */
const authorsShown = async (page: Page) =>
	new Set(await (await columnCells(page, 'Author')).allInnerTexts());

test.describe('filtering posts by author', () => {
	test('choosing an author by name filters by its id, keeping the sort and page size, from page 1', async ({
		page
	}) => {
		await openPosts(page, '?page=2&perPage=10&sort=title');

		// With JavaScript, part of the name finds the user.
		await choose(page, 'Author', 'Alan Turing', 'tur');
		await apply(page);

		await expectLanded(page, '/admin/posts?perPage=10&sort=title&userId=3');
		await expect(dataRows(page)).toHaveCount(10);
		await expect.poll(() => authorsShown(page)).toEqual(new Set(['Alan Turing']));
		await expect(chip(page, 'Author: Alan Turing')).toBeVisible();
		await expect(filtersToggle(page)).toHaveText(/^\s*Filters\s*1\s*$/);

		// The picker shows the author the list is filtered by.
		await openFilters(page);
		await expect(picker(filterForm(page), 'Author')).toHaveValue(
			usesJavaScript() ? 'Alan Turing' : '3'
		);
	});

	test("the chip's × removes the filter, and the picker forgets the author", async ({ page }) => {
		await openPosts(page, '?perPage=10&sort=title&userId=3');
		await expect(picker(filterForm(page), 'Author')).toHaveValue(
			usesJavaScript() ? 'Alan Turing' : '3'
		);

		// The open panel covers the chips: close it first.
		await filtersToggle(page).click();
		await chip(page, 'Author: Alan Turing').click();

		await expect(page).toHaveURL('/admin/posts?perPage=10&sort=title');
		await expect(chipList(page)).toHaveCount(0);
		await expect(dataRows(page)).toHaveCount(10);
		await expect.poll(async () => (await authorsShown(page)).size).toBeGreaterThan(1);
		await openFilters(page);
		await expect(picker(filterForm(page), 'Author')).toHaveValue('');
	});

	test('choosing "Any" shows every post', async ({ page }) => {
		await openPosts(page, '?userId=3');
		await expect(dataRows(page)).toHaveCount(TURING_POSTS);

		await clear(page, 'Author');
		await apply(page);

		await expectLanded(page, '/admin/posts');
		await expect(dataRows(page)).toHaveCount(20);
		await expect(chipList(page)).toHaveCount(0);
	});

	test('without JavaScript, is a select of every user by name after "Any"', async ({ page }) => {
		test.skip(usesJavaScript(), 'Once hydrated, the picker is a combobox');
		await openPosts(page, '?userId=3');

		const author = picker(filterForm(page), 'Author');
		await expect(author).toHaveValue('3');
		const options = await author.getByRole('option').allInnerTexts();
		expect(options[0]).toBe('Any');
		expect(options).toContain('Alan Turing');
		expect(options).toHaveLength(13);
	});

	test('the chip names the author in the server-rendered page', async ({ page }) => {
		const response = await page.goto('/admin/posts?userId=3');

		expect((await response?.text()) ?? '').toContain('Author: Alan Turing');
	});

	test('a bookmark naming no user still filters, and its chip shows the id', async ({ page }) => {
		await openPosts(page, `?userId=${MISSING_USER_ID}`);

		await expect(dataRows(page)).toHaveCount(1);
		await expect((await columnCells(page, 'Title')).first()).toHaveText(
			posts[DANGLING_POST - 1].title
		);
		await expect(chip(page, `Author: ${MISSING_USER_ID}`)).toBeVisible();
		// The picker shows the id too, as the one it can't find.
		const author = picker(filterForm(page), 'Author');
		if (usesJavaScript()) await expect(author).toHaveValue(String(MISSING_USER_ID));
		else
			await expect(author.locator('option:checked')).toHaveText(`${MISSING_USER_ID} (not found)`);
	});
});
